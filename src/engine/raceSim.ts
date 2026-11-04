import {
  CAR_COUNT,
  CAR_NORM_W,
  DRIVERS,
  MAX_SPEED,
  PIT_BAY_ENGINE,
  PIT_BAY_NITRO,
  PIT_BAY_TYRES,
  PIT_EXIT_END,
  PIT_WALL_END,
  PIT_WALL_FIRST,
  PIT_WALL_X,
  ROAD_W,
  SEGF_MID_PIT,
  SEG_LEN,
  buildRoadGeometry,
  type ClientCarTelemetry,
  type DevicePlatform,
  type ParsedRoad,
  type RoomStatePayload,
} from '../shared/raceProtocol';
import { synthAudio } from './synthAudio';

// Pit lane v1.2 geometry with outer stand apron for waiting technicians
export const PIT_PRE = 12;
export const PIT_ENTRY = -PIT_PRE;
export const PIT_WALL_START_REPO = 19; // concrete wall begins at second bay (easy open entry)
export const PIT_STRIP_W = 0.64;       // inner safety margin between pit wall (1.04) and box left line (1.72)

export function pitIdxOf(segIdx: number, segCount: number): number {
  return segIdx >= segCount - PIT_PRE ? segIdx - segCount : segIdx;
}

export function pitTaperAt(pitIdx: number): number {
  if (pitIdx < PIT_WALL_START_REPO) {
    return Math.max(0, Math.min(1, (pitIdx - PIT_ENTRY) / (PIT_WALL_START_REPO - PIT_ENTRY)));
  }
  if (pitIdx > PIT_WALL_END) {
    return Math.max(0, Math.min(1, 1 - (pitIdx - PIT_WALL_END) / (PIT_EXIT_END - PIT_WALL_END)));
  }
  return 1;
}

export function pitOuterAt(taper: number): number {
  return 1.12 + 1.46 * taper; // 2.58 at full width (box white border ax1 = 2.48, outer stand apron 2.48..3.18)
}

export function pitInnerAt(pitIdx: number): number {
  return pitIdx < PIT_WALL_START_REPO ? 1.07 : 1.08 + PIT_STRIP_W * pitTaperAt(pitIdx);
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  a: boolean; // Gas / Confirm
  b: boolean; // Brake / Back
  c: boolean; // Nitro
  l1: boolean; // Gamebuino AKA L1: Pit Limiter / Compact HUD toggle
  run: boolean; // Pause / Start
  joyX: number;
}

export interface SimProp {
  seg: number;
  spr: string;
  offset: number;
  flip: boolean;
  worldW: number;
  hitW: number;
}

export interface SimCar {
  slot: number;
  name: string;
  platform: DevicePlatform | 'AI';
  isPlayer: boolean;
  isRemoteHuman: boolean;
  look: number;
  dist: number;
  x: number;
  speed: number;
  steerVis: number;
  braking: boolean;
  nitroOn: boolean;
  pitting: boolean;
  damage: number;
  lapsDone: number;
  lapStart: number;
  lastLap: number;
  bestLap: number;
  finishTime: number;
  finished: boolean;
  retired: boolean;
  place: number;
  topFactor: number;
  skill: number;
  accelF: number;
  laneBias: number;
  targetX: number;
}

export interface ParticleFx {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
  g: number;
  b: number;
  size: number;
  kind: 'spark' | 'puff' | 'chip';
}

export type ActivePitBay = 'NONE' | 'NITRO' | 'TYRES' | 'ENGINE' | 'MID_NITRO';

export type PitCrewPhase = 'IDLE_OUTSIDE' | 'WALKING_IN' | 'WORKING' | 'WALKING_OUT';

export interface PitBayCrewState {
  phase: PitCrewPhase;
  progress: number;     // 0.0 = waiting outside, 1.0 = in position around stopped car
  workTimer: number;    // elapsed work time once beside the car
  workRequired: number; // total work duration once beside the car
  anchorZ: number;      // world Z of the stopped car
  anchorX: number;      // lateral X of the stopped car
  startDamage: number;
  startTyreWear: number;
  startNitro: number;
}

export interface SimFeaturesConfig {
  // Only undecided feature proposals remain toggleable; 3D-Hybrid cars & 3-Bay Pit Stops are now locked in!
  circuitAnimV12: boolean;
  compactHudL1: boolean;
}

export type GameScreenState = 'TITLE' | 'COUNTDOWN' | 'RACING' | 'FINISHED' | 'RESULTS';

function createInitialBayCrew(bayStartSeg: number): PitBayCrewState {
  return {
    phase: 'IDLE_OUTSIDE',
    progress: 0,
    workTimer: 0,
    workRequired: 2.0,
    anchorZ: (bayStartSeg + 3) * SEG_LEN,
    anchorX: 2.10,
    startDamage: 0,
    startTyreWear: 0,
    startNitro: 1,
  };
}

export class AkaRaceSimulator {
  public road: ParsedRoad = buildRoadGeometry(0);
  public propsBySeg: SimProp[][] = [];
  public farH: Uint8Array = new Uint8Array(1024);
  public nearH: Uint8Array = new Uint8Array(1024);

  public cars: SimCar[] = [];
  public playerIdx = CAR_COUNT - 1;
  public trackId = 0;
  public difficulty = 1; // 0 Easy, 1 Normal, 2 Hard, 3 Expert
  public laps = 3;

  public screenState: GameScreenState = 'RACING';
  public stateT = 0;
  public globalTime = 0;
  public raceTime = 0;
  public paused = false;

  // Player dynamics & damage/pit telemetry
  public nitro = 1.0;
  public nitroOn = false;
  public steer = 0;
  public damage = 0;
  public tyreWear = 0;
  public perf = 1.0;
  public pullDir = 0;
  public sputter = 0;
  public sputterNext = 2.0;
  public shake = 0;
  public spinT = 0;
  public spinDir = 0;
  public offroad = 0;
  public skid = 0;
  public gear = 1;
  public rpm = 0.2;
  public skyOffset = 0;
  public nearOffset = 0;

