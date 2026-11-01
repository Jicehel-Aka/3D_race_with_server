import {
  CAM_DEPTH,
  CAM_HEIGHT,
  CAR_COUNT,
  DRIVERS,
  HORIZON_Y,
  MAX_SPEED,
  PIT_BAY_ENGINE,
  PIT_BAY_NITRO,
  PIT_BAY_TYRES,
  PIT_LANE_X0,
  PIT_LANE_X1,
  PIT_V11,
  PIT_WALL_END,
  PIT_WALL_FIRST,
  PIT_WALL_X,
  ROAD_W,
  SCREEN_H,
  SCREEN_W,
  SEGF_ALT,
  SEGF_MID_PIT,
  SEGF_START,
  SEGF_TUNNEL,
  SEG_LEN,
  THEME_ALPINE,
  THEME_CITY,
  THEME_COAST,
  THEME_GLACIER,
  THEME_HARBOR,
  THEME_TROPIC,
} from '../shared/raceProtocol';
import {
  CAR_ART3Q_W,
  CAR_ART_H,
  CAR_ART_MID,
  CAR_ART_W,
  blendContinuousStage,
  getCarArtAtlasSync,
  getUnifiedRigidFrame,
  type CarSpriteFrame,
} from './carArt3D';
import type { AkaRaceSimulator, SimCar, SimProp } from './raceSim';

interface ThemeColors {
  skyTop: [number, number, number];
  skyMid: [number, number, number];
  skyHor: [number, number, number];
  fog: [number, number, number];
  fogDensity: number;
  grass1: [number, number, number];
  grass2: [number, number, number];
  alt1: [number, number, number];
  alt2: [number, number, number];
  rumble1: [number, number, number];
  rumble2: [number, number, number];
  road1: [number, number, number];
  road2: [number, number, number];
  lane: [number, number, number];
  farCol: [number, number, number];
  farHi: [number, number, number];
  nearCol: [number, number, number];
  ambient: number; // 256 = full daylight
}

const THEMES: ThemeColors[] = [
  // 0: Sunset Coast
  {
    skyTop: [36, 18, 78], skyMid: [152, 46, 98], skyHor: [255, 146, 86],
    fog: [228, 120, 96], fogDensity: 3.4,
    grass1: [38, 128, 62], grass2: [32, 114, 54],
    alt1: [216, 182, 120], alt2: [198, 166, 108],
    rumble1: [228, 52, 48], rumble2: [244, 242, 236],
    road1: [76, 78, 92], road2: [70, 72, 86], lane: [240, 236, 220],
    farCol: [96, 46, 98], farHi: [220, 112, 124], nearCol: [54, 34, 68],
    ambient: 236,
  },
  // 1: Alpine Pass
  {
    skyTop: [28, 86, 178], skyMid: [96, 162, 230], skyHor: [204, 228, 250],
    fog: [196, 220, 244], fogDensity: 3.8,
    grass1: [62, 134, 68], grass2: [52, 118, 58],
    alt1: [228, 238, 250], alt2: [210, 224, 242],
    rumble1: [216, 46, 46], rumble2: [248, 248, 252],
    road1: [82, 86, 98], road2: [74, 78, 90], lane: [244, 246, 250],
    farCol: [98, 122, 164], farHi: [248, 252, 255], nearCol: [42, 78, 64],
    ambient: 256,
  },
  // 2: Neon City
  {
    skyTop: [8, 8, 26], skyMid: [22, 16, 56], skyHor: [58, 28, 92],
    fog: [42, 24, 74], fogDensity: 3.6,
    grass1: [22, 24, 38], grass2: [18, 20, 32],
    alt1: [28, 30, 48], alt2: [24, 26, 42],
    rumble1: [0, 218, 245], rumble2: [235, 45, 165],
    road1: [44, 46, 64], road2: [38, 40, 58], lane: [120, 230, 255],
    farCol: [24, 22, 52], farHi: [255, 80, 190], nearCol: [16, 16, 36],
    ambient: 158,
  },
  // 3: Palm Bay
  {
    skyTop: [16, 118, 216], skyMid: [76, 184, 244], skyHor: [186, 238, 252],
    fog: [176, 232, 246], fogDensity: 3.2,
    grass1: [58, 168, 72], grass2: [48, 152, 62],
    alt1: [242, 218, 158], alt2: [228, 204, 144],
    rumble1: [240, 74, 58], rumble2: [252, 250, 244],
    road1: [88, 90, 102], road2: [80, 82, 94], lane: [250, 250, 246],
    farCol: [48, 134, 126], farHi: [130, 204, 150], nearCol: [42, 118, 72],
    ambient: 256,
  },
  // 4: Glacier Run
  {
    skyTop: [10, 18, 44], skyMid: [22, 46, 86], skyHor: [88, 132, 178],
    fog: [118, 158, 204], fogDensity: 3.9,
    grass1: [212, 228, 248], grass2: [194, 214, 238],
    alt1: [132, 188, 232], alt2: [114, 170, 218],
    rumble1: [56, 166, 246], rumble2: [246, 250, 255],
    road1: [68, 82, 106], road2: [60, 74, 98], lane: [224, 242, 255],
    farCol: [88, 106, 148], farHi: [246, 250, 255], nearCol: [42, 64, 92],
    ambient: 205,
  },
  // 5: Night Harbor
  {
    skyTop: [8, 14, 28], skyMid: [18, 30, 54], skyHor: [68, 56, 64],
    fog: [46, 44, 58], fogDensity: 3.7,
    grass1: [38, 42, 54], grass2: [32, 36, 48],
    alt1: [52, 58, 72], alt2: [44, 50, 64],
    rumble1: [242, 156, 38], rumble2: [44, 48, 58],
    road1: [52, 56, 68], road2: [46, 50, 62], lane: [238, 196, 98],
    farCol: [24, 30, 46], farHi: [255, 190, 92], nearCol: [18, 22, 34],
    ambient: 162,
  },
];

interface ProjSeg {
  idx: number;
  valid: boolean;
  clip: number;
  fog: number;
  s1: number;
  s2: number;
  x1: number;
  y1: number;
  w1: number;
  x2: number;
  y2: number;
  w2: number;
}

const DRAW_DIST = 115;

export class Renderer320x240 {
  private imgData: ImageData | null = null;
  private buf32: Uint32Array = new Uint32Array(SCREEN_W * SCREEN_H);
  private pSegs: ProjSeg[] = Array.from({ length: DRAW_DIST }, () => ({
    idx: 0, valid: false, clip: SCREEN_H, fog: 0,
    s1: 0, s2: 0, x1: 0, y1: 0, w1: 0, x2: 0, y2: 0, w2: 0,
  }));