  // Pit Stop & 4-Phase Technician Crew state
  public inPitLane = false;
  public pitLimiterActive = true;
  public activePitBay: ActivePitBay = 'NONE';
  public pitting = false;
  public pitStopTimer = 0;
  public lollipopState: 'HIDDEN' | 'STOP' | 'READY' | 'GO' = 'HIDDEN';
  public lollipopGoTimer = 0;
  public launchBoostTimer = 0;
  public pitBayCrews: [PitBayCrewState, PitBayCrewState] = [
    createInitialBayCrew(PIT_BAY_TYRES.start),
    createInitialBayCrew(PIT_BAY_ENGINE.start),
  ];
  public pitCrewProgress: [number, number] = [0, 0];
  public pitCrewApproaching: [boolean, boolean] = [false, false];
  public pitServicedCurrentStop = false;
  private pitServicedBay: ActivePitBay = 'NONE';
  private wrenchSfxTick = 0;

  // Banner message
  public bannerText = '';
  public bannerTimer = 0;
  public bannerColor: [number, number, number] = [255, 235, 110];

  // Particles
  public particles: ParticleFx[] = [];

  // Multiplayer room link
  public multiplayerActive = false;
  public localSlot = CAR_COUNT - 1;

  public features: SimFeaturesConfig = {
    circuitAnimV12: true,
    compactHudL1: false,
  };

  private rngState = 0x1234567;
  private prevL1 = false;
  private prevRun = false;
  private countBeep = 0;
  private crashCooldown = 0;

  constructor() {
    this.setupRace(0, 1, 3, false);
  }

  private rand(): number {
    let x = this.rngState | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rngState = x;
    return ((x >>> 0) & 0xffffff) / 16777216;
  }

  public showBanner(text: string, color: [number, number, number] = [255, 235, 110], dur = 1.7) {
    this.bannerText = text;
    this.bannerColor = color;
    this.bannerTimer = dur;
  }

  public setupRace(trackId: number, diff: number, lapCount: number, withCountdown = true) {
    this.trackId = Math.max(0, Math.min(5, trackId));
    this.difficulty = Math.max(0, Math.min(3, diff));
    this.laps = lapCount;
    this.road = buildRoadGeometry(this.trackId);
    this.buildSceneryAndBackdrop();
    synthAudio.setTrackSong(this.trackId);

    this.raceTime = 0;
    this.stateT = 0;
    this.paused = false;
    this.nitro = 1.0;
    this.nitroOn = false;
    this.steer = 0;
    this.damage = 0;
    this.tyreWear = 0;
    this.perf = 1.0;
    this.pullDir = 0;
    this.sputter = 0;
    this.sputterNext = 2.0;
    this.shake = 0;
    this.spinT = 0;
    this.spinDir = 0;
    this.offroad = 0;
    this.skid = 0;
    this.gear = 1;
    this.rpm = 0.2;
    this.skyOffset = 0;
    this.nearOffset = 0;
    this.pitting = false;
    this.inPitLane = false;
    this.activePitBay = 'NONE';
    this.pitStopTimer = 0;
    this.lollipopState = 'HIDDEN';
    this.lollipopGoTimer = 0;
    this.launchBoostTimer = 0;
    this.pitBayCrews = [
      createInitialBayCrew(PIT_BAY_TYRES.start),
      createInitialBayCrew(PIT_BAY_ENGINE.start),
    ];
    this.pitCrewProgress = [0, 0];
    this.pitCrewApproaching = [false, false];
    this.pitServicedCurrentStop = false;
    this.pitServicedBay = 'NONE';
    this.particles = [];
    this.countBeep = 0;

    const diffTop = [
      [0.78, 0.87],
      [0.86, 0.95],
      [0.92, 0.99],
      [0.97, 1.04],
    ][this.difficulty];

    this.cars = [];
    this.playerIdx = this.multiplayerActive ? this.localSlot : CAR_COUNT - 1;

    for (let i = 0; i < CAR_COUNT; i++) {
      const row = Math.trunc(i / 2);
      const col = i % 2;
      const x = col ? 0.45 : -0.45;
      const isPlayer = i === this.playerIdx;
      const topF = isPlayer ? 0.98 : diffTop[0] + (diffTop[1] - diffTop[0]) * ((CAR_COUNT - 1 - i) / CAR_COUNT);
      this.cars.push({
        slot: i,
        name: DRIVERS[i].name,
        platform: isPlayer ? 'AKA' : 'AI',
        isPlayer,
        isRemoteHuman: false,
        look: i,
        dist: -SEG_LEN * (3 + row * 6) - (col ? SEG_LEN * 2 : 0),
        x,
        speed: 0,
        steerVis: 0,
        braking: false,
        nitroOn: false,
        pitting: false,
        damage: 0,
        lapsDone: 0,
        lapStart: 0,
        lastLap: 0,
        bestLap: 0,
        finishTime: 0,
        finished: false,
        retired: false,
        place: i + 1,
        topFactor: topF,
        skill: isPlayer ? 0.9 : Math.max(0.3, 0.9 - i * 0.08),
        accelF: isPlayer ? 1.0 : 0.88 + (CAR_COUNT - i) * 0.015,
        laneBias: ((i % 3) - 1) * 0.25,
        targetX: x,
      });
    }

    if (withCountdown) {
      this.screenState = 'COUNTDOWN';
    } else {
      this.screenState = 'RACING';
      this.showBanner('GO!', [140, 255, 160], 1.1);
    }
  }

  // Place player on the pit lane so coasting (or braking) halts cleanly inside Stand 2 / Stand 3
  public teleportToPitApproach(presetDamage = 0.62) {
    const p = this.player();
    const lapBase = Math.max(0, p.lapsDone) * this.road.length;
    p.dist = lapBase + SEG_LEN * 16.5; // coasts hands-free to a smooth stop at seg ~21.5 (Stand 2), with Stand 3 just ahead
    p.x = 2.10; // centered in the pit box (1.72..2.48)
    p.speed = MAX_SPEED * 0.18; // ~43 km/h
    this.damage = presetDamage;
    this.tyreWear = 0.55;
    this.nitro = 0.35;
    this.pullDir = 0;
    this.pitBayCrews = [
      createInitialBayCrew(PIT_BAY_TYRES.start),
      createInitialBayCrew(PIT_BAY_ENGINE.start),
    ];
    this.pitCrewProgress = [0, 0];
    this.pitCrewApproaching = [false, false];
    this.pitServicedCurrentStop = false;
    this.pitServicedBay = 'NONE';
    this.pitting = false;
    this.lollipopState = 'HIDDEN';
    this.screenState = 'RACING';
    this.paused = false;
    this.showBanner('STANDS : ARRET A 0 KM/H DANS LE BOX JAUNE OU ROUGE', [255, 220, 95], 2.8);
  }

  public teleportToTunnelOrHighlight() {
    const p = this.player();
    const n = this.road.segs.length;
    let targetSeg = Math.trunc(n * 0.4);
    for (let i = 0; i < n; i++) {
      if (this.road.segs[i].flags & 2) {
        targetSeg = Math.max(0, i - 10);
        break;
      }
    }
    p.dist = Math.max(0, p.lapsDone) * this.road.length + targetSeg * SEG_LEN;
    p.x = 0;
    p.speed = MAX_SPEED * 0.78;
    this.screenState = 'RACING';
    this.paused = false;
    this.showBanner('SECTION SPECIALE CIRCUIT', [130, 230, 255], 1.8);
  }

  public triggerTestSpinAndDamage() {
    this.damage = Math.min(0.92, this.damage + 0.34);
    this.tyreWear = Math.min(0.95, this.tyreWear + 0.35);
    this.pullDir = this.pullDir === 0 ? 1 : -this.pullDir;
    this.spinT = 0.65;
    this.spinDir = 1;
    this.shake = 0.55;
    synthAudio.playSfx('crash');
    this.spawnBurst(160, 195, 22, [255, 190, 60]);
    this.showBanner(this.damage > 0.75 ? 'MOTEUR CRITIQUE ! STAND A DROITE !' : 'DEGATS MOTEUR + PNEUS', [255, 120, 80], 2.0);
  }

  private buildSceneryAndBackdrop() {
    const n = this.road.segs.length;
    this.propsBySeg = Array.from({ length: n }, () => []);
    let seed = (this.trackId + 1) * 198491317;
    const rnd = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return ((seed >>> 0) & 0xffff) / 65536;
    };

    const addP = (seg: number, spr: string, offset: number, flip = false, worldW = 900, hitW = 0.45) => {
      if (seg < 0 || seg >= n) return;
      // Keep the entire pit complex, outer stand apron, and pit exit sightline free of buildings/props
      const pi = pitIdxOf(seg, n);
      if (pi >= PIT_ENTRY - 2 && pi <= PIT_EXIT_END + 10 && offset > 0.88 && offset < 4.0) return;
      this.propsBySeg[seg].push({ seg, spr, offset, flip, worldW, hitW });
    };

    // Start gantry
    addP(4, 'GANTRY', 0, false, 4200, 0);

    // Curve chevrons
    for (let i = 10; i < n - 5; i += 5) {
      const c = this.road.segs[i].curve;
      if (Math.abs(c) >= 3.5 && !(this.road.segs[i].flags & 2)) {
        addP(i, 'CHEVRON', c > 0 ? -1.18 : 1.18, c < 0, 520, 0.4);
      }
    }

    const th = this.road.theme;
    for (let i = 16; i < n - 4; i++) {
      if (this.road.segs[i].flags & 2) continue;
      const side = rnd() < 0.5 ? -1 : 1;
      if (th === 0) {
        if (i % 6 === 0) addP(i, 'PALM', -1.42 - rnd() * 0.5, rnd() < 0.5, 1150, 0.25);
        if (i % 6 === 3) addP(i, 'PALM', 1.42 + rnd() * 0.5, rnd() < 0.5, 1150, 0.25);
        if (i % 10 === 0) addP(i, 'BUSH', side * (1.8 + rnd() * 2.0), false, 680, 0.5);
        if (i % 65 === 30) addP(i, 'BOARD', side * 1.65, false, 1100, 0.6);
      } else if (th === 1) {
        if (i % 4 === 0) addP(i, 'PINE', -(1.38 + rnd() * 0.9), false, 980, 0.32);
        if (i % 4 === 2) addP(i, 'PINE', 1.38 + rnd() * 0.9, false, 980, 0.32);
        if (i % 15 === 0) addP(i, 'ROCK', side * (1.6 + rnd() * 1.8), false, 850, 0.65);
        if (i % 48 === 20) addP(i, 'CHALET', side * 2.25, false, 1450, 0.75);
      } else if (th === 2) {
        if (i % 8 === 0) {
          addP(i, 'LAMP', -1.14, true, 540, 0.2);
          addP(i, 'LAMP', 1.14, false, 540, 0.2);
        }
        if (i % 5 === 0) addP(i, 'BUILDING', -(2.05 + rnd() * 0.4), false, 1650, 0.85);
        if (i % 5 === 2) addP(i, 'BUILDING', 2.05 + rnd() * 0.4, false, 1650, 0.85);
        if (i % 52 === 25) addP(i, 'NEON_BOARD', side * 1.62, false, 1150, 0.6);
      } else if (th === 3) {
        if (i % 6 === 0) addP(i, 'PALM', -1.4 - rnd() * 0.45, rnd() < 0.5, 1150, 0.25);
        if (i % 6 === 3) addP(i, 'PALM', 1.4 + rnd() * 0.45, rnd() < 0.5, 1150, 0.25);
        if (i % 14 === 4) addP(i, 'PARASOL', side * (1.55 + rnd() * 0.7), rnd() < 0.5, 760, 0.35);
        if (i === Math.trunc(n * 0.61)) addP(i, 'LIGHTHOUSE', 3.35, false, 1450, 0.7);
      } else if (th === 4) {
        if (i % 5 === 0) addP(i, 'ICE', -(1.42 + rnd() * 1.1), false, 880, 0.55);
        if (i % 5 === 2) addP(i, 'ICE', 1.42 + rnd() * 1.1, false, 880, 0.55);
        if (i % 9 === 4) addP(i, 'PINE_SNOW', side * (1.7 + rnd() * 1.4), false, 960, 0.32);
      } else {
        if (i % 9 === 0) {
          addP(i, 'LAMP', -1.15, true, 540, 0.2);
          addP(i, 'LAMP', 1.15, false, 540, 0.2);
        }
        if (i % 6 === 0) addP(i, 'CONTAINER', -(1.95 + rnd() * 0.5), false, 1450, 0.85);
        if (i % 6 === 3) addP(i, 'CONTAINER', 1.95 + rnd() * 0.5, false, 1450, 0.85);
        if (i % 28 === 14) addP(i, 'CRANE', side * 2.35, side < 0, 1850, 0.7);
        if (i === Math.trunc(n * 0.34)) addP(i, 'LIGHTHOUSE', 3.35, false, 1500, 0.7);
      }
    }