  private pack(r: number, g: number, b: number): number {
    return (255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
  }

  private mixRgb(
    a: [number, number, number],
    b: [number, number, number],
    t256: number
  ): [number, number, number] {
    const inv = 256 - t256;
    return [
      ((a[0] * inv + b[0] * t256) >> 8) & 255,
      ((a[1] * inv + b[1] * t256) >> 8) & 255,
      ((a[2] * inv + b[2] * t256) >> 8) & 255,
    ];
  }

  private pset(x: number, y: number, r: number, g: number, b: number) {
    if (x < 0 || x >= SCREEN_W || y < 0 || y >= SCREEN_H) return;
    this.buf32[y * SCREEN_W + x] = (255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
  }

  private blendPixel(x: number, y: number, r: number, g: number, b: number, alpha256: number) {
    if (x < 0 || x >= SCREEN_W || y < 0 || y >= SCREEN_H || alpha256 <= 0) return;
    const idx = y * SCREEN_W + x;
    const cur = this.buf32[idx];
    const cr = cur & 255;
    const cg = (cur >> 8) & 255;
    const cb = (cur >> 16) & 255;
    const inv = 256 - alpha256;
    const nr = (cr * inv + r * alpha256) >> 8;
    const ng = (cg * inv + g * alpha256) >> 8;
    const nb = (cb * inv + b * alpha256) >> 8;
    this.buf32[idx] = (255 << 24) | (nb << 16) | (ng << 8) | nr;
  }

  private fillSpan(y: number, x0: number, x1: number, col32: number) {
    if (y < 0 || y >= SCREEN_H) return;
    const a = Math.max(0, Math.trunc(x0));
    const b = Math.min(SCREEN_W, Math.trunc(x1));
    if (a >= b) return;
    this.buf32.fill(col32, y * SCREEN_W + a, y * SCREEN_W + b);
  }

  public renderFrame(ctx: CanvasRenderingContext2D, sim: AkaRaceSimulator) {
    if (!this.imgData) {
      this.imgData = ctx.createImageData(SCREEN_W, SCREEN_H);
      this.buf32 = new Uint32Array(this.imgData.data.buffer);
    }

    const th = THEMES[sim.road.theme] || THEMES[0];
    const t = sim.globalTime;
    const animOn = sim.features.circuitAnimV12;

    // 1. Sky + Real-Time Circuit Sky Animations
    this.drawSkyAndBackdrops(sim, th, animOn ? t : 0, animOn);

    // 2. Road projection + Separated 3-Bay Pit Lane + Tunnel Arches
    this.drawRoadAndSprites(sim, th, animOn ? t : 0, animOn);

    // 3. Particles + Weather Overlays (Alpine snow / Glacier ice crystals)
    this.drawParticlesAndWeather(sim, animOn);

    // Commit 320x240 pixel buffer to Canvas
    ctx.putImageData(this.imgData, 0, 0);

    // 4. Crisp Arcade HUD, Pit Crew Telemetry Board, Countdown Lights & Multiplayer Tags
    this.drawHudAndOverlays(ctx, sim);
  }

  private drawSkyAndBackdrops(sim: AkaRaceSimulator, th: ThemeColors, t: number, animOn: boolean) {
    const themeId = sim.road.theme;
    const skyOff = Math.trunc(sim.skyOffset * 0.5) & 1023;
    const farOff = Math.trunc(sim.skyOffset) & 1023;
    const nearOff = Math.trunc(sim.nearOffset) & 1023;

    // Base Sky Gradient
    for (let y = 0; y < HORIZON_Y + 6; y++) {
      const f = y / (HORIZON_Y + 6);
      const col = f < 0.55
        ? this.mixRgb(th.skyTop, th.skyMid, Math.trunc((f / 0.55) * 256))
        : this.mixRgb(th.skyMid, th.skyHor, Math.trunc(((f - 0.55) / 0.45) * 256));
      this.fillSpan(y, 0, SCREEN_W, this.pack(col[0], col[1], col[2]));
    }

    // Theme-specific Sky & Horizon Animations
    if (themeId === THEME_COAST) {
      // Retro Synthwave Sun with animated slice shimmer!
      const sunX = ((600 - skyOff) % 1024 + 1024) % 1024;
      const sx = sunX > 512 ? sunX - 1024 : sunX;
      if (sx > -50 && sx < SCREEN_W + 50) {
        const cy = HORIZON_Y - 22;
        const rad = 32;
        const sliceShift = animOn ? (t * 3.2) % 7 : 0;
        for (let dy = -rad; dy <= rad; dy++) {
          if (dy > 2) {
            const band = dy - 2 + sliceShift;
            const gap = 1 + Math.trunc((dy - 2) / 7);
            if ((band % 7) < gap) continue;
          }
          const dx = Math.trunc(Math.sqrt(rad * rad - dy * dy));
          const ratio = Math.trunc(((dy + rad) / (2 * rad)) * 256);
          const sc = this.mixRgb([255, 246, 140], [255, 65, 130], ratio);
          this.fillSpan(cy + dy, sx - dx, sx + dx + 1, this.pack(sc[0], sc[1], sc[2]));
        }
      }
      // Drifting evening clouds + flapping seabirds!
      const cloudDrift = animOn ? Math.trunc(t * 9) : 0;
      for (let k = 0; k < 8; k++) {
        const cx = (((k * 137 + 40 + cloudDrift) - skyOff) % 1024 + 1024) % 1024;
        const y = 20 + ((k * 37) % 52);
        const len = 36 + ((k * 29) % 55);
        if (cx < SCREEN_W + len) {
          for (let i = 0; i < len; i++) this.blendPixel(cx - len / 2 + i, y, 255, 175, 195, 110);
        }
      }
      if (animOn) {
        for (let b = 0; b < 5; b++) {
          const bx = (((180 + b * 46 + Math.trunc(t * 22)) - skyOff) % 1024 + 1024) % 1024;
          const by = 32 + b * 6 + Math.round(Math.sin(t * 3 + b) * 3);
          const flap = Math.round(Math.sin(t * 9 + b * 1.4) * 2);
          for (let dx = -3; dx <= 3; dx++) {
            this.pset(bx + dx, by - Math.abs(dx) * (flap >= 0 ? 1 : 0) + (dx === 0 ? 1 : 0), 38, 18, 48);
          }
        }
      }
    } else if (themeId === THEME_GLACIER) {
      // Stars + LIVE UNDULATING AURORA BOREALIS CURTAINS!
      for (let k = 0; k < 55; k++) {
        const sx = (((k * 193 + 11) - skyOff) % 1024 + 1024) % 1024;
        if (sx < SCREEN_W) {
          const sy = (k * 61) % (HORIZON_Y - 34);
          this.pset(sx, sy, 220, 232, 255);
        }
      }
      for (let x = 0; x < SCREEN_W; x += 2) {
        const ph = (((x + skyOff) % 1024) / 1024) * Math.PI * 2;
        const waveT = animOn ? t * 1.65 : 0;
        const yc = 30 + 11 * Math.sin(ph * 2 + waveT) + 5 * Math.sin(ph * 5 - waveT * 1.4);
        const colorMix = Math.trunc((0.5 + 0.5 * Math.sin(ph * 3 + waveT * 0.8)) * 200);
        const ac = this.mixRgb([64, 255, 168], [156, 92, 255], colorMix);
        const shimmer = 0.65 + 0.35 * Math.sin(ph * 7 + waveT * 2.3);
        for (let dy = 0; dy < 28; dy++) {
          const alpha = Math.trunc((1 - dy / 28) * 135 * shimmer);
          this.blendPixel(x, Math.trunc(yc + dy), ac[0], ac[1], ac[2], alpha);
          this.blendPixel(x + 1, Math.trunc(yc + dy), ac[0], ac[1], ac[2], alpha);
        }
      }
    } else if (themeId === THEME_CITY || themeId === THEME_HARBOR) {
      // Twinkling night stars + sweeping club / port searchlights!
      for (let k = 0; k < 50; k++) {
        const sx = (((k * 211 + 7) - skyOff) % 1024 + 1024) % 1024;
        if (sx < SCREEN_W) {
          const sy = (k * 43) % (HORIZON_Y - 30);
          const tw = animOn ? Math.trunc(155 + 100 * Math.sin(t * 4.5 + k)) : 200;
          this.blendPixel(sx, sy, 245, 245, 255, tw);
        }
      }
      // Sweeping searchlights!
      for (let b = 0; b < 2; b++) {
        const basePx = b === 0 ? 190 : 720;
        const bx = (((basePx - skyOff) % 1024) + 1024) % 1024;
        const bxSigned = bx > 650 ? bx - 1024 : bx;
        const sweep = animOn ? Math.sin(t * (1.2 + b * 0.45) + b * 2.1) * 0.85 : (b ? -0.6 : 0.6);
        for (let dy = 0; dy < HORIZON_Y - 12; dy += 2) {
          const cx = Math.trunc(bxSigned + sweep * dy);
          const hw = 2 + Math.trunc(dy / 9);
          const col = themeId === THEME_CITY ? (b ? [255, 70, 210] : [60, 235, 255]) : [210, 232, 255];
          for (let xx = cx - hw; xx <= cx + hw; xx++) {
            this.blendPixel(xx, HORIZON_Y - 2 - dy, col[0], col[1], col[2], 34);
            this.blendPixel(xx, HORIZON_Y - 3 - dy, col[0], col[1], col[2], 34);
          }
        }
      }
    }

    // Far Mountain / City Skyline Silhouette
    const baseY = HORIZON_Y + 4;
    for (let x = 0; x < SCREEN_W; x++) {
      const col = (x + farOff) & 1023;
      const h = sim.farH[col];
      const top = Math.max(0, baseY - h);
      for (let y = top; y < baseY; y++) {
        const alt = baseY - y;
        let c = th.farCol;
        if ((themeId === THEME_ALPINE || themeId === THEME_GLACIER) && alt > h * 0.58) {
          c = th.farHi;
        } else if (themeId === THEME_CITY || themeId === THEME_HARBOR) {
          // Animated blinking skyline windows!
          if (alt > 4 && alt < h - 3 && (col & 3) === 0 && (y & 3) === 0) {
            const winHash = (col * 131 + y * 17) & 15;
            const blinkSlot = animOn ? Math.trunc(t * 1.8 + winHash) % 9 : 1;
            if (winHash < 6 && blinkSlot !== 0) {
              c = th.farHi;
            }
          }
        }
        this.pset(x, y, c[0], c[1], c[2]);
      }
    }

    // Alpine Pass Cable Car (Télécabine) gliding between mountain peaks!
    if (themeId === THEME_ALPINE && animOn) {
      const wireX0 = (((240 - farOff) % 1024) + 1024) % 1024;
      if (wireX0 < SCREEN_W + 80) {
        const wx0 = wireX0 - 60;
        const wx1 = wireX0 + 90;
        for (let x = wx0; x <= wx1; x++) {
          const u = (x - wx0) / (wx1 - wx0);
          const wy = Math.round(58 + u * 16 + Math.sin(u * Math.PI) * 5);
          this.pset(x, wy, 60, 74, 96);
        }
        const cabU = 0.5 + 0.42 * Math.sin(t * 0.45);
        const cabX = Math.round(wx0 + cabU * (wx1 - wx0));
        const cabY = Math.round(58 + cabU * 16 + Math.sin(cabU * Math.PI) * 5);
        for (let dy = 2; dy <= 6; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            this.pset(cabX + dx, cabY + dy, dy === 3 ? 240 : 215, dy === 3 ? 248 : 38, dy === 3 ? 255 : 42);
          }
        }
        this.pset(cabX, cabY + 1, 50, 50, 60);
      }
    }

    // Neon City Express Cyber-Monorail streaking across skyline!
    if (themeId === THEME_CITY && animOn) {
      const railY = baseY - 12;
      this.fillSpan(railY + 2, 0, SCREEN_W, this.pack(34, 28, 66));
      const trainX = (((Math.trunc(t * 135) - farOff) % 512) + 512) % 512 - 90;
      for (let tx = 0; tx < 56; tx++) {
        const px = trainX + tx;
        if (px >= 0 && px < SCREEN_W) {
          this.pset(px, railY - 1, 40, 235, 255);
          this.pset(px, railY, tx % 5 === 0 ? 30 : 255, tx % 5 === 0 ? 40 : 120, 245);
          this.pset(px, railY + 1, 90, 60, 160);
        }
      }
    }

    // Animated Sea Band for Palm Bay & Night Harbor (rolling waves + bobbing sailboats / blinking ships!)
    if (themeId === THEME_TROPIC || themeId === THEME_HARBOR) {
      const seaH = 12;
      const harbor = themeId === THEME_HARBOR;
      const waveShift = animOn ? Math.trunc(t * 14) : 0;
      for (let x = 0; x < SCREEN_W; x++) {
        const col = (x + farOff) & 1023;
        for (let k = 0; k < seaH; k++) {
          const y = baseY - seaH + k;
          let c = harbor
            ? this.mixRgb([32, 54, 88], [10, 20, 40], Math.trunc((k / seaH) * 256))
            : this.mixRgb([145, 232, 235], [18, 142, 192], Math.trunc((k / seaH) * 256));
          if (((col + waveShift * (k % 2 ? 1 : -1) + k * 13) % 19) === 0) {
            c = harbor ? [255, 195, 95] : [255, 255, 255];
          }
          this.pset(x, y, c[0], c[1], c[2]);
        }
      }

      if (!harbor) {
        // Bobbing & sailing catamarans on Palm Bay!
        for (const baseBoat of [160, 520, 860]) {
          const drift = animOn ? Math.trunc(t * 6) : 0;
          const sx = (((baseBoat + drift - farOff) % 1024) + 1024) % 1024;
          if (sx < SCREEN_W + 10) {
            const bob = animOn ? Math.round(Math.sin(t * 3.2 + baseBoat) * 1) : 0;
            const by = baseY - 2 + bob;
            for (let dx = -5; dx <= 5; dx++) this.pset(sx + dx, by, 230, 72, 58);
            for (let sy = 1; sy <= 11; sy++) {
              const w = Math.max(1, Math.trunc(((12 - sy) * 5) / 11));
              for (let dx = -w; dx <= 1; dx++) this.pset(sx + dx, by - sy, 252, 252, 255);
            }
          }
        }
      } else {
        // Cargo ship with blinking red mast warning beacon in Night Harbor!
        for (const shipCol of [310, 760]) {
          const sx = (((shipCol - farOff) % 1024) + 1024) % 1024;
          if (sx < SCREEN_W + 40) {
            const by = baseY - 1;
            for (let dx = 0; dx < 38; dx++) {
              for (let y = by - 4; y <= by; y++) this.pset(sx + dx, y, y === by ? 135 : 28, 32, 46);
              if (dx % 4 === 2) this.pset(sx + dx, by - 2, 255, 210, 110);
            }
            const blinkOn = !animOn || Math.trunc(t * 3) % 2 === 0;
            if (blinkOn) {
              this.pset(sx + 32, by - 9, 255, 45, 50);
              this.pset(sx + 33, by - 9, 255, 95, 80);
            }
          }
        }
      }
    }

    // Near Layer Silhouette
    for (let x = 0; x < SCREEN_W; x++) {
      const col = (x + nearOff) & 1023;
      const h = sim.nearH[col];
      if (themeId === THEME_HARBOR && ((col >> 4) % 3) === 0) continue;
      for (let y = Math.max(0, baseY - h); y < baseY + 2; y++) {
        this.pset(x, y, th.nearCol[0], th.nearCol[1], th.nearCol[2]);
      }
    }
  }

  private drawRoadAndSprites(sim: AkaRaceSimulator, th: ThemeColors, t: number, animOn: boolean) {
    const N = sim.road.segs.length;
    const pl = sim.player();
    let camZ = sim.cameraZ() % sim.road.length;
    if (camZ < 0) camZ += sim.road.length;
    const baseIdx = Math.trunc(camZ / SEG_LEN) % N;
    const basePct = (camZ % SEG_LEN) / SEG_LEN;
    const baseSeg = sim.road.segs[baseIdx];

    const plZ = sim.carZ(pl);
    const plIdx = Math.trunc(plZ / SEG_LEN) % N;
    const plPct = (plZ % SEG_LEN) / SEG_LEN;
    const plSeg = sim.road.segs[plIdx];
    const playerY = plSeg.y1 + (plSeg.y2 - plSeg.y1) * plPct;

    const shakeX = sim.shake > 0 ? Math.sin(t * 85) * sim.shake * 110 : 0;
    const camX = pl.x * ROAD_W + shakeX;
    const camY = playerY + CAM_HEIGHT;

    let maxy = SCREEN_H;
    let x = 0;
    let dx = -(baseSeg.curve * basePct);

    for (let n = 0; n < DRAW_DIST; n++) {
      const gi = baseIdx + n;
      const i = gi % N;
      const sg = sim.road.segs[i];
      const ps = this.pSegs[n];
      ps.idx = i;
      ps.clip = maxy;
      const d = n / DRAW_DIST;
      ps.fog = Math.min(250, Math.trunc((1 - 1 / Math.exp(d * d * th.fogDensity)) * 256));

      let z1 = gi * SEG_LEN - camZ;
      const z2 = (gi + 1) * SEG_LEN - camZ;
      ps.valid = z1 > 1;
      if (z2 <= 1) {
        x += dx;
        dx += sg.curve;
        continue;
      }
      if (z1 < 1) z1 = 1;

      const s1 = CAM_DEPTH / z1;
      const s2 = CAM_DEPTH / z2;
      ps.s1 = s1;
      ps.s2 = s2;
      ps.x1 = SCREEN_W / 2 + s1 * -(camX - x) * (SCREEN_W / 2);
      ps.y1 = SCREEN_H / 2 - s1 * (sg.y1 - camY) * (SCREEN_H / 2);
      ps.w1 = s1 * ROAD_W * (SCREEN_W / 2);
      ps.x2 = SCREEN_W / 2 + s2 * -(camX - x - dx) * (SCREEN_W / 2);
      ps.y2 = SCREEN_H / 2 - s2 * (sg.y2 - camY) * (SCREEN_H / 2);
      ps.w2 = s2 * ROAD_W * (SCREEN_W / 2);

      x += dx;
      dx += sg.curve;

      if (z1 <= CAM_DEPTH || ps.y2 >= ps.y1 || ps.y2 >= maxy) continue;
      this.drawSegmentRows(sim, ps, maxy, th, sg.flags, t, animOn);
      maxy = Math.max(0, Math.ceil(ps.y2));
    }

    // Back-to-front Scenery, Tunnel Arches, Remote/AI Cars, Pit Crew, and Player Car!
    let plN = -1;
    for (let n = 0; n < DRAW_DIST; n++) {
      if (this.pSegs[n].idx === plIdx) {
        plN = n;
        break;
      }
    }

    const inTunnelPlayer = Boolean(plSeg.flags & SEGF_TUNNEL) && animOn;

    for (let n = DRAW_DIST - 1; n > 0; n--) {
      const ps = this.pSegs[n];
      if (!ps.valid) continue;
      const sg = sim.road.segs[ps.idx];

      // v1.2 Tunnel Overhead Ribs & Sodium Ceiling Lamps (completes track.h SEGF_TUNNEL!)
      if (animOn && (sg.flags & SEGF_TUNNEL) && ps.w1 > 4) {
        this.drawTunnelPortal(ps, th, sim.road.theme);
      }

      // Roadside Scenery Props
      const props = sim.propsBySeg[ps.idx];
      if (props) {
        for (const pr of props) {
          this.drawSceneryProp(sim, ps, pr, th, t, animOn);
        }
      }

      // v1.2 Pit Crew Mechanics & Lollipop Man standing at Bay 3!
      if (sim.features.pitModeV12 && ps.idx === PIT_BAY_ENGINE.start + 2 && ps.w1 > 8) {
        this.drawPitCrewAtBay(sim, ps, t);
      }

      // Other Cars in segment
      for (let k = 0; k < CAR_COUNT; k++) {
        const c = sim.cars[k];
        if (c.slot === sim.playerIdx) continue;
        if (c.retired && c.speed < 1 && sim.multiplayerActive) continue;
        const cz = sim.carZ(c);
        if (Math.trunc(cz / SEG_LEN) % N !== ps.idx) continue;
        const pct = (cz % SEG_LEN) / SEG_LEN;
        const sc = ps.s1 + (ps.s2 - ps.s1) * pct;
        const sx = ps.x1 + (ps.x2 - ps.x1) * pct + sc * c.x * ROAD_W * (SCREEN_W / 2);
        const sy = ps.y1 + (ps.y2 - ps.y1) * pct;
        const dw = 700 * sc * (SCREEN_W / 2);
        if (dw < 3) continue;
        const dh = (dw * 58) / 112;
        this.drawCarSprite(sim, c, Math.round(sx - dw / 2), Math.round(sy - dh), Math.round(dw), Math.round(dh), ps.clip, ps.fog, th);
      }

      // Player Car
      if (n === plN) {
        const pct = pl.speed / MAX_SPEED;
        const bounce = sim.offroad > 0
          ? ((Math.trunc(t * 36) & 1) * 2 * sim.offroad)
          : ((Math.trunc(t * 14) & 1) * (pct > 0.3 ? 1 : 0));
        const px = Math.round(SCREEN_W / 2 - 56 + shakeX * 0.01);
        const py = Math.round(SCREEN_H - 61 - bounce);

        // Headlights on tarmac at night OR inside SEGF_TUNNEL!
        if (th.ambient < 230 || inTunnelPlayer) {
          for (let yy = SCREEN_H / 2 + 24; yy < py + 24; yy++) {
            const u = (yy - (SCREEN_H / 2 + 24)) / (py + 24 - (SCREEN_H / 2 + 24));
            const hw = Math.trunc(18 + u * 66);
            const alpha = Math.trunc(75 * u * (1 - u) * 3.4);
            for (let xx = SCREEN_W / 2 - hw; xx < SCREEN_W / 2 + hw; xx++) {
              this.blendPixel(xx, yy, 255, 240, 175, alpha);
            }
          }
        }

        this.drawCarSprite(sim, pl, px, py, 112, 58, SCREEN_H, 0, th);

        // Twin Nitro / Pit Launch Exhaust Flames
        if (sim.nitroOn || sim.launchBoostTimer > 0) {
          for (const exOff of [36, 76]) {
            const ex = px + exOff;
            const ey = py + 47;
            const flameLen = 7 + (Math.trunc(t * 60 + exOff) % 8);
            for (let fy = 0; fy < flameLen; fy++) {
              const fw = Math.max(1, 4 - Math.trunc((fy * 4) / flameLen));
              const cyan = sim.launchBoostTimer > 0;
              for (let fx = -fw; fx <= fw; fx++) {
                this.pset(ex + fx, ey + fy, cyan ? 90 : 255, cyan ? 250 : 185 - fy * 10, cyan ? 255 : 70);
              }
            }
          }
        }
      }
    }
  }

  private drawSegmentRows(
    sim: AkaRaceSimulator,
    ps: ProjSeg,
    clipY: number,
    th: ThemeColors,
    flags: number,
    t: number,
    animOn: boolean
  ) {
    let yA = Math.ceil(ps.y2);
    let yB = Math.min(Math.ceil(ps.y1), clipY);
    if (yA < 0) yA = 0;
    if (yB > SCREEN_H) yB = SCREEN_H;
    if (yA >= yB) return;

    const band = (Math.trunc(ps.idx / 3) & 1) === 0;
    const alt = Boolean(flags & SEGF_ALT);
    const inTunnel = Boolean(flags & SEGF_TUNNEL) && animOn;
    const startLine = Boolean(flags & SEGF_START);

    const grassBase = inTunnel ? ([24, 26, 34] as [number, number, number]) : alt ? (band ? th.alt1 : th.alt2) : (band ? th.grass1 : th.grass2);
    const roadBase = inTunnel ? (band ? ([56, 58, 70] as [number, number, number]) : ([50, 52, 64] as [number, number, number])) : (band ? th.road1 : th.road2);
    const rumbleBase = band ? th.rumble1 : th.rumble2;

    const grassC = this.mixRgb(grassBase, th.fog, ps.fog);
    const roadC = this.mixRgb(roadBase, th.fog, ps.fog);
    const rumbleC = this.mixRgb(rumbleBase, th.fog, ps.fog);
    const laneC = this.mixRgb(th.lane, th.fog, ps.fog);
    const whiteC = this.mixRgb([246, 246, 250], th.fog, ps.fog);

    const grass32 = this.pack(grassC[0], grassC[1], grassC[2]);
    const road32 = this.pack(roadC[0], roadC[1], roadC[2]);
    const rumble32 = this.pack(rumbleC[0], rumbleC[1], rumbleC[2]);
    const lane32 = this.pack(laneC[0], laneC[1], laneC[2]);
    const white32 = this.pack(whiteC[0], whiteC[1], whiteC[2]);

    const dy = ps.y1 - ps.y2;

    for (let y = yA; y < yB; y++) {
      const u = (y - ps.y2) / dy;
      const cx = ps.x2 + (ps.x1 - ps.x2) * u;
      const w = ps.w2 + (ps.w1 - ps.w2) * u;
      const rw = w * 1.15;
      const lw = Math.max(1, w * 0.025);

      this.fillSpan(y, 0, SCREEN_W, grass32);
      this.fillSpan(y, cx - rw, cx - w, rumble32);
      this.fillSpan(y, cx + w, cx + rw, rumble32);
      this.fillSpan(y, cx - w, cx + w, road32);

      // Start checkered line + grandstand flash glint!
      if (startLine) {
        const sq = (w * 2) / 10;
        for (let k = 0; k < 10; k++) {
          const chk = ((k + ps.idx) & 1) ? white32 : this.pack(25, 25, 32);
          this.fillSpan(y, cx - w + k * sq, cx - w + (k + 1) * sq, chk);
        }
      } else if (band) {
        // 3 road lanes
        for (let k = 1; k < 3; k++) {
          const lx = cx - w + (2 * w * k) / 3;
          this.fillSpan(y, lx - lw, lx + lw, lane32);
        }
      }

      // PIT STOPS RENDERING: v1.2 Separated 3-Bay Pit Apron + Concrete Wall vs v1.1 Single Box
      if (sim.features.pitModeV12) {
        if (ps.idx >= 3 && ps.idx <= 44) {
          // Tapered entry/exit apron on the right of the main road
          let taper = 1.0;
          if (ps.idx < PIT_WALL_FIRST) taper = (ps.idx - 3) / (PIT_WALL_FIRST - 3);
          else if (ps.idx > PIT_WALL_END) taper = 1 - (ps.idx - PIT_WALL_END) / (44 - PIT_WALL_END);

          const ax0 = cx + w * 1.02;
          const ax1 = cx + w * (1.02 + 1.02 * taper);
          let apronRgb: [number, number, number] = [62, 68, 84];

          // Color-code the 3 distinct Pit Bays ("les différents pit stops")!
          const pulse = animOn && ((ps.idx + Math.trunc(t * 6)) & 1) === 0;
          if (ps.idx >= PIT_BAY_NITRO.start && ps.idx <= PIT_BAY_NITRO.end) {
            apronRgb = pulse ? [24, 188, 232] : [22, 134, 178]; // Stand 1: Cyan N2O Express
          } else if (ps.idx >= PIT_BAY_TYRES.start && ps.idx <= PIT_BAY_TYRES.end) {
            apronRgb = pulse ? [242, 192, 34] : [192, 148, 28]; // Stand 2: Yellow Tyres & Alignment
          } else if (ps.idx >= PIT_BAY_ENGINE.start && ps.idx <= PIT_BAY_ENGINE.end) {
            apronRgb = pulse ? [226, 56, 52] : [168, 42, 46];   // Stand 3: Red Full Engine Garage
          }

          const apFog = this.mixRgb(apronRgb, th.fog, ps.fog);
          this.fillSpan(y, ax0, ax1, this.pack(apFog[0], apFog[1], apFog[2]));
          this.fillSpan(y, ax1 - lw, ax1 + lw, white32);

          // Concrete Pit Wall separating main straight from the 3 pit bays!
          if (ps.idx >= PIT_WALL_FIRST && ps.idx <= PIT_WALL_END) {
            const wx0 = cx + w * (PIT_WALL_X - 0.035);
            const wx1 = cx + w * (PIT_WALL_X + 0.035);
            const wallCol = (ps.idx & 1) ? white32 : this.pack(220, 56, 48);
            this.fillSpan(y, wx0, wx1, wallCol);
          }
        }

        // Mid-Lap Express N2O Strip on right shoulder
        if (flags & SEGF_MID_PIT) {
          const mx0 = cx + w * 0.82;
          const mx1 = cx + w * 1.28;
          const mc = this.mixRgb(((ps.idx + Math.trunc(t * 8)) & 1) ? [38, 215, 250] : [28, 125, 165], th.fog, ps.fog);
          this.fillSpan(y, mx0, mx1, this.pack(mc[0], mc[1], mc[2]));
        }
      } else if (!startLine && ps.idx >= PIT_V11.first && ps.idx < PIT_V11.first + PIT_V11.len) {
        // Legacy v1.1 single yellow box drawn directly on right lane
        const inBox = ps.idx >= PIT_V11.box0 && ps.idx < PIT_V11.box1;
        const pc = this.mixRgb(inBox ? [210, 175, 45] : [98, 104, 122], th.fog, ps.fog);
        this.fillSpan(y, cx + w * PIT_V11.x0, cx + w * PIT_V11.x1, this.pack(pc[0], pc[1], pc[2]));
      }
    }
  }

  private drawTunnelPortal(ps: ProjSeg, th: ThemeColors, themeId: number) {
    const cx = Math.round(ps.x1);
    const w = Math.round(ps.w1 * 1.28);
    const baseY = Math.min(ps.clip, Math.round(ps.y1));
    const archH = Math.round(ps.w1 * 0.78);
    const topY = Math.max(0, baseY - archH);
    if (topY >= baseY) return;

    const wallRgb: [number, number, number] = themeId === THEME_GLACIER
      ? [72, 128, 178]
      : themeId === THEME_CITY
      ? [32, 28, 58]
      : [58, 56, 64];
    const ribRgb: [number, number, number] = (ps.idx % 4 === 0)
      ? (themeId === THEME_CITY ? [40, 225, 255] : [255, 195, 90])
      : wallRgb;
    const wc = this.mixRgb(wallRgb, th.fog, ps.fog >> 1);
    const rc = this.mixRgb(ribRgb, th.fog, ps.fog >> 1);
    const colWall = this.pack(wc[0], wc[1], wc[2]);
    const colRib = this.pack(rc[0], rc[1], rc[2]);

    const pillarW = Math.max(2, Math.round(ps.w1 * 0.14));
    for (let y = topY; y < baseY; y++) {
      this.fillSpan(y, cx - w - pillarW, cx - w, ps.idx % 4 === 0 ? colRib : colWall);
      this.fillSpan(y, cx + w, cx + w + pillarW, ps.idx % 4 === 0 ? colRib : colWall);
    }
    const roofThick = Math.max(2, Math.round(ps.w1 * 0.12));
    for (let y = Math.max(0, topY - roofThick); y < topY + 2 && y < ps.clip; y++) {
      this.fillSpan(y, cx - w - pillarW, cx + w + pillarW, ps.idx % 4 === 0 ? colRib : colWall);
    }
  }

  private drawPitCrewAtBay(sim: AkaRaceSimulator, ps: ProjSeg, t: number) {
    const sc = ps.s1;
    const sx = Math.round(ps.x1 + sc * (PIT_LANE_X1 + 0.08) * ROAD_W * (SCREEN_W / 2));
    const sy = Math.round(ps.y1);
    const h = Math.max(6, Math.round(280 * sc * (SCREEN_W / 2)));
    const w = Math.max(3, Math.round(h * 0.42));
    if (sy - h >= ps.clip || sx < 0 || sx >= SCREEN_W) return;

    // 2 Pit Crew Mechanics in racing suits (step closer to car when pitting!)
    const stepIn = sim.pitting ? Math.round(w * 2.1) : 0;
    const bob = sim.pitting ? (Math.trunc(t * 14) & 1) : 0;
    for (let m = 0; m < 2; m++) {
      const mx = sx - stepIn + m * (w + 3);
      const my = sy - h + bob;
      for (let yy = Math.max(0, my); yy < Math.min(ps.clip, sy); yy++) {
        const rel = (yy - my) / h;
        const suit = rel < 0.25 ? [245, 245, 250] : rel < 0.68 ? [230, 52, 46] : [34, 38, 52];
        for (let xx = mx; xx < mx + w; xx++) this.pset(xx, yy, suit[0], suit[1], suit[2]);
      }
    }

    // Lollipop Sign held out over the Engine Pit Bay!
    const signX = sx - Math.round(w * 2.8);
    const signY = sy - Math.round(h * 1.15);
    const rad = Math.max(3, Math.round(w * 0.75));
    const isGo = sim.lollipopState === 'GO';
    const isReady = sim.lollipopState === 'READY';
    const signCol = isGo ? [52, 242, 115] : isReady ? [255, 210, 48] : [245, 52, 48];
    for (let yy = signY; yy < Math.min(ps.clip, sy); yy++) this.pset(signX, yy, 210, 215, 225);
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (dx * dx + dy * dy <= rad * rad && signY + dy < ps.clip) {
          this.pset(signX + dx, signY + dy, signCol[0], signCol[1], signCol[2]);
        }
      }
    }
  }

  private drawSceneryProp(
    sim: AkaRaceSimulator,
    ps: ProjSeg,
    pr: SimProp,
    th: ThemeColors,
    t: number,
    animOn: boolean
  ) {
    const sc = ps.s1;
    const dw = Math.round(pr.worldW * sc * (SCREEN_W / 2));
    if (dw < 2) return;

    if (pr.spr === 'GANTRY') {
      const dh = Math.round(dw * 0.42);
      const x0 = Math.round(ps.x1 - dw / 2);
      const y0 = Math.round(ps.y1 - dh);
      if (y0 >= ps.clip) return;
      const legW = Math.max(2, Math.round(dw * 0.05));
      for (let y = Math.max(0, y0); y < Math.min(ps.clip, Math.round(ps.y1)); y++) {
        for (let lx = 0; lx < legW; lx++) {
          this.pset(x0 + lx, y, 195, 200, 215);
          this.pset(x0 + dw - legW + lx, y, 195, 200, 215);
        }
      }
      const barH = Math.max(4, Math.round(dh * 0.24));
      for (let y = Math.max(0, y0); y < Math.min(ps.clip, y0 + barH); y++) {
        for (let x = x0; x < x0 + dw; x++) {
          const chk = (((x - x0) >> 3) + ((y - y0) >> 2) + (animOn ? Math.trunc(t * 6) : 0)) & 1;
          this.pset(x, y, chk ? 250 : 28, chk ? 250 : 32, chk ? 255 : 44);
        }
      }
      // Grandstand camera flash sparkles on start gantry!
      if (animOn && (Math.trunc(t * 11 + ps.idx) % 5) === 0) {
        const fx = x0 + ((Math.trunc(t * 97) * 37) % Math.max(4, dw));
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) this.blendPixel(fx + dx, y0 + dy, 255, 255, 235, 210);
      }
      return;
    }

    const sx = ps.x1 + sc * pr.offset * ROAD_W * (SCREEN_W / 2);
    const x = Math.round(pr.offset < 0 ? sx - dw : sx);
    const dh = pr.spr === 'LAMP' || pr.spr === 'LIGHTHOUSE' || pr.spr === 'CRANE'
      ? Math.round(dw * 2.1)
      : pr.spr === 'PALM' || pr.spr === 'PINE' || pr.spr === 'PINE_SNOW'
      ? Math.round(dw * 1.45)
      : Math.round(dw * 0.85);
    const y = Math.round(ps.y1 - dh);
    if (x >= SCREEN_W || x + dw < 0 || y >= ps.clip) return;

    const yEnd = Math.min(ps.clip, y + dh);

    if (pr.spr === 'PALM') {
      const sway = animOn ? Math.sin(t * 2.8 + ps.idx) * dw * 0.08 : 0;
      const tx = Math.round(x + dw * 0.5);
      for (let yy = Math.max(0, y + Math.round(dh * 0.28)); yy < yEnd; yy++) {
        const bend = Math.round(((yEnd - yy) / dh) * sway * 2);
        const tw = Math.max(1, Math.round(dw * 0.07));
        for (let k = -tw; k <= tw; k++) this.pset(tx + bend + k, yy, 138, 92, 48);
      }
      const crownY = y + Math.round(dh * 0.28);
      if (crownY < ps.clip && crownY >= 0) {
        const cw = Math.round(dw * 0.48);
        for (let dy = -Math.round(dh * 0.22); dy <= Math.round(dh * 0.14); dy++) {
          for (let dx = -cw; dx <= cw; dx++) {
            if (dx * dx + dy * dy * 2.2 <= cw * cw && crownY + dy < ps.clip) {
              this.pset(tx + Math.round(sway) + dx, crownY + dy, 46, 168, 64);
            }
          }
        }
      }
    } else if (pr.spr === 'PINE' || pr.spr === 'PINE_SNOW') {
      const snowy = pr.spr === 'PINE_SNOW' || sim.road.theme === THEME_ALPINE;
      const cx = x + (dw >> 1);
      for (let yy = Math.max(0, y); yy < yEnd; yy++) {
        const rel = (yy - y) / Math.max(1, dh);
        const hw = Math.round(dw * 0.46 * rel);
        const col = snowy && rel < 0.35 ? [238, 246, 255] : [36, 108, 62];
        for (let xx = cx - hw; xx <= cx + hw; xx++) this.pset(xx, yy, col[0], col[1], col[2]);
      }
    } else if (pr.spr === 'CHEVRON') {
      // Sequential chasing >>> LED chevrons in v1.2!
      const lit = !animOn || ((Math.trunc(t * 7) + Math.trunc(ps.idx / 5)) % 3) !== 0;
      const bg = [24, 28, 38];
      const fg = lit ? [255, 208, 36] : [130, 96, 24];
      for (let yy = Math.max(0, y); yy < yEnd; yy++) {
        for (let xx = x; xx < x + dw; xx++) {
          const ux = (xx - x) / Math.max(1, dw);
          const uy = Math.abs((yy - y) / Math.max(1, dh) - 0.5) * 2;
          const arrow = pr.flip ? ux + uy * 0.5 : (1 - ux) + uy * 0.5;
          const isArrow = arrow > 0.55 && arrow < 0.92;
          const c = isArrow ? fg : bg;
          this.pset(xx, yy, c[0], c[1], c[2]);
        }
      }
    } else if (pr.spr === 'PIT_SIGN') {
      // Pit lane entry board + blinking amber beacon!
      for (let yy = Math.max(0, y); yy < yEnd; yy++) {
        for (let xx = x; xx < x + dw; xx++) {
          this.pset(xx, yy, yy < y + dh * 0.65 ? 24 : 140, yy < y + dh * 0.65 ? 148 : 145, yy < y + dh * 0.65 ? 210 : 155);
        }
      }
      if (!animOn || (Math.trunc(t * 6) & 1) === 0) {
        const bx = x + (dw >> 1);
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) this.blendPixel(bx + dx, y - 2 + dy, 255, 195, 40, 220);
      }
    } else if (pr.spr === 'PIT_CANOPY') {
      // Circuit-themed Pit Garage Canopy over Bay 3!
      const roofH = Math.max(3, Math.round(dh * 0.32));
      const legW = Math.max(2, Math.round(dw * 0.08));
      const roofCol = sim.road.theme === THEME_CITY ? [0, 215, 245] : sim.road.theme === THEME_GLACIER ? [245, 130, 40] : [228, 48, 48];
      for (let yy = Math.max(0, y); yy < yEnd; yy++) {
        if (yy < y + roofH) {
          for (let xx = x; xx < x + dw; xx++) {
            const stripe = ((xx - x) >> 3) & 1;
            this.pset(xx, yy, stripe ? 248 : roofCol[0], stripe ? 248 : roofCol[1], stripe ? 252 : roofCol[2]);
          }
        } else {
          for (let lx = 0; lx < legW; lx++) {
            this.pset(x + lx, yy, 180, 186, 200);
            this.pset(x + dw - legW + lx, yy, 180, 186, 200);
          }
        }
      }
    } else if (pr.spr === 'LIGHTHOUSE') {
      const cx = x + (dw >> 1);
      for (let yy = Math.max(0, y); yy < yEnd; yy++) {
        const rel = (yy - y) / Math.max(1, dh);
        const hw = Math.max(2, Math.round(dw * (0.16 + 0.18 * rel)));
        const redBand = (Math.trunc(rel * 5) & 1) === 0;
        for (let xx = cx - hw; xx <= cx + hw; xx++) {
          this.pset(xx, yy, redBand ? 220 : 244, redBand ? 48 : 244, redBand ? 48 : 248);
        }
      }
      // ROTATING LIGHTHOUSE SWEEP BEAM in Night Harbor / Palm Bay!
      const lanternY = y + Math.round(dh * 0.14);
      if (lanternY > 0 && lanternY < ps.clip) {
        const dir = animOn ? Math.sin(t * 2.1) : 1;
        const beamLen = Math.round(dw * 2.4 * Math.abs(dir));
        const sign = dir >= 0 ? 1 : -1;
        for (let bx = 0; bx < beamLen; bx++) {
          const spread = 1 + Math.trunc(bx * 0.18);
          const alpha = Math.max(8, 125 - Math.trunc((bx / Math.max(1, beamLen)) * 110));
          for (let by = -spread; by <= spread; by++) {
            this.blendPixel(cx + sign * bx, lanternY + by, 255, 238, 155, alpha);
          }
        }
      }
    } else if (pr.spr === 'LAMP') {
      const poleX = pr.flip ? x + Math.round(dw * 0.2) : x + Math.round(dw * 0.8);
      for (let yy = Math.max(0, y); yy < yEnd; yy++) this.pset(poleX, yy, 120, 128, 148);
      const headX = pr.flip ? x + Math.round(dw * 0.75) : x + Math.round(dw * 0.25);
      if (y > 0 && y < ps.clip) {
        for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) this.blendPixel(headX + dx, y + dy, 255, 220, 130, 180);
      }
    } else {
      // Buildings, Containers, Cranes, Rocks, Neon Boards, Chalets, Ice
      const isNeon = pr.spr === 'NEON_BOARD';
      const pulse = animOn && (Math.trunc(t * 5 + ps.idx) & 1) === 0;
      const baseCol: [number, number, number] = isNeon
        ? (pulse ? [255, 55, 195] : [35, 225, 255])
        : pr.spr === 'ICE'
        ? [155, 215, 250]
        : pr.spr === 'CONTAINER'
        ? (ps.idx % 2 ? [205, 64, 52] : [48, 112, 188])
        : pr.spr === 'BUILDING'
        ? [36, 38, 64]
        : [108, 112, 126];
      const fc = this.mixRgb(baseCol, th.fog, ps.fog);
      for (let yy = Math.max(0, y); yy < yEnd; yy++) {
        for (let xx = x; xx < x + dw; xx++) {
          let c = fc;
          if (pr.spr === 'BUILDING' && ((xx - x) & 3) === 1 && ((yy - y) & 3) === 1) {
            c = [255, 205, 115];
          }
          this.pset(xx, yy, c[0], c[1], c[2]);
        }
      }
      // Red blinking aircraft warning beacon atop harbor cranes!
      if (pr.spr === 'CRANE' && animOn && (Math.trunc(t * 3.5) & 1) === 0 && y > 0 && y < ps.clip) {
        this.blendPixel(x + (dw >> 1), y, 255, 45, 45, 240);
        this.blendPixel(x + (dw >> 1) + 1, y, 255, 45, 45, 240);
      }
    }
  }

  private drawCarSprite(
    sim: AkaRaceSimulator,
    c: SimCar,
    x: number,
    y: number,
    dw: number,
    dh: number,
    clipY: number,
    fog: number,
    th: ThemeColors
  ) {
    const atlas = getCarArtAtlasSync();
    if (!atlas || !atlas.ready) return;

    const sv = c.steerVis;
    const mode = sim.features.spriteMode;
    const look = c.look % CAR_COUNT;

    let frame: CarSpriteFrame = atlas.unified3dFrames[look][0];
    let flip = false;
    let isWide = false;
    let uStage = 0;

    if (mode === 'v11_locked') {
      frame = atlas.unified3dFrames[look]?.[0] || atlas.repo2c7Frames[look]?.[0];
    } else if (mode === 'v11_front_bug') {
      if (Math.abs(sv) > 0.25 || (c.isPlayer && sim.spinT > 0)) {
        frame = atlas.v11OrigBad3q[look] || atlas.repo2c7Frames[look][6];
        flip = sv > 0;
        isWide = true;
        uStage = 1;
      } else {
        frame = atlas.v11OrigRear[look] || atlas.repo2c7Frames[look][0];
      }
    } else if (mode === 'unified_3d') {
      // Pure rigid Z-buffered 3D rotation of the 2c7 Stage-6 GT car (ZERO 2D image cross-fade!)
      const effAbs = c.isPlayer && sim.spinT > 0 && sim.spinDir !== 0 ? 1.0 : Math.abs(sv);
      flip = c.isPlayer && sim.spinT > 0 && sim.spinDir !== 0 ? sim.spinDir > 0 : sv > 0;
      const sel = getUnifiedRigidFrame(atlas, look, effAbs, sim.features.subStageBlend);
      frame = sel.frame;
      isWide = frame.w === CAR_ART3Q_W;
      uStage = sel.uStage;
    } else if (mode === 'hybrid_clean' && sim.features.subStageBlend) {
      let fStage = 0;
      if (c.isPlayer && sim.spinT > 0 && sim.spinDir !== 0) {
        fStage = 6;
        flip = sim.spinDir > 0;
      } else {
        const absSv = Math.abs(sv);
        fStage = absSv <= 0.05 ? 0 : Math.min(6, ((absSv - 0.05) / 0.80) * 6);
        flip = sv > 0;
      }
      frame = blendContinuousStage(atlas.hybridCleanFrames[look], look, fStage);
      isWide = frame.w === CAR_ART3Q_W;
      uStage = fStage / 6;
    } else {
      const thresholds =
        mode === 'hybrid_clean'
          ? [0.09, 0.22, 0.36, 0.50, 0.65, 0.80]
          : [0.18, 0.30, 0.42, 0.55, 0.70, 0.88];
      let stage = 0;
      if (c.isPlayer && sim.spinT > 0 && sim.spinDir !== 0) {
        stage = CAR_ART_MID + 1;
        flip = sim.spinDir > 0;
      } else {
        const absSv = Math.abs(sv);
        while (stage <= CAR_ART_MID && absSv >= thresholds[stage]) stage++;
        flip = sv > 0;
      }
      const bank = mode === 'repo_2c7e371' ? atlas.repo2c7Frames : atlas.hybridCleanFrames;
      frame = bank[look]?.[stage] || atlas.unified3dFrames[look][stage];
      isWide = stage > 0;
      uStage = stage / (CAR_ART_MID + 1);
    }

    const dhA = Math.max(2, Math.round((dw * CAR_ART_H) / CAR_ART_W));
    const pw = isWide ? Math.round((dw * CAR_ART3Q_W) / CAR_ART_W) : dw;
    const px0 = isWide ? x - ((pw - dw) >> 1) : x;
    const ya =
      mode === 'repo_2c7e371' || mode === 'hybrid_clean' || mode === 'unified_3d'
        ? y + Math.round((dh * 52) / 58) - Math.round((dhA * (93 + Math.round(4 * uStage))) / 100)
        : y + Math.round((dh * 54) / 58) - dhA;

    // Soft elliptical ground contact shadow under tyres
    const shadowY = ya + dhA - Math.max(1, Math.round(dhA * 0.08));
    if (shadowY > 0 && shadowY < clipY && shadowY < SCREEN_H) {
      const rx = Math.round(pw * 0.45);
      const cx = px0 + (pw >> 1);
      for (let sy = shadowY - 2; sy <= shadowY + 2; sy++) {
        if (sy < 0 || sy >= clipY || sy >= SCREEN_H) continue;
        for (let sx = Math.max(0, cx - rx); sx < Math.min(SCREEN_W, cx + rx); sx++) {
          this.blendPixel(sx, sy, 6, 8, 14, 130);
        }
      }
    }

    // Blit RGB565 car sprite with ambient & fog shading
    const yStart = Math.max(0, ya);
    const yStop = Math.min(Math.min(SCREEN_H, clipY), ya + dhA);
    const xStart = Math.max(0, px0);
    const xStop = Math.min(SCREEN_W, px0 + pw);
    const amb = Math.min(256, th.ambient < 256 ? th.ambient + 40 : 256);

    for (let sy = yStart; sy < yStop; sy++) {
      const srcY = Math.min(frame.h - 1, Math.trunc(((sy - ya) * frame.h) / dhA));
      for (let sx = xStart; sx < xStop; sx++) {
        let srcX = Math.min(frame.w - 1, Math.trunc(((sx - px0) * frame.w) / pw));
        if (flip) srcX = frame.w - 1 - srcX;
        const p = (srcY * frame.w + srcX) * 4;
        if (frame.rgba[p + 3] < 128) continue;
        let r = (frame.rgba[p] * amb) >> 8;
        let g = (frame.rgba[p + 1] * amb) >> 8;
        let b = (frame.rgba[p + 2] * amb) >> 8;
        if (fog > 0) {
          const inv = 256 - fog;
          r = (r * inv + th.fog[0] * fog) >> 8;
          g = (g * inv + th.fog[1] * fog) >> 8;
          b = (b * inv + th.fog[2] * fog) >> 8;
        }
        this.pset(sx, sy, r, g, b);
      }
    }

    // Rear Brake Lights & Night Taillight Glow aligned to exact rear lampBox (for repo_2c7e371, hybrid_clean & studio_3d)
    if ((c.braking || th.ambient < 245) && dw > 9 && fog < 198 && mode !== 'v11_front_bug') {
      const lb = frame.lampBox;
      const rectAlpha = c.braking ? 185 : 105;
      const glowAlpha = c.braking ? 135 : 70;
      for (let k = 0; k < 2; k++) {
        let bx0 = lb[k * 4];
        const by0 = lb[k * 4 + 1];
        let bx1 = lb[k * 4 + 2];
        const by1 = lb[k * 4 + 3];
        if (flip) {
          const tmp0 = frame.w - bx1;
          const tmp1 = frame.w - bx0;
          bx0 = tmp0;
          bx1 = tmp1;
        }
        const sx0 = Math.max(0, px0 + Math.trunc((bx0 * pw) / frame.w));
        const sx1 = Math.min(SCREEN_W, Math.max(sx0 + 1, px0 + Math.trunc((bx1 * pw) / frame.w)));
        const sy0 = Math.max(0, ya + Math.trunc((by0 * dhA) / frame.h));
        const sy1 = Math.min(clipY, ya + Math.trunc((by1 * dhA) / frame.h));
        for (let yy = sy0; yy < sy1; yy++) {
          for (let xx = sx0; xx < sx1; xx++) {
            this.blendPixel(xx, yy, 255, c.braking ? 36 : 16, 24, rectAlpha);
          }
        }
        const lx = (sx0 + sx1) >> 1;
        const ly = (sy0 + sy1) >> 1;
        const rad = Math.max(2, Math.trunc(((sx1 - sx0) * 7) / 10) + 1);
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            if (dx * dx + dy * dy <= rad * rad && ly + dy < clipY) {
              this.blendPixel(lx + dx, ly + dy, c.braking ? 185 : 95, 22, 22, glowAlpha);
            }
          }
        }
      }
    }
  }

  private drawParticlesAndWeather(sim: AkaRaceSimulator, animOn: boolean) {
    // Active impact / wrench / smoke particles
    for (const pt of sim.particles) {
      const alpha = Math.max(0, Math.min(220, Math.trunc((pt.life / pt.maxLife) * 220)));
      const hs = pt.size >> 1;
      for (let dy = -hs; dy <= hs; dy++) {
        for (let dx = -hs; dx <= hs; dx++) {
          this.blendPixel(Math.round(pt.x) + dx, Math.round(pt.y) + dy, pt.r, pt.g, pt.b, alpha);
        }
      }
    }

    // Circuit Weather Micro-Animations: Alpine Snow Flurries & Glacier Polar Crystals!
    if (animOn && (sim.road.theme === THEME_ALPINE || sim.road.theme === THEME_GLACIER)) {
      const t = sim.globalTime;
      const count = sim.road.theme === THEME_GLACIER ? 38 : 28;
      for (let i = 0; i < count; i++) {
        const sx = Math.trunc((i * 73 + t * (28 + (i % 5) * 7) - sim.steer * 55) % SCREEN_W + SCREEN_W) % SCREEN_W;
        const sy = Math.trunc((i * 47 + t * (42 + (i % 4) * 11)) % SCREEN_H);
        this.blendPixel(sx, sy, 245, 250, 255, 195);
        if (i % 3 === 0) this.blendPixel(sx + 1, sy, 215, 235, 255, 150);
      }
    }
  }

  private formatLapTime(sec: number): string {
    const s = Math.max(0, sec);
    const min = Math.trunc(s / 60);
    const rem = Math.trunc(s % 60);
    const cs = Math.trunc((s * 100) % 100);
    return `${min}'${String(rem).padStart(2, '0')}"${String(cs).padStart(2, '0')}`;
  }

  private drawHudAndOverlays(ctx: CanvasRenderingContext2D, sim: AkaRaceSimulator) {
    const pl = sim.player();
    ctx.save();
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';

    const shadowText = (txt: string, x: number, y: number, color = '#FFFFFF', font?: string) => {
      if (font) ctx.font = font;
      ctx.fillStyle = '#090B10';
      ctx.fillText(txt, x + 1, y + 1);
      ctx.fillStyle = color;
      ctx.fillText(txt, x, y);
    };

    // Position Top-Left
    shadowText(`P${pl.place}`, 7, 5, '#FFE866', 'bold 18px "Barlow Condensed", sans-serif');
    shadowText(`/${CAR_COUNT}`, 28, 11, '#E2E8F0', 'bold 10px "JetBrains Mono", monospace');

    // Compact vs Full Position Tower (Gamebuino AKA L1 ergonomic improvement!)
    const ordered = [...sim.cars].sort((a, b) => a.place - b.place);
    if (!sim.features.compactHudL1) {
      ctx.fillStyle = 'rgba(8, 11, 20, 0.58)';
      ctx.fillRect(6, 27, 74, CAR_COUNT * 10 + 4);
      for (let i = 0; i < ordered.length; i++) {
        const c = ordered[i];
        const yy = 29 + i * 10;
        if (c.isPlayer) {
          ctx.fillStyle = 'rgba(255, 210, 60, 0.25)';
          ctx.fillRect(7, yy - 1, 72, 9);
        }
        ctx.fillStyle = DRIVERS[c.look % CAR_COUNT].hex;
        ctx.fillRect(18, yy + 1, 5, 6);
        const tag = c.platform !== 'AI' ? `${c.name.slice(0, 5)}` : c.name;
        shadowText(`${i + 1}`, 8, yy, c.isPlayer ? '#FFE46B' : '#CBD5E1', 'bold 8px "JetBrains Mono", monospace');
        shadowText(tag, 26, yy, c.isPlayer ? '#FFE46B' : c.isRemoteHuman ? '#67E8F9' : '#F8FAFC', 'bold 8px "JetBrains Mono", monospace');
      }
    } else {
      ctx.fillStyle = 'rgba(8, 11, 20, 0.58)';
      ctx.fillRect(6, 27, 84, 14);
      shadowText(`AKA COMPACT · ${pl.name}`, 9, 30, '#67E8F9', 'bold 8px "JetBrains Mono", monospace');
    }

    // Lap & Times Top-Right
    const lapStr = `LAP ${sim.playerLap()}/${sim.laps}`;
    shadowText(lapStr, SCREEN_W - 68, 6, '#7DD3FC', 'bold 14px "Barlow Condensed", sans-serif');
    shadowText(`TIME ${this.formatLapTime(sim.raceTime - pl.lapStart)}`, SCREEN_W - 86, 23, '#F8FAFC', 'bold 8px "JetBrains Mono", monospace');
    if (pl.bestLap > 0) {
      shadowText(`BEST ${this.formatLapTime(pl.bestLap)}`, SCREEN_W - 86, 33, '#FDE047', 'bold 8px "JetBrains Mono", monospace');
    }

    // Minimap Bottom-Left (with blinking Pit indicator when damage > 35%!)
    const mx0 = 6, my0 = SCREEN_H - 64;
    ctx.fillStyle = 'rgba(8, 11, 20, 0.56)';
    ctx.fillRect(mx0, my0, 58, 58);
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx0 + 0.5, my0 + 0.5, 57, 57);

    const mcx = mx0 + 29, mcy = my0 + 29;
    ctx.beginPath();
    for (let m = 0; m < 128; m++) {
      const px = mcx + sim.road.mapX[m] * 0.85;
      const py = mcy + sim.road.mapY[m] * 0.85;
      if (m === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = '#CBD5E1';
    ctx.stroke();

    for (const c of sim.cars) {
      const f = (sim.carZ(c) / sim.road.length) * 128;
      const m = Math.trunc(f) & 127;
      const px = mcx + sim.road.mapX[m] * 0.85;
      const py = mcy + sim.road.mapY[m] * 0.85;
      ctx.fillStyle = c.isPlayer ? '#FFFFFF' : DRIVERS[c.look % CAR_COUNT].hex;
      ctx.fillRect(px - (c.isPlayer ? 2 : 1.5), py - (c.isPlayer ? 2 : 1.5), c.isPlayer ? 4 : 3, c.isPlayer ? 4 : 3);
    }

    // Bottom-Right Gauges: TYR, ENG, N2O + Digital/Arc Speedometer
    const drawBar = (bx: number, label: string, val01: number, colHex: string, warnBlink = false) => {
      const by = 184, bh = 44;
      ctx.fillStyle = 'rgba(8, 11, 20, 0.68)';
      ctx.fillRect(bx, by, 8, bh);
      const h = Math.round(Math.max(0, Math.min(1, val01)) * bh);
      ctx.fillStyle = warnBlink && (Math.trunc(sim.globalTime * 7) & 1) ? '#FFFFFF' : colHex;
      ctx.fillRect(bx + 1, by + bh - h, 6, h);
      ctx.strokeStyle = warnBlink ? '#F87171' : '#94A3B8';
      ctx.strokeRect(bx + 0.5, by + 0.5, 7, bh - 1);
      shadowText(label, bx - 2, by - 9, '#CBD5E1', 'bold 7px "JetBrains Mono", monospace');
    };

    const grip01 = 1 - sim.tyreWear;
    const eng01 = 1 - sim.damage;
    drawBar(209, 'TYR', grip01, grip01 > 0.45 ? '#FACC15' : '#FB923C', sim.tyreWear > 0.75);
    drawBar(223, 'ENG', eng01, eng01 > 0.5 ? '#4ADE80' : '#EF4444', sim.damage > 0.72);
    drawBar(237, 'N2O', sim.nitro, '#38BDF8', false);

    // Speedometer Box
    ctx.fillStyle = 'rgba(8, 11, 20, 0.72)';
    ctx.fillRect(252, 184, 62, 50);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.strokeRect(252.5, 184.5, 61, 49);
    const kmh = Math.round(sim.speedKmh());
    shadowText(`${kmh}`, 259, 192, '#FFFFFF', 'bold 22px "Barlow Condensed", sans-serif');
    shadowText('KM/H', 292, 201, '#94A3B8', 'bold 8px "JetBrains Mono", monospace');
    shadowText(`G${sim.gear}`, 259, 219, '#FBBF24', 'bold 9px "JetBrains Mono", monospace');
    if (sim.inPitLane) {
      shadowText('PIT', 286, 219, '#38BDF8', 'bold 9px "JetBrains Mono", monospace');
    }

    // v1.2 Live Pit Lane Telemetry Overlay when inside Pit Apron!
    if (sim.features.pitModeV12 && (sim.inPitLane || sim.lollipopState === 'GO')) {
      ctx.fillStyle = 'rgba(10, 15, 28, 0.86)';
      ctx.fillRect(88, 42, 144, 34);
      ctx.strokeStyle = sim.lollipopState === 'GO' ? '#4ADE80' : '#FACC15';
      ctx.strokeRect(88.5, 42.5, 143, 33);
      const bayTitle =
        sim.lollipopState === 'GO'
          ? 'LOLLIPOP : GO! GO! (GAZ)'
          : sim.activePitBay === 'NITRO'
          ? 'STAND 1 · N2O EXPRESS (<95)'
          : sim.activePitBay === 'TYRES'
          ? 'STAND 2 · PNEUS & TRAIN (<38)'
          : sim.activePitBay === 'ENGINE'
          ? 'STAND 3 · REVISION MOTEUR (<30)'
          : 'VOIE DES STANDS · 3 BOX';
      shadowText(bayTitle, 94, 46, sim.lollipopState === 'GO' ? '#4ADE80' : '#FDE047', 'bold 8px "JetBrains Mono", monospace');
      shadowText(
        `ENG ${Math.round(eng01 * 100)}% · TYR ${Math.round(grip01 * 100)}% · N2O ${Math.round(sim.nitro * 100)}%`,
        94,
        59,
        '#E2E8F0',
        'bold 8px "JetBrains Mono", monospace'
      );
    } else if (sim.damage > 0.42 && (Math.trunc(sim.globalTime * 4) & 1) === 0) {
      shadowText('STAND A DROITE APRES LIGNE', 94, 46, '#FDBA74', 'bold 8px "JetBrains Mono", monospace');
    }

    // Countdown Traffic Lights
    if (sim.screenState === 'COUNTDOWN') {
      const lit = sim.stateT < 1 ? 0 : sim.stateT < 2 ? 1 : sim.stateT < 3 ? 2 : 3;
      const green = sim.stateT >= 3.85;
      ctx.fillStyle = 'rgba(8, 11, 20, 0.85)';
      ctx.fillRect(108, 48, 104, 34);
      ctx.strokeStyle = '#E2E8F0';
      ctx.strokeRect(108.5, 48.5, 103, 33);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(130 + i * 30, 65, 9, 0, Math.PI * 2);
        ctx.fillStyle = green ? '#4ADE80' : i < lit ? '#EF4444' : '#331518';
        ctx.fill();
      }
    }

    // Center Banner Message
    if (sim.bannerTimer > 0 && sim.bannerText) {
      const [r, g, b] = sim.bannerColor;
      ctx.font = 'bold 16px "Barlow Condensed", sans-serif';
      const tw = ctx.measureText(sim.bannerText).width;
      shadowText(sim.bannerText, Math.round((SCREEN_W - tw) / 2), 86, `rgb(${r},${g},${b})`);
    }

    // Results Screen Overlay
    if (sim.screenState === 'RESULTS') {
      ctx.fillStyle = 'rgba(8, 11, 20, 0.84)';
      ctx.fillRect(18, 28, SCREEN_W - 36, SCREEN_H - 52);
      ctx.strokeStyle = '#F97316';
      ctx.strokeRect(18.5, 28.5, SCREEN_W - 37, SCREEN_H - 53);
      shadowText('CLASSEMENT GRAND PRIX', 88, 34, '#FDE047', 'bold 14px "Barlow Condensed", sans-serif');
      for (let i = 0; i < ordered.length; i++) {
        const c = ordered[i];
        const yy = 54 + i * 16;
        if (c.isPlayer) {
          ctx.fillStyle = 'rgba(249, 115, 22, 0.25)';
          ctx.fillRect(24, yy - 2, SCREEN_W - 48, 13);
        }
        const platBadge = c.platform === 'AI' ? 'IA' : c.platform;
        const tStr = c.retired ? 'DNF' : this.formatLapTime(c.finishTime);
        shadowText(`${i + 1}. ${c.name} [${platBadge}]`, 28, yy, c.isPlayer ? '#FDE047' : '#F8FAFC', 'bold 9px "JetBrains Mono", monospace');
        shadowText(tStr, 225, yy, '#CBD5E1', 'bold 9px "JetBrains Mono", monospace');
      }
      shadowText('A / ESPACE : RELANCER LA COURSE', 74, 192, '#38BDF8', 'bold 9px "JetBrains Mono", monospace');
    }

    if (sim.paused) {
      ctx.fillStyle = 'rgba(8, 11, 20, 0.78)';
      ctx.fillRect(92, 92, 136, 48);
      ctx.strokeStyle = '#FACC15';
      ctx.strokeRect(92.5, 92.5, 135, 47);
      shadowText('PAUSE (RUN / ENTREE)', 106, 110, '#FDE047', 'bold 11px "JetBrains Mono", monospace');
    }

    ctx.restore();
  }
}