    for (let x = 0; x < 1024; x++) {
      const u = (x / 1024) * Math.PI * 2;
      if (th === 2 || th === 5) {
        const blk = Math.trunc(x / (th === 2 ? 18 : 22));
        const h1 = ((blk * 7919 + 17) % 41) + (th === 2 ? 20 : 12);
        this.farH[x] = h1;
        const blk2 = Math.trunc((x + 7) / (th === 2 ? 28 : 16));
        this.nearH[x] = ((blk2 * 3137 + 9) % 24) + 6;
      } else {
        const m1 = Math.sin(u * 3) * 0.45 + Math.sin(u * 7 + 1.2) * 0.3 + Math.sin(u * 15 + 2.4) * 0.15 + 0.5;
        this.farH[x] = Math.max(6, Math.min(92, Math.round((th === 1 || th === 4 ? 22 : 10) + m1 * (th === 1 ? 56 : 36))));
        const m2 = Math.sin(u * 8 + 0.7) * 0.5 + Math.sin(u * 19 + 1.9) * 0.3 + 0.5;
        this.nearH[x] = Math.max(4, Math.min(44, Math.round(6 + m2 * (th === 1 ? 24 : 14))));
      }
    }
  }

  public player(): SimCar {
    return this.cars[this.playerIdx] || this.cars[0];
  }

  public speedKmh(): number {
    return (this.player().speed / MAX_SPEED) * 240;
  }

  public cameraZ(): number {
    return this.player().dist - 839.1;
  }

  public carZ(c: SimCar): number {
    const z = c.dist % this.road.length;
    return z < 0 ? z + this.road.length : z;
  }

  public playerLap(): number {
    return Math.min(this.laps, this.player().lapsDone + 1);
  }

  public applyServerRoomState(payload: RoomStatePayload, mySlot: number) {
    this.multiplayerActive = true;
    this.localSlot = mySlot;
    this.playerIdx = mySlot;

    if (payload.trackId !== this.trackId || payload.laps !== this.laps) {
      this.setupRace(payload.trackId, payload.difficulty, payload.laps, payload.phase === 'COUNTDOWN');
    }

    if (payload.phase === 'COUNTDOWN' && this.screenState !== 'COUNTDOWN') {
      this.setupRace(payload.trackId, payload.difficulty, payload.laps, true);
      this.stateT = payload.phaseTime;
    } else if (
      payload.phase === 'RACING' &&
      (this.screenState === 'COUNTDOWN' || this.screenState === 'RESULTS' || this.screenState === 'TITLE')
    ) {
      this.screenState = 'RACING';
      this.raceTime = payload.raceTime;
      this.showBanner('GO!', [140, 255, 160], 1.1);
    } else if (payload.phase === 'RESULTS' && this.screenState !== 'RESULTS') {
      this.screenState = 'RESULTS';
      this.stateT = 0;
    }

    for (const sc of payload.cars) {
      const localCar = this.cars[sc.slot];
      if (!localCar) continue;
      localCar.name = sc.name;
      localCar.platform = sc.platform;
      localCar.look = sc.driverLook;
      localCar.isPlayer = sc.slot === mySlot;
      localCar.isRemoteHuman = sc.platform !== 'AI' && sc.slot !== mySlot;
      localCar.place = sc.place;

      if (sc.slot !== mySlot) {
        const delta = sc.dist - localCar.dist;
        localCar.dist = Math.abs(delta) > SEG_LEN * 10 ? sc.dist : localCar.dist + delta * 0.45;
        localCar.x += (sc.x - localCar.x) * 0.45;
        localCar.speed = sc.speed;
        localCar.steerVis = sc.steerVis;
        localCar.braking = sc.braking;
        localCar.nitroOn = sc.nitroOn;
        localCar.pitting = sc.pitting;
        localCar.damage = sc.damage;
        localCar.lapsDone = sc.lapsDone;
        localCar.bestLap = sc.bestLap;
        localCar.finishTime = sc.finishTime;
        localCar.finished = sc.finished;
        localCar.retired = sc.retired;
      } else if (payload.phase === 'COUNTDOWN') {
        localCar.dist = sc.dist;
        localCar.x = sc.x;
        localCar.speed = 0;
      }
    }
  }

  public getLocalTelemetry(): ClientCarTelemetry {
    const p = this.player();
    return {
      dist: p.dist,
      x: p.x,
      speed: p.speed,
      steerVis: p.steerVis,
      braking: p.braking,
      nitroOn: this.nitroOn,
      pitting: this.pitting,
      damage: this.damage,
      retired: p.retired,
    };
  }

  public spawnBurst(x: number, y: number, count: number, col: [number, number, number], kind: ParticleFx['kind'] = 'spark') {
    for (let i = 0; i < count && this.particles.length < 220; i++) {
      const ang = this.rand() * Math.PI * 2;
      const spd = 35 + this.rand() * 115;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 35,
        life: 0.25 + this.rand() * 0.45,
        maxLife: 0.65,
        r: col[0],
        g: col[1],
        b: col[2],
        size: kind === 'puff' ? 5 : 2,
        kind,
      });
    }
  }

  public step(dt: number, input: InputState) {
    const clampedDt = Math.min(0.05, Math.max(0.001, dt));
    this.globalTime += clampedDt;
    this.stateT += clampedDt;
    if (this.bannerTimer > 0) this.bannerTimer -= clampedDt;
    if (this.crashCooldown > 0) this.crashCooldown -= clampedDt;

    if (input.l1 && !this.prevL1) {
      if (this.inPitLane) {
        this.pitLimiterActive = !this.pitLimiterActive;
        this.showBanner(this.pitLimiterActive ? 'LIMITEUR STAND 85 KM/H' : 'LIMITEUR OFF', [130, 230, 255], 1.1);
      } else {
        this.features.compactHudL1 = !this.features.compactHudL1;
        this.showBanner(this.features.compactHudL1 ? 'HUD COMPACT AKA (L1)' : 'HUD COMPLET (L1)', [200, 225, 255], 1.0);
      }
      synthAudio.playSfx('menu');
    }
    this.prevL1 = input.l1;

    if (input.run && !this.prevRun && !this.multiplayerActive && this.screenState === 'RACING') {
      this.paused = !this.paused;
      synthAudio.playSfx('menu');
    }
    this.prevRun = input.run;

    if (this.paused) {
      synthAudio.updateEngine(0, false, 0, false, false);
      return;
    }

    if (this.screenState === 'COUNTDOWN') {
      if (this.countBeep < 3 && this.stateT >= 1.0 + this.countBeep) {
        this.countBeep++;
        synthAudio.playSfx('beep_low');
      }
      if (this.stateT >= 4.0 && !this.multiplayerActive) {
        synthAudio.playSfx('beep_high');
        this.screenState = 'RACING';
        this.stateT = 0;
        this.raceTime = 0;
        for (const c of this.cars) c.lapStart = 0;
        this.showBanner('GO!', [150, 255, 160], 1.2);
      }
      this.rpm += ((input.a ? 0.88 : 0.18) - this.rpm) * Math.min(1, clampedDt * 10);
      synthAudio.updateEngine(this.rpm, false, this.damage, false, true);
      return;
    }

    if (this.screenState === 'RESULTS') {
      if (!this.multiplayerActive && this.stateT > 1.0 && input.a) {
        this.setupRace(this.trackId, this.difficulty, this.laps, true);
      }
      synthAudio.updateEngine(0, false, 0, false, false);
      return;
    }

    this.raceTime += clampedDt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - clampedDt);
    if (this.spinT > 0) this.spinT = Math.max(0, this.spinT - clampedDt);
    if (this.lollipopGoTimer > 0) this.lollipopGoTimer = Math.max(0, this.lollipopGoTimer - clampedDt);
    if (this.launchBoostTimer > 0) this.launchBoostTimer = Math.max(0, this.launchBoostTimer - clampedDt);

    const p = this.player();
    const oldDist = p.dist;

    for (const c of this.cars) {
      if (c.isPlayer && this.screenState === 'RACING') {
        this.updatePlayerCar(c, clampedDt, input);
      } else if (!this.multiplayerActive) {
        this.updateLocalAiCar(c, clampedDt);
      }
    }

    this.handleCollisions(clampedDt);
    this.updatePitStops(clampedDt, input);
    this.updatePitCrewAnimations(clampedDt);

    if (!this.multiplayerActive) {
      for (const c of this.cars) this.updateLaps(c);
      this.computeRankings();
    } else {
      this.updateLaps(p);
    }

    const segIdx = Math.trunc(this.carZ(p) / SEG_LEN) % this.road.segs.length;
    const seg = this.road.segs[segIdx];
    const segsMoved = (p.dist - oldDist) / SEG_LEN;
    this.skyOffset = (((this.skyOffset + seg.curve * segsMoved * 0.8) % 1024) + 1024) % 1024;
    this.nearOffset = (((this.nearOffset + seg.curve * segsMoved * 1.7) % 1024) + 1024) % 1024;

    const gearTop = [0, 0.16, 0.31, 0.47, 0.63, 0.8, 1.4];
    const pct = p.speed / MAX_SPEED;
    let g = 1;
    while (g < 6 && pct > gearTop[g]) g++;
    this.gear = g;
    const lo = gearTop[g - 1];
    const hi = g === 6 ? 1.05 : gearTop[g];
    const targetRpm = 0.22 + 0.78 * Math.max(0, Math.min(1, (pct - lo) / (hi - lo)));
    this.rpm += (targetRpm - this.rpm) * Math.min(1, clampedDt * 12);

    this.updateParticles(clampedDt);

    synthAudio.updateEngine(
      this.rpm,
      this.nitroOn,
      this.damage,
      this.sputter > 0,
      this.screenState === 'RACING' && !p.retired
    );

    if (this.screenState === 'FINISHED' && !this.multiplayerActive && this.stateT > 3.5) {
      this.screenState = 'RESULTS';
      this.stateT = 0;
    }
  }

  private updatePlayerCar(p: SimCar, dt: number, input: InputState) {
    const n = this.road.segs.length;
    const segIdx = Math.trunc(this.carZ(p) / SEG_LEN) % n;
    const pitIdx = pitIdxOf(segIdx, n);
    const seg = this.road.segs[segIdx];
    const pct = p.speed / MAX_SPEED;
    const oldX = p.x;

    let gas = input.a;
    const brake = input.b || input.down;
    const nitroBtn = input.c;

    let targetSteer = 0;
    if (input.left) targetSteer = -1;
    else if (input.right) targetSteer = 1;
    else if (Math.abs(input.joyX) > 0.05) targetSteer = input.joyX;

    this.steer += (targetSteer - this.steer) * Math.min(1, dt * 9.5);
    p.steerVis += (this.steer - p.steerVis) * Math.min(1, dt * 5.8);
    p.braking = brake;

    const wasNitro = this.nitroOn;
    this.nitroOn = nitroBtn && this.nitro > 0.02 && gas && !this.inPitLane && !p.retired;
    p.nitroOn = this.nitroOn;
    if (this.nitroOn) {
      this.nitro = Math.max(0, this.nitro - dt / 3.0);
      if (!wasNitro) synthAudio.playSfx('nitro');
    } else {
      this.nitro = Math.min(1, this.nitro + dt / 28.0);
    }

    const gripFactor = 1.0 - this.tyreWear * 0.28;
    const dx = dt * 2.05 * Math.max(0.15, pct) * gripFactor;
    p.x += dx * this.steer;
    p.x -= dx * pct * seg.curve * (0.3 / gripFactor);

    if (this.damage > 0.45 && this.pullDir !== 0) {
      p.x += this.pullDir * (this.damage - 0.45) * 0.38 * pct * dt;
    }

    const dm = Math.max(0, Math.min(1, (this.damage - 0.25) / 0.75));
    this.perf = 1.0 - 0.52 * dm * (0.4 + 0.6 * dm);
    if (p.retired) {
      gas = false;
      this.nitroOn = false;
    }

    if (this.damage > 0.6 && !p.retired) {
      this.sputterNext -= dt;
      if (this.sputter > 0) this.sputter -= dt;
      else if (this.sputterNext <= 0) {
        this.sputter = 0.14 + 0.2 * this.rand();
        this.sputterNext = 1.8 * (0.6 + 0.7 * this.rand());
      }
    } else {
      this.sputter = 0;
    }

    const boostMult = (this.nitroOn ? 1.28 : 1.0) * (this.launchBoostTimer > 0 ? 1.22 : 1.0);
    const maxSpd = MAX_SPEED * this.perf * boostMult;

    if (brake) {
      p.speed = Math.max(0, p.speed - MAX_SPEED * 1.05 * dt);
    } else if (gas && this.sputter <= 0) {
      p.speed = Math.min(maxSpd, p.speed + (MAX_SPEED / 4.8) * this.perf * boostMult * dt * (1 - 0.35 * pct * pct));
    } else {
      p.speed = Math.max(0, p.speed - (MAX_SPEED / 5.2) * dt);
    }

    // Pit wall separation between road and pit complex (segments PIT_WALL_START_REPO .. PIT_WALL_END)
    if (segIdx >= PIT_WALL_START_REPO && segIdx <= PIT_WALL_END) {
      if (oldX < PIT_WALL_X && p.x > PIT_WALL_X - 0.045) {
        p.x = PIT_WALL_X - 0.045;
        if (p.speed > MAX_SPEED * 0.1) {
          p.speed -= MAX_SPEED * 0.5 * dt;
          this.shake = Math.max(this.shake, 0.15);
        }
      } else if (oldX >= PIT_WALL_X && p.x < PIT_WALL_X + 0.045) {
        p.x = PIT_WALL_X + 0.045;
        if (p.speed > MAX_SPEED * 0.1) {
          p.speed -= MAX_SPEED * 0.5 * dt;
          this.shake = Math.max(this.shake, 0.15);
        }
      }
    }

    const taper = pitTaperAt(pitIdx);
    const outer = pitOuterAt(taper);
    const inPitComplex = pitIdx >= PIT_ENTRY && pitIdx <= PIT_EXIT_END && p.x >= 1.04 && p.x <= outer + 0.45;
    const inServiceLane =
      pitIdx >= PIT_ENTRY &&
      pitIdx <= PIT_EXIT_END &&
      p.x >= pitInnerAt(pitIdx) - 0.12 &&
      p.x <= outer + 0.10;
    this.inPitLane = inServiceLane;

    if (inPitComplex) {
      this.offroad = 0;
      if (this.pitLimiterActive && p.speed > (85 / 240) * MAX_SPEED) {
        p.speed = Math.max((85 / 240) * MAX_SPEED, p.speed - MAX_SPEED * 0.9 * dt);
      }
    } else if (Math.abs(p.x) > 1.06) {
      this.offroad = Math.min(1, (Math.abs(p.x) - 1.0) * 2);
      this.tyreWear = Math.min(1, this.tyreWear + dt * 0.045 * pct);
      if (p.speed > MAX_SPEED * 0.28) {
        p.speed -= MAX_SPEED * 0.48 * dt;
      }
    } else {
      this.offroad = 0;
    }

    this.skid = Math.abs(this.steer) > 0.72 && pct > 0.55 ? Math.min(1, (Math.abs(this.steer) - 0.65) * 3) : 0;
    if (this.skid > 0.2) {
      this.tyreWear = Math.min(1, this.tyreWear + dt * 0.018 * this.skid);
    }

    p.x = Math.max(-2.8, Math.min(2.9, p.x));
    p.dist += p.speed * dt;
  }

  private updatePitStops(dt: number, input: InputState) {
    const p = this.player();
    const n = this.road.segs.length;
    const segIdx = Math.trunc(this.carZ(p) / SEG_LEN) % n;
    const pitIdx = pitIdxOf(segIdx, n);
    const kmh = this.speedKmh();
    const segFlags = this.road.segs[segIdx].flags;

    if ((segFlags & SEGF_MID_PIT) && p.x > 0.75 && p.x < 1.35 && this.nitro < 1.0) {
      this.activePitBay = 'MID_NITRO';
      this.nitro = Math.min(1, this.nitro + dt * 0.85);
      if (Math.trunc(this.globalTime * 16) % 2 === 0) {
        this.spawnBurst(160, 210, 2, [80, 230, 255], 'puff');
      }
      return;
    }

    // Launch boost when pressing gas right after Lollipop GO
    if (this.lollipopState === 'GO' && input.a && this.lollipopGoTimer > 0 && kmh > 3.0) {
      this.launchBoostTimer = 1.4;
      this.lollipopGoTimer = 0;
      this.lollipopState = 'HIDDEN';
      synthAudio.playSfx('nitro');
      this.showBanner('DEPART STAND PARFAIT !', [120, 255, 190], 1.5);
    }

    if (kmh > 10.0) {
      this.pitServicedCurrentStop = false;
      this.pitServicedBay = 'NONE';
    }

    if (!this.inPitLane || pitIdx < PIT_WALL_FIRST || pitIdx > PIT_WALL_END) {
      this.pitting = false;
      p.pitting = false;
      this.activePitBay = 'NONE';
      this.pitServicedCurrentStop = false;
      this.pitServicedBay = 'NONE';
      if (pitIdx > PIT_EXIT_END || !this.inPitLane) this.lollipopState = 'HIDDEN';
      for (let b = 0; b < 2; b++) {
        if (this.pitBayCrews[b].phase === 'WALKING_IN' || this.pitBayCrews[b].phase === 'WORKING') {
          this.pitBayCrews[b].phase = 'WALKING_OUT';
        }
      }
      return;
    }

    if (segIdx >= PIT_BAY_NITRO.start && segIdx <= PIT_BAY_NITRO.end) {
      this.activePitBay = 'NITRO';
      if (this.pitServicedBay !== 'NITRO') {
        this.pitServicedCurrentStop = false;
      }
      if (kmh <= PIT_BAY_NITRO.maxSpeedKmh && this.nitro < 1.0) {
        this.pitting = true;
        this.nitro = Math.min(1, this.nitro + dt * 1.35);
        this.spawnBurst(160, 205, 2, [70, 235, 255], 'puff');
        if (this.nitro >= 0.99) {
          synthAudio.playSfx('pit_done');
          this.showBanner('N2O RECHARGE 100%', [100, 245, 255], 1.3);
        }
      } else {
        this.pitting = false;
      }
    } else if (segIdx >= PIT_BAY_TYRES.start && segIdx <= PIT_BAY_TYRES.end) {
      this.activePitBay = 'TYRES';
      if (this.pitServicedBay !== 'TYRES') {
        this.pitServicedCurrentStop = false;
      }
      this.handleCrewedBay(0, 'TYRES', dt, kmh);
    } else if (segIdx >= PIT_BAY_ENGINE.start && segIdx <= PIT_BAY_ENGINE.end) {
      this.activePitBay = 'ENGINE';
      if (this.pitServicedBay !== 'ENGINE') {
        this.pitServicedCurrentStop = false;
      }
      this.handleCrewedBay(1, 'ENGINE', dt, kmh);
    } else {
      this.activePitBay = 'NONE';
      this.pitting = false;
    }

    p.pitting = this.pitting;
  }

  private handleCrewedBay(bayIdx: 0 | 1, bayType: 'TYRES' | 'ENGINE', dt: number, kmh: number) {
    const crew = this.pitBayCrews[bayIdx];
    const otherCrew = this.pitBayCrews[bayIdx === 0 ? 1 : 0];
    if (otherCrew.phase === 'WALKING_IN' || otherCrew.phase === 'WORKING') {
      otherCrew.phase = 'WALKING_OUT';
    }

    // If the car starts moving away while technicians are approaching or working, abort immediately
    if (kmh > 7.0) {
      if (crew.phase === 'WALKING_IN' || crew.phase === 'WORKING') {
        crew.phase = 'WALKING_OUT';
      }
      this.pitting = false;
      if (this.lollipopState === 'STOP' || this.lollipopState === 'READY') {
        this.lollipopState = 'HIDDEN';
      }
      return;
    }

    // Car has come to a stop (< 4 km/h) inside the pit box: dispatch technicians from outside!
    if (kmh < 4.0 && !this.pitServicedCurrentStop) {
      if (crew.phase === 'IDLE_OUTSIDE' || crew.phase === 'WALKING_OUT') {
        const p = this.player();
        crew.anchorZ = this.carZ(p);
        crew.anchorX = Math.max(1.80, Math.min(2.36, p.x));
        crew.workTimer = 0;
        crew.startDamage = this.damage;
        crew.startTyreWear = this.tyreWear;
        crew.startNitro = this.nitro;
        crew.workRequired =
          bayIdx === 0
            ? Math.max(1.85, 1.35 + this.tyreWear * 1.5 + Math.max(0, this.damage - 0.25) * 0.9)
            : Math.max(2.15, 1.55 + this.damage * 1.8 + this.tyreWear * 0.9 + (1 - this.nitro) * 0.5);
        crew.phase = 'WALKING_IN';
        this.pitStopTimer = 0;
        this.wrenchSfxTick = 0.2;
        this.showBanner(
          bayIdx === 0 ? 'STAND PNEUS : INTERVENTION EN COURS' : 'STAND MOTEUR : INTERVENTION EN COURS',
          [255, 220, 95],
          1.5
        );
      }

      this.pitting = true;
      this.pitStopTimer += dt;

      if (crew.phase === 'WALKING_IN') {
        this.lollipopState = 'STOP';
      } else if (crew.phase === 'WORKING') {
        // Technicians are now right beside the car — perform active work on the car!
        crew.workTimer += dt;
        const frac = Math.min(1, crew.workTimer / Math.max(0.1, crew.workRequired));
        this.lollipopState = crew.workRequired - crew.workTimer < 0.38 ? 'READY' : 'STOP';

        if (bayIdx === 0) {
          this.tyreWear = Math.max(0, crew.startTyreWear * (1 - frac));
          const targetDmg = Math.min(crew.startDamage, 0.22);
          this.damage = crew.startDamage + (targetDmg - crew.startDamage) * frac;
        } else {
          this.damage = Math.max(0, crew.startDamage * (1 - frac));
          this.tyreWear = Math.max(0, crew.startTyreWear * (1 - frac));
          this.nitro = Math.min(1, crew.startNitro + (1 - crew.startNitro) * frac);
        }

        this.wrenchSfxTick += dt;
        if (this.wrenchSfxTick >= 0.28) {
          this.wrenchSfxTick = 0;
          synthAudio.playSfx('pit_wrench');
          if (bayIdx === 1) {
            this.spawnBurst(160, 190, 2, [220, 230, 240], 'puff');
          }
        }

        // As soon as work is finished, technicians immediately step back and walk outside!
        if (crew.workTimer >= crew.workRequired) {
          if (bayIdx === 0) {
            this.tyreWear = 0;
            this.pullDir = 0;
          } else {
            this.damage = 0;
            this.tyreWear = 0;
            this.nitro = 1;
            this.pullDir = 0;
          }
          this.pitServicedCurrentStop = true;
          this.pitServicedBay = bayType;
          this.pitting = false;
          crew.phase = 'WALKING_OUT';
          this.lollipopState = 'GO';
          this.lollipopGoTimer = 3.2;
          synthAudio.playSfx('pit_done');
          this.showBanner(
            bayIdx === 0 ? 'PNEUS OK — EQUIPE DEGAGEE, GO!' : 'REVISION 100% — VOIE LIBRE, GO!',
            [130, 255, 175],
            2.1
          );
        }
      }
    } else {
      this.pitting = false;
      if (this.lollipopGoTimer <= 0 && this.lollipopState === 'GO') {
        this.lollipopState = 'HIDDEN';
      }
    }
  }

  private updatePitCrewAnimations(dt: number) {
    for (let b = 0; b < 2; b++) {
      const crew = this.pitBayCrews[b];
      if (crew.phase === 'WALKING_IN') {
        crew.progress = Math.min(1, crew.progress + dt * 1.18);
        this.pitCrewApproaching[b] = true;
        if (crew.progress >= 1) {
          crew.progress = 1;
          crew.phase = 'WORKING';
        }
      } else if (crew.phase === 'WORKING') {
        crew.progress = 1;
        this.pitCrewApproaching[b] = false;
      } else if (crew.phase === 'WALKING_OUT') {
        crew.progress = Math.max(0, crew.progress - dt * 1.32);
        this.pitCrewApproaching[b] = false;
        if (crew.progress <= 0) {
          crew.progress = 0;
          crew.phase = 'IDLE_OUTSIDE';
        }
      } else {
        crew.progress = 0;
        this.pitCrewApproaching[b] = false;
      }
      this.pitCrewProgress[b] = crew.progress;
    }
  }

  private handleCollisions(dt: number) {
    const p = this.player();
    const n = this.road.segs.length;
    const segIdx = Math.trunc(this.carZ(p) / SEG_LEN) % n;

    if (Math.abs(p.x) > 1.05 && !this.inPitLane && this.crashCooldown <= 0 && p.speed > MAX_SPEED * 0.15) {
      const props = this.propsBySeg[segIdx];
      for (const pr of props) {
        if (pr.hitW <= 0) continue;
        const w = pr.worldW / ROAD_W;
        const centre = pr.offset + (pr.offset > 0 ? w / 2 : -w / 2);
        const halfSum = (CAR_NORM_W + w * pr.hitW) * 0.5;
        if (Math.abs(p.x - centre) < halfSum) {
          this.crashCooldown = 0.55;
          const power = p.speed / MAX_SPEED;
          const soft = pr.spr === 'BUSH' || pr.spr === 'PARASOL';
          p.speed = soft ? p.speed * 0.72 : Math.min(p.speed, MAX_SPEED * 0.18);
          p.x += p.x > 0 ? -0.14 : 0.14;
          this.shake = soft ? 0.2 : 0.6;
          if (!soft) {
            this.spinT = 0.52;
            this.spinDir = p.x > 0 ? -1 : 1;
            const addDmg = 0.12 * (0.35 + 0.65 * power * power);
            this.damage = Math.min(1, this.damage + addDmg);
            if (this.pullDir === 0) this.pullDir = this.rand() < 0.5 ? -1 : 1;
            if (this.damage >= 1) {
              p.retired = true;
              this.showBanner('CASSE MOTEUR (DNF)', [255, 90, 80], 3.5);
              this.screenState = 'FINISHED';
              this.stateT = 0;
            }
          }
          synthAudio.playSfx(soft ? 'bump' : 'crash');
          this.spawnBurst(
            160 + (pr.offset > 0 ? 42 : -42),
            192,
            soft ? 10 : 20,
            soft ? [120, 210, 90] : [255, 195, 70]
          );
          break;
        }
      }
    }

    for (const other of this.cars) {
      if (other.slot === p.slot || other.retired) continue;
      let dz = this.carZ(other) - this.carZ(p);
      if (dz < -this.road.length / 2) dz += this.road.length;
      if (dz > this.road.length / 2) dz -= this.road.length;
      if (Math.abs(dz) < SEG_LEN * 0.85 && Math.abs(other.x - p.x) < CAR_NORM_W * 0.85) {
        if (dz > 0 && p.speed > other.speed) {
          p.speed = other.speed * 0.85;
          p.dist -= SEG_LEN * 0.35;
          if (this.crashCooldown <= 0) {
            this.crashCooldown = 0.4;
            this.shake = 0.28;
            this.damage = Math.min(1, this.damage + 0.035);
            synthAudio.playSfx('bump');
            this.spawnBurst(160, 188, 10, [255, 220, 110]);
          }
        }
        const push = (p.x < other.x ? -1 : 1) * 0.8 * dt;
        p.x += push;
      }
    }
  }

  private updateLocalAiCar(c: SimCar, dt: number) {
    if (c.retired) return;
    const n = this.road.segs.length;
    const idx = Math.trunc(this.carZ(c) / SEG_LEN) % n;
    let maxCurve = 0;
    let curveSum = 0;
    for (let k = 1; k <= 16; k++) {
      const cv = this.road.segs[(idx + k) % n].curve;
      if (Math.abs(cv) > maxCurve) maxCurve = Math.abs(cv);
      curveSum += cv;
    }

    let desiredX = c.laneBias;
    if (Math.abs(curveSum) > 8) desiredX = curveSum > 0 ? 0.5 * c.skill : -0.5 * c.skill;
    c.targetX += (desiredX - c.targetX) * Math.min(1, dt * 3);
    const dx = c.targetX - c.x;
    c.x += Math.max(-1.3 * dt, Math.min(1.3 * dt, dx * 2.4 * dt));
    c.steerVis = Math.max(-1, Math.min(1, dx * 2.4 - this.road.segs[idx].curve * 0.11));

    const cornerFactor = maxCurve > 3.5 ? Math.max(0.66, 1 - (maxCurve - 3) * 0.06) : 1;
    const top = MAX_SPEED * c.topFactor * cornerFactor;
    if (c.speed < top) {
      c.speed = Math.min(top, c.speed + (MAX_SPEED / 5) * c.accelF * dt);
      c.braking = false;
    } else {
      c.speed = Math.max(top, c.speed - MAX_SPEED * 0.65 * dt);
      c.braking = true;
    }
    c.dist += c.speed * dt;
  }

  private updateLaps(c: SimCar) {
    const done = c.dist >= 0 ? Math.trunc(c.dist / this.road.length) : 0;
    if (done > c.lapsDone) {
      c.lapsDone = done;
      c.lastLap = this.raceTime - c.lapStart;
      c.lapStart = this.raceTime;
      const isBest = c.bestLap === 0 || c.lastLap < c.bestLap;
      if (isBest && c.lastLap > 3) c.bestLap = c.lastLap;

      if (c.isPlayer) {
        synthAudio.playSfx('lap');
        if (done === this.laps - 1) this.showBanner('DERNIER TOUR !', [255, 130, 120], 2.0);
        else if (this.damage > 0.35) this.showBanner('STAND A DROITE !', [255, 220, 100], 2.0);
        else if (isBest && done > 1) this.showBanner('MEILLEUR TOUR !', [140, 255, 195], 1.8);
      }
    }
    if (!c.finished && done >= this.laps) {
      c.finished = true;
      c.finishTime = this.raceTime;
      if (c.isPlayer && this.screenState === 'RACING') {
        this.screenState = 'FINISHED';
        this.stateT = 0;
        synthAudio.playSfx('lap');
        this.showBanner(c.place === 1 ? 'VICTOIRE ! 1ER !' : `ARRIVEE P${c.place} !`, [255, 240, 120], 3.2);
      }
    }
  }

  private computeRankings() {
    const sorted = [...this.cars].sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished) return a.finishTime - b.finishTime;
      return b.dist - a.dist;
    });
    for (let i = 0; i < sorted.length; i++) sorted[i].place = i + 1;
  }

  private updateParticles(dt: number) {
    if (this.damage > 0.45 && Math.trunc(this.globalTime * 24) % 2 === 0 && this.particles.length < 200) {
      const dark = this.damage > 0.75 ? 45 : 130;
      this.particles.push({
        x: 160 + (this.rand() - 0.5) * 26,
        y: 205,
        vx: (this.rand() - 0.5) * 24,
        vy: -32 - this.rand() * 20,
        life: 0.55,
        maxLife: 0.55,
        r: dark,
        g: dark,
        b: dark + 8,
        size: 5,
        kind: 'puff',
      });
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.kind !== 'puff') pt.vy += 120 * dt;
    }
  }
}
