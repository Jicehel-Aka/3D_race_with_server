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
  PIT_EXIT_END,
  PIT_WALL_END,
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
  CAR_ART_W,
  getCarArtAtlasSync,
  getUnifiedRigidFrame,
} from './carArt3D';
import {
  PIT_ENTRY,
  PIT_STRIP_W,
  PIT_WALL_START_REPO,
  pitIdxOf,
  pitOuterAt,
  pitTaperAt,
  type AkaRaceSimulator,
  type SimCar,
  type SimProp,
} from './raceSim';
import { TECH_H, TECH_PAL_RGB, TECH_PX, TECH_W, TechFrame } from './techArt';

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
  pit: number;
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

interface PitCrewRenderItem {
  segIdx: number;
  pctInSeg: number;
  dzFromPlayer: number;
  worldX: number;
  dir: 1 | -1;
  frame: TechFrame;
  yOffset: number;
  isWorking: boolean;
  isLollipop: boolean;
  showGoSign: boolean;
}

const DRAW_DIST = 115;

export class Renderer320x240 {
  private imgData: ImageData | null = null;
  private buf32: Uint32Array = new Uint32Array(SCREEN_W * SCREEN_H);
  private pSegs: ProjSeg[] = Array.from({ length: DRAW_DIST }, () => ({
    idx: 0, pit: 0, valid: false, clip: SCREEN_H, fog: 0,
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

  private psetClip(x: number, y: number, clipY: number, r: number, g: number, b: number) {
    if (x < 0 || x >= SCREEN_W || y < 0 || y >= clipY || y >= SCREEN_H) return;
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

    this.drawSkyAndBackdrops(sim, th, animOn ? t : 0, animOn);
    this.drawRoadAndSprites(sim, th, t, animOn);
    this.drawParticlesAndWeather(sim, animOn);

    ctx.putImageData(this.imgData, 0, 0);
    this.drawHudAndOverlays(ctx, sim);
  }

  private drawSkyAndBackdrops(sim: AkaRaceSimulator, th: ThemeColors, t: number, animOn: boolean) {
    const themeId = sim.road.theme;
    const skyOff = Math.trunc(sim.skyOffset * 0.5) & 1023;
    const farOff = Math.trunc(sim.skyOffset) & 1023;
    const nearOff = Math.trunc(sim.nearOffset) & 1023;

    for (let y = 0; y < HORIZON_Y + 6; y++) {
      const f = y / (HORIZON_Y + 6);
      const col = f < 0.55
        ? this.mixRgb(th.skyTop, th.skyMid, Math.trunc((f / 0.55) * 256))
        : this.mixRgb(th.skyMid, th.skyHor, Math.trunc(((f - 0.55) / 0.45) * 256));
      this.fillSpan(y, 0, SCREEN_W, this.pack(col[0], col[1], col[2]));
    }

    if (themeId === THEME_COAST) {
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
      for (let k = 0; k < 50; k++) {
        const sx = (((k * 211 + 7) - skyOff) % 1024 + 1024) % 1024;
        if (sx < SCREEN_W) {
          const sy = (k * 43) % (HORIZON_Y - 30);
          const tw = animOn ? Math.trunc(155 + 100 * Math.sin(t * 4.5 + k)) : 200;
          this.blendPixel(sx, sy, 245, 245, 255, tw);
        }
      }
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
      ps.pit = pitIdxOf(i, N);
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
      this.drawSegmentRows(ps, maxy, th, sg.flags, t, animOn);
      maxy = Math.max(0, Math.ceil(ps.y2));
    }

    let plN = -1;
    for (let n = 0; n < DRAW_DIST; n++) {
      if (this.pSegs[n].idx === plIdx) {
        plN = n;
        break;
      }
    }

    const inTunnelPlayer = Boolean(plSeg.flags & SEGF_TUNNEL) && animOn;
    const crewItems = this.buildPitCrewRenderItems(sim, N, plZ, t);

    for (let n = DRAW_DIST - 1; n > 0; n--) {
      const ps = this.pSegs[n];
      if (!ps.valid) continue;
      const sg = sim.road.segs[ps.idx];

      if (animOn && (sg.flags & SEGF_TUNNEL) && ps.w1 > 4) {
        this.drawTunnelPortal(ps, th, sim.road.theme);
      }

      const props = sim.propsBySeg[ps.idx];
      if (props) {
        for (const pr of props) {
          this.drawSceneryProp(sim, ps, pr, th, t, animOn);
        }
      }

      // Pit lane static architecture (awnings, cones, tyre stacks on outer apron)
      if (ps.pit >= PIT_ENTRY && ps.pit <= PIT_EXIT_END) {
        this.drawPitStaticScenery(ps, th, t);
      }

      // Crew members on this segment that are ahead of the player car's rear axle (drawn before player car)
      for (let m = 0; m < crewItems.length; m++) {
        const item = crewItems[m];
        if (item.segIdx === ps.idx && item.dzFromPlayer >= 210) {
          this.drawPitCrewItem(sim, ps, item, th);
        }
      }

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

      if (n === plN) {
        const pct = pl.speed / MAX_SPEED;
        const bounce = sim.offroad > 0
          ? ((Math.trunc(t * 36) & 1) * 2 * sim.offroad)
          : ((Math.trunc(t * 14) & 1) * (pct > 0.3 ? 1 : 0));
        const px = Math.round(SCREEN_W / 2 - 56 + shakeX * 0.01);
        const py = Math.round(SCREEN_H - 58 - 11 - bounce);

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

        if (sim.nitroOn || sim.launchBoostTimer > 0) {
          for (const exOff of [36, 76]) {
            const ex = px + exOff;
            const ey = py + 47;
            const flameLen = 7 + (Math.trunc(t * 60 + exOff) % 8);
            for (let fy = 0; fy < flameLen; fy++) {
              const fw = Math.max(1, 4 - Math.trunc((fy * 4) / flameLen));
              const cyan = sim.launchBoostTimer > 0;
              for (let fx = -fw; fx <= fw; fx++) {
                this.pset(ex + fx, ey + fy, cyan ? 90 : 255, cyan ? 185 - fy * 10 : 185 - fy * 10, cyan ? 255 : 70);
              }
            }
          }
        }
      }

      // Crew members alongside or slightly behind the front axle (rear wheel stations / passed outer crew)
      for (let m = 0; m < crewItems.length; m++) {
        const item = crewItems[m];
        if (item.segIdx === ps.idx && item.dzFromPlayer < 210) {
          this.drawPitCrewItem(sim, ps, item, th);
        }
      }
    }
  }

  private drawSegmentRows(
    ps: ProjSeg,
    clipY: number,
    th: ThemeColors,
    flags: number,
    _t: number,
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

      if (startLine) {
        const sq = (w * 2) / 10;
        for (let k = 0; k < 10; k++) {
          const chk = ((k + ps.idx) & 1) ? white32 : this.pack(25, 25, 32);
          this.fillSpan(y, cx - w + k * sq, cx - w + (k + 1) * sq, chk);
        }
      } else if (band) {
        for (let k = 1; k < 3; k++) {
          const lx = cx - w + (2 * w * k) / 3;
          this.fillSpan(y, lx - lw, lx + lw, lane32);
        }
      }

      // World-fixed Pit Complex: inner buffer + 3 fixed-marking pit boxes + wide outer stand apron
      if (!startLine && ps.pit >= PIT_ENTRY && ps.pit <= PIT_EXIT_END) {
        const taper = pitTaperAt(ps.pit);
        const ax0 = cx + w * 1.04;
        const lx0 = cx + w * (1.08 + PIT_STRIP_W * taper);
        const ax1 = cx + w * (pitOuterAt(taper) - 0.10);
        const walk1 = cx + w * (pitOuterAt(taper) + 0.60 * taper);

        // 1. Concrete inner safety margin (left) & wide outer stand apron (right, where technicians wait)
        const slabEven = ((ps.idx >> 1) & 1) === 0;
        const stripBase: [number, number, number] = slabEven ? [118, 124, 136] : [108, 114, 126];
        const stripC = this.mixRgb(stripBase, th.fog, ps.fog);
        const strip32 = this.pack(stripC[0], stripC[1], stripC[2]);
        this.fillSpan(y, ax0, lx0, strip32);
        this.fillSpan(y, ax1, walk1, strip32);

        // 2. Service lane & 3 Pit Boxes — 100% world-fixed ground stripes (zero time scrolling!)
        const segEven = (ps.idx & 1) === 0;
        let bayFloorRgb: [number, number, number] = slabEven ? [62, 68, 82] : [56, 62, 76];
        let bayEdgeRgb: [number, number, number] | null = null;

        if (ps.idx >= PIT_BAY_NITRO.start && ps.idx <= PIT_BAY_NITRO.end) {
          bayFloorRgb = segEven ? [36, 98, 128] : [30, 82, 110];
          bayEdgeRgb = segEven ? [36, 200, 242] : [238, 244, 250];
        } else if (ps.idx >= PIT_BAY_TYRES.start && ps.idx <= PIT_BAY_TYRES.end) {
          bayFloorRgb = segEven ? [96, 84, 46] : [78, 70, 42];
          bayEdgeRgb = segEven ? [246, 198, 38] : [38, 42, 52];
        } else if (ps.idx >= PIT_BAY_ENGINE.start && ps.idx <= PIT_BAY_ENGINE.end) {
          bayFloorRgb = segEven ? [108, 52, 56] : [88, 44, 50];
          bayEdgeRgb = segEven ? [232, 58, 54] : [242, 242, 248];
        }

        const bayC = this.mixRgb(bayFloorRgb, th.fog, ps.fog);
        this.fillSpan(y, lx0, ax1, this.pack(bayC[0], bayC[1], bayC[2]));

        if (bayEdgeRgb) {
          const edgeW = Math.max(2, w * 0.065);
          const ec = this.mixRgb(bayEdgeRgb, th.fog, ps.fog);
          const edge32 = this.pack(ec[0], ec[1], ec[2]);
          this.fillSpan(y, lx0, lx0 + edgeW, edge32);
          this.fillSpan(y, ax1 - edgeW, ax1, edge32);
        }

        // Crisp world-fixed outer white pit line
        this.fillSpan(y, ax1 - lw, ax1 + lw, white32);

        // Fixed transverse box entry & stop lines + center guide dashes
        const isBoxStart =
          ps.idx === PIT_BAY_NITRO.start ||
          ps.idx === PIT_BAY_TYRES.start ||
          ps.idx === PIT_BAY_ENGINE.start;
        const isBoxEnd =
          ps.idx === PIT_BAY_NITRO.end ||
          ps.idx === PIT_BAY_TYRES.end ||
          ps.idx === PIT_BAY_ENGINE.end;

        if ((isBoxStart && u > 0.72) || (isBoxEnd && u < 0.28)) {
          this.fillSpan(y, lx0, ax1, white32);
        } else if (
          ps.idx >= PIT_BAY_TYRES.start &&
          ps.idx <= PIT_BAY_ENGINE.end &&
          segEven
        ) {
          const mid = (lx0 + ax1) * 0.5;
          this.fillSpan(y, mid - lw, mid + lw, white32);
        }

        // Fixed yellow/black hazard curb & concrete pit wall (from Bay 2 onward)
        if (ps.pit >= PIT_WALL_START_REPO && ps.pit <= PIT_WALL_END) {
          const hazRgb: [number, number, number] = segEven ? [245, 205, 40] : [30, 30, 36];
          const hazC = this.mixRgb(hazRgb, th.fog, ps.fog);
          this.fillSpan(y, lx0 - lw, lx0 + lw, this.pack(hazC[0], hazC[1], hazC[2]));

          const wx0 = cx + w * (PIT_WALL_X - 0.035);
          const wx1 = cx + w * (PIT_WALL_X + 0.035);
          const wallCol = segEven ? white32 : this.pack(220, 56, 48);
          this.fillSpan(y, wx0, wx1, wallCol);
        }
      }

      if (flags & SEGF_MID_PIT) {
        const mx0 = cx + w * 0.82;
        const mx1 = cx + w * 1.28;
        const mc = this.mixRgb((ps.idx & 1) ? [38, 205, 240] : [28, 125, 165], th.fog, ps.fog);
        this.fillSpan(y, mx0, mx1, this.pack(mc[0], mc[1], mc[2]));
      }
    }
  }

  private blitTechSprite(
    frameIdx: TechFrame,
    x: number,
    y: number,
    dw: number,
    dh: number,
    clipY: number,
    flip: boolean,
    fog: number,
    th: ThemeColors
  ) {
    if (dw <= 0 || dh <= 0) return;
    const px = TECH_PX[frameIdx] || TECH_PX[0];
    const x0 = Math.max(0, x);
    const x1 = Math.min(SCREEN_W, x + dw);
    const ymax = Math.min(SCREEN_H, clipY);
    const y0 = Math.max(0, y);
    const y1 = Math.min(ymax, y + dh);
    if (x0 >= x1 || y0 >= y1) return;

    const amb = Math.min(256, th.ambient < 256 ? th.ambient + 32 : 256);

    for (let sy = y0; sy < y1; sy++) {
      const srcY = Math.min(TECH_H - 1, Math.trunc(((sy - y) * TECH_H) / dh));
      const rowOff = srcY * TECH_W;
      for (let sx = x0; sx < x1; sx++) {
        let srcX = Math.min(TECH_W - 1, Math.trunc(((sx - x) * TECH_W) / dw));
        if (flip) srcX = TECH_W - 1 - srcX;
        const palIdx = px[rowOff + srcX];
        if (!palIdx) continue;
        const base = TECH_PAL_RGB[palIdx];
        let r = (base[0] * amb) >> 8;
        let g = (base[1] * amb) >> 8;
        let b = (base[2] * amb) >> 8;
        if (fog > 0) {
          const inv = 256 - fog;
          r = (r * inv + th.fog[0] * fog) >> 8;
          g = (g * inv + th.fog[1] * fog) >> 8;
          b = (b * inv + th.fog[2] * fog) >> 8;
        }
        this.buf32[sy * SCREEN_W + sx] = (255 << 24) | (b << 16) | (g << 8) | r;
      }
    }
  }

  private drawPitStaticScenery(ps: ProjSeg, th: ThemeColors, t: number) {
    if (ps.fog > 235 || ps.w1 < 10 || ps.w1 > 370) return;

    const w = ps.w1;
    const sy = Math.round(ps.y1);
    const rectFog = (x0: number, y0: number, x1: number, y1: number, col: [number, number, number]) => {
      const fc = this.mixRgb(col, th.fog, ps.fog);
      const packed = this.pack(fc[0], fc[1], fc[2]);
      const ya = Math.max(0, y0);
      const yb = Math.min(Math.min(SCREEN_H, ps.clip), y1);
      for (let yy = ya; yy < yb; yy++) this.fillSpan(yy, x0, x1, packed);
    };

    // 1. Entry board with blinking amber beacon
    if (ps.pit === PIT_ENTRY + 1) {
      const bx = Math.round(ps.x1 + w * 1.52);
      const bw = Math.round(w * 0.20) + 3;
      const bh = Math.round(w * 0.12) + 3;
      rectFog(bx + (bw >> 1) - 1, sy - bh - (bh >> 1), bx + (bw >> 1) + 1, sy, [140, 145, 155]);
      rectFog(bx, sy - bh - (bh >> 1), bx + bw, sy - (bh >> 1), [24, 148, 210]);
      rectFog(bx + 1, sy - bh - (bh >> 1) + 1, bx + bw - 1, sy - (bh >> 1) - Math.trunc(bh / 3), [250, 250, 250]);
      if ((Math.trunc(t * 6) & 1) === 1) {
        rectFog(bx + (bw >> 1) - 2, sy - bh - (bh >> 1) - 4, bx + (bw >> 1) + 2, sy - bh - (bh >> 1) - 1, [255, 195, 40]);
      }
    }

    // 2. Outer Stand Awnings & Support Posts (at x = 2.95 on the outside, overhanging the waiting crew)
    const isTyreCanopy = ps.idx === PIT_BAY_TYRES.start + 1 || ps.idx === PIT_BAY_TYRES.end - 1;
    const isEngCanopy = ps.idx === PIT_BAY_ENGINE.start + 1 || ps.idx === PIT_BAY_ENGINE.end - 1;
    if (isTyreCanopy || isEngCanopy) {
      const postX = Math.round(ps.x1 + w * 2.96);
      const hh = Math.round(w * 0.30) + 10;
      const postW = Math.max(2, Math.round(w * 0.018));
      rectFog(postX, sy - hh, postX + postW, sy, [168, 176, 192]);
      const rx0 = Math.round(ps.x1 + w * 2.38);
      const roofH = Math.max(3, Math.round(w * 0.028));
      const mainRoofCol: [number, number, number] = isTyreCanopy ? [232, 182, 32] : [224, 48, 48];
      rectFog(rx0, sy - hh - roofH, postX + postW + 2, sy - hh + 1, mainRoofCol);
      const stripeStep = Math.max(6, Math.round(w * 0.08));
      for (let k = rx0; k < postX + postW + 2; k += stripeStep) {
        rectFog(k, sy - hh - roofH, Math.min(postX + postW + 2, k + (stripeStep >> 1)), sy - hh + 1, [246, 248, 252]);
      }
    }

    // 3. Safety cones along the fixed left hazard curb
    if (ps.pit >= PIT_WALL_START_REPO && ps.pit <= PIT_WALL_END && ps.idx % 4 === 0) {
      const cx0 = Math.round(ps.x1 + w * (1.08 + PIT_STRIP_W)) - 1;
      const ch = Math.round(w * 0.065) + 2;
      for (let k = 0; k < ch; k++) {
        const hw2 = Math.trunc((ch - k) / 3) + (k === ch - 1 ? 0 : 1);
        const stripe = Math.trunc((k * 3) / Math.max(1, ch)) === 1;
        rectFog(cx0 - hw2, sy - ch + k, cx0 + hw2 + 1, sy - ch + k + 1, stripe ? [250, 250, 250] : [255, 120, 20]);
      }
    }

    // 4. Spare tyre stacks on the outside stand apron (next to waiting crew)
    if (
      ps.idx === PIT_BAY_TYRES.start + 1 ||
      ps.idx === PIT_BAY_TYRES.end - 1 ||
      ps.idx === PIT_BAY_ENGINE.start + 2
    ) {
      const tx = Math.round(ps.x1 + w * 2.86);
      const rr = Math.round(w * 0.045) + 2;
      for (let k = 0; k < 3; k++) {
        const y1 = sy - Math.trunc((k * rr * 3) / 2);
        rectFog(tx - rr * 2, y1 - Math.trunc((rr * 3) / 2), tx + rr * 2, y1, [26, 26, 30]);
        rectFog(tx - rr, y1 - rr, tx + rr, y1 - (rr >> 1) - 1, [150, 155, 168]);
      }
    }
  }

  private buildPitCrewRenderItems(
    sim: AkaRaceSimulator,
    segCount: number,
    playerWorldZ: number,
    t: number
  ): PitCrewRenderItem[] {
    const items: PitCrewRenderItem[] = [];
    const roadLen = sim.road.length;

    const smooth01 = (v: number) => {
      const c = Math.max(0, Math.min(1, v));
      return c * c * (3 - 2 * c);
    };

    for (let b = 0 as 0 | 1; b < 2; b = (b + 1) as 0 | 1) {
      const crew = sim.pitBayCrews[b];
      const bayStart = b === 0 ? PIT_BAY_TYRES.start : PIT_BAY_ENGINE.start;
      const u = crew.progress;
      const isIdle = crew.phase === 'IDLE_OUTSIDE' || u <= 0.002;
      const isWorking = crew.phase === 'WORKING' && u >= 0.99;
      const isWalkingIn = crew.phase === 'WALKING_IN';

      // Crew roster: ALL wait outside on the right stand apron (x = 2.64 .. 2.74)
      // Left-flank mechanics follow a 3-leg U-path around the front nose so they never cross through the car!
      const specs: Array<{
        side: 'right' | 'left' | 'hood' | 'lollipop';
        idleSegOff: number;
        idleX: number;
        workDz: number;
        workDx: number;
        carriesTyre: boolean;
      }> = [
        { side: 'right', idleSegOff: 1.7, idleX: 2.65, workDz: 165, workDx: 0.255, carriesTyre: true },
        { side: 'left', idleSegOff: 2.6, idleX: 2.74, workDz: 170, workDx: -0.255, carriesTyre: false },
        { side: 'right', idleSegOff: 3.8, idleX: 2.65, workDz: 375, workDx: 0.245, carriesTyre: false },
        { side: 'left', idleSegOff: 4.7, idleX: 2.74, workDz: 375, workDx: -0.245, carriesTyre: true },
      ];

      if (b === 1) {
        specs.push({
          side: 'hood',
          idleSegOff: 5.5,
          idleX: 2.70,
          workDz: 472,
          workDx: 0.08,
          carriesTyre: false,
        });
      }

      specs.push({
        side: 'lollipop',
        idleSegOff: 6.3,
        idleX: 2.63,
        workDz: 565,
        workDx: 0.16,
        carriesTyre: false,
      });

      for (let mIdx = 0; mIdx < specs.length; mIdx++) {
        const sp = specs[mIdx];
        const idleZ = (bayStart + sp.idleSegOff) * SEG_LEN;
        const targetZ = crew.anchorZ + sp.workDz;
        const targetX = crew.anchorX + sp.workDx;

        let worldZ = idleZ;
        let worldX = sp.idleX;
        let dir: 1 | -1 = -1; // Facing pit lane (-1) while waiting outside

        if (isIdle) {
          worldZ = idleZ;
          worldX = sp.idleX;
          dir = -1;
        } else if (isWorking) {
          worldZ = targetZ;
          worldX = targetX;
          dir = sp.side === 'left' ? 1 : -1;
        } else if (sp.side === 'left') {
          // 3-leg path around the front bumper (noseZ) so mechanics never pass through the car
          const noseZ = crew.anchorZ + (sp.workDz < 250 ? 555 : 532);
          const rightClearX = Math.max(crew.anchorX + 0.29, 2.52);
          const leftClearX = crew.anchorX - 0.26;

          if (u <= 0.34) {
            const k = smooth01(u / 0.34);
            worldZ = idleZ + (noseZ - idleZ) * k;
            worldX = sp.idleX + (rightClearX - sp.idleX) * k;
            dir = isWalkingIn ? -1 : 1;
          } else if (u <= 0.70) {
            const k = smooth01((u - 0.34) / 0.36);
            worldZ = noseZ;
            worldX = rightClearX + (leftClearX - rightClearX) * k;
            dir = isWalkingIn ? -1 : 1;
          } else {
            const k = smooth01((u - 0.70) / 0.30);
            worldZ = noseZ + (targetZ - noseZ) * k;
            worldX = leftClearX + (targetX - leftClearX) * k;
            dir = 1;
          }
        } else {
          // Direct path between outside stand apron and right flank / front nose
          const k = smooth01(u);
          worldZ = idleZ + (targetZ - idleZ) * k;
          worldX = sp.idleX + (targetX - sp.idleX) * k;
          dir = isWalkingIn ? -1 : 1;
        }

        const isLolli = sp.side === 'lollipop';
        const showGoSign =
          isLolli &&
          crew.phase === 'WALKING_OUT' &&
          sim.lollipopState === 'GO' &&
          sim.lollipopGoTimer > 0;

        let frame: TechFrame = TechFrame.IDLE;
        let yOffset = 0;

        if (isLolli) {
          if (isWorking || (isWalkingIn && u > 0.88)) {
            frame = TechFrame.RAISED;
            dir = -1;
          } else if (!isIdle) {
            frame = (Math.trunc(t * 7 + mIdx) & 1) ? TechFrame.WALK_A : TechFrame.WALK_B;
            yOffset = Math.trunc(t * 12 + mIdx) & 1;
          } else {
            frame = TechFrame.IDLE;
          }
        } else if (isWorking) {
          // Strictly work ONLY when beside the stopped car!
          frame = TechFrame.WORK;
          yOffset = Math.trunc(t * 14 + mIdx) & 1;
        } else if (!isIdle) {
          if (sp.carriesTyre && isWalkingIn && u < 0.82) {
            frame = TechFrame.TYRE;
          } else {
            frame = (Math.trunc(t * 7.5 + mIdx * 1.3 + b) & 1) ? TechFrame.WALK_A : TechFrame.WALK_B;
          }
          yOffset = Math.trunc(t * 12 + mIdx) & 1;
        }

        const wrappedZ = ((worldZ % roadLen) + roadLen) % roadLen;
        const segIdx = Math.trunc(wrappedZ / SEG_LEN) % segCount;
        const pctInSeg = (wrappedZ % SEG_LEN) / SEG_LEN;
        let dzFromPlayer = wrappedZ - playerWorldZ;
        if (dzFromPlayer < -roadLen * 0.5) dzFromPlayer += roadLen;
        if (dzFromPlayer > roadLen * 0.5) dzFromPlayer -= roadLen;

        items.push({
          segIdx,
          pctInSeg,
          dzFromPlayer,
          worldX,
          dir,
          frame,
          yOffset,
          isWorking: isWorking && !isLolli,
          isLollipop: isLolli,
          showGoSign,
        });
      }
    }

    // Sort far-to-near within the same segment for clean overlap
    items.sort((a, b) => b.dzFromPlayer - a.dzFromPlayer);
    return items;
  }

  private drawPitCrewItem(
    sim: AkaRaceSimulator,
    ps: ProjSeg,
    item: PitCrewRenderItem,
    th: ThemeColors
  ) {
    if (ps.fog > 235) return;
    // Skip technicians already behind the camera plane (dzFromPlayer < -760 means z_cam < 80)
    if (item.dzFromPlayer < -60) return;

    const pct = item.pctInSeg;
    const sc = ps.s1 + (ps.s2 - ps.s1) * pct;
    const wAt = sc * ROAD_W * (SCREEN_W / 2);
    if (wAt < 9 || wAt > 365) return;

    const roadCenterX = ps.x1 + (ps.x2 - ps.x1) * pct;
    const sy = Math.round(ps.y1 + (ps.y2 - ps.y1) * pct);
    const clipY = Math.min(SCREEN_H, Math.max(ps.clip, sy + 1));

    const dh = Math.round(wAt * 0.185) + 8;
    const dw = Math.max(4, Math.trunc((dh * TECH_W) / TECH_H));
    const cxp = Math.round(roadCenterX + wAt * item.worldX);
    const bx = cxp - (dw >> 1);
    const by = sy - dh - item.yOffset;
    const flip = item.dir < 0;

    this.blitTechSprite(item.frame, bx, by, dw, dh, clipY, flip, ps.fog, th);

    // Lollipop pole & STOP / READY / GO disc
    if (item.isLollipop && (item.frame === TechFrame.RAISED || item.showGoSign)) {
      const gloveCol = flip ? TECH_W - 1 - 22 : 22;
      const lx = bx + Math.round((dw * gloveCol) / TECH_W);
      const poleTop = sy - Math.round(dh * 1.24);
      const rad = Math.max(3, Math.round(dw * 0.24));

      const poleC = this.mixRgb([212, 218, 228], th.fog, ps.fog);
      const polePacked = this.pack(poleC[0], poleC[1], poleC[2]);
      for (let yy = Math.max(0, poleTop); yy < Math.min(clipY, sy); yy++) {
        this.fillSpan(yy, lx, lx + 2, polePacked);
      }

      const discRaw: [number, number, number] =
        item.showGoSign || sim.lollipopState === 'GO'
          ? [52, 242, 115]
          : sim.lollipopState === 'READY'
          ? [255, 210, 48]
          : [245, 52, 48];
      const discC = this.mixRgb(discRaw, th.fog, ps.fog);
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (dx * dx + dy * dy <= rad * rad) {
            this.psetClip(lx + dx, poleTop + dy, clipY, discC[0], discC[1], discC[2]);
          }
        }
      }
    }

    // Pneumatic impact wrench sparks when actively working beside the car
    if (item.isWorking && item.yOffset > 0) {
      const ex = cxp + item.dir * ((dw >> 1) + 1);
      const ey = sy - Math.trunc((dh * 2) / 5);
      const sp1 = this.mixRgb([255, 232, 95], th.fog, ps.fog);
      const sp2 = this.mixRgb([255, 148, 38], th.fog, ps.fog);
      this.psetClip(ex, ey, clipY, sp1[0], sp1[1], sp1[2]);
      this.psetClip(ex + item.dir, ey - 1, clipY, sp2[0], sp2[1], sp2[2]);
      this.psetClip(ex - item.dir, ey + 1, clipY, sp2[0], sp2[1], sp2[2]);
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
    const look = c.look % CAR_COUNT;
    const pct = Math.max(0, Math.min(1, c.speed / MAX_SPEED));

    // Locked-in 3D-Hybrid rigid rotation + GitHub commit 20f8e8f speed-dependent turn angle!
    const effAbs =
      c.isPlayer && sim.spinT > 0 && sim.spinDir !== 0
        ? 1.0
        : Math.abs(sv) * (0.22 + 0.78 * pct * pct);
    const flip =
      c.isPlayer && sim.spinT > 0 && sim.spinDir !== 0 ? sim.spinDir > 0 : sv > 0;

    const sel = getUnifiedRigidFrame(atlas, look, effAbs, true);
    const frame = sel.frame;
    const isWide = frame.w === CAR_ART3Q_W;
    const uStage = sel.uStage;

    const dhA = Math.max(2, Math.round((dw * CAR_ART_H) / CAR_ART_W));
    const pw = isWide ? Math.round((dw * CAR_ART3Q_W) / CAR_ART_W) : dw;
    const px0 = isWide ? x - ((pw - dw) >> 1) : x;
    const ya = y + Math.round((dh * 52) / 58) - Math.round((dhA * (93 + Math.round(4 * uStage))) / 100);

    // Unmirrored directional ground contact shadow (sun fixed lower-left, matches commit 9ebfcfe)
    const shadowY = ya + dhA - Math.max(1, Math.round(dhA * 0.06));
    if (shadowY > 0 && shadowY < clipY && shadowY < SCREEN_H) {
      const rx = Math.round(pw * 0.44);
      const cx = px0 + (pw >> 1) + Math.round(dw * 0.03);
      for (let sy = shadowY - 2; sy <= shadowY + 3; sy++) {
        if (sy < 0 || sy >= clipY || sy >= SCREEN_H) continue;
        for (let sx = Math.max(0, cx - rx); sx < Math.min(SCREEN_W, cx + rx); sx++) {
          this.blendPixel(sx, sy, 6, 8, 14, 130);
        }
      }
    }

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

    if ((c.braking || th.ambient < 245) && dw > 9 && fog < 198) {
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
    for (const pt of sim.particles) {
      const alpha = Math.max(0, Math.min(220, Math.trunc((pt.life / pt.maxLife) * 220)));
      const hs = pt.size >> 1;
      for (let dy = -hs; dy <= hs; dy++) {
        for (let dx = -hs; dx <= hs; dx++) {
          this.blendPixel(Math.round(pt.x) + dx, Math.round(pt.y) + dy, pt.r, pt.g, pt.b, alpha);
        }
      }
    }

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

    const shadowText = (
      txt: string,
      x: number,
      y: number,
      color = '#FFFFFF',
      font?: string,
      maxWidth?: number
    ) => {
      if (font) ctx.font = font;
      ctx.fillStyle = '#090B10';
      if (maxWidth !== undefined) {
        ctx.fillText(txt, x + 1, y + 1, maxWidth);
        ctx.fillStyle = color;
        ctx.fillText(txt, x, y, maxWidth);
      } else {
        ctx.fillText(txt, x + 1, y + 1);
        ctx.fillStyle = color;
        ctx.fillText(txt, x, y);
      }
    };

    shadowText(`P${pl.place}`, 7, 5, '#FFE866', 'bold 18px "Barlow Condensed", sans-serif');
    shadowText(`/${CAR_COUNT}`, 28, 11, '#E2E8F0', 'bold 10px "JetBrains Mono", monospace');

    const ordered = [...sim.cars].sort((a, b) => a.place - b.place);
    let lbRightEdge = 6;
    if (!sim.features.compactHudL1) {
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      let maxTagW = 42;
      for (let i = 0; i < ordered.length; i++) {
        const c = ordered[i];
        const tag = c.platform !== 'AI' ? `${c.name.slice(0, 5)}` : c.name;
        const tw = ctx.measureText(tag).width;
        if (tw > maxTagW) maxTagW = tw;
      }
      const lbW = Math.min(82, Math.max(74, Math.ceil(26 + maxTagW + 6)));
      lbRightEdge = 6 + lbW;
      ctx.fillStyle = 'rgba(8, 11, 20, 0.58)';
      ctx.fillRect(6, 27, lbW, CAR_COUNT * 10 + 4);
      for (let i = 0; i < ordered.length; i++) {
        const c = ordered[i];
        const yy = 29 + i * 10;
        if (c.isPlayer) {
          ctx.fillStyle = 'rgba(255, 210, 60, 0.25)';
          ctx.fillRect(7, yy - 1, lbW - 2, 9);
        }
        ctx.fillStyle = DRIVERS[c.look % CAR_COUNT].hex;
        ctx.fillRect(18, yy + 1, 5, 6);
        const tag = c.platform !== 'AI' ? `${c.name.slice(0, 5)}` : c.name;
        shadowText(`${i + 1}`, 8, yy, c.isPlayer ? '#FFE46B' : '#CBD5E1', 'bold 8px "JetBrains Mono", monospace');
        shadowText(tag, 26, yy, c.isPlayer ? '#FFE46B' : c.isRemoteHuman ? '#67E8F9' : '#F8FAFC', 'bold 8px "JetBrains Mono", monospace', lbW - 30);
      }
    } else {
      const compactLabel = `AKA COMPACT · ${pl.name}`;
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      const cw = Math.min(180, Math.ceil(ctx.measureText(compactLabel).width) + 10);
      ctx.fillStyle = 'rgba(8, 11, 20, 0.58)';
      ctx.fillRect(6, 27, cw, 14);
      shadowText(compactLabel, 11, 30, '#67E8F9', 'bold 8px "JetBrains Mono", monospace', cw - 10);
    }

    const lapStr = `LAP ${sim.playerLap()}/${sim.laps}`;
    ctx.font = 'bold 14px "Barlow Condensed", sans-serif';
    const lapW = Math.ceil(ctx.measureText(lapStr).width);
    shadowText(lapStr, SCREEN_W - 7 - lapW, 6, '#7DD3FC', 'bold 14px "Barlow Condensed", sans-serif');

    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    const timeStr = `TIME ${this.formatLapTime(sim.raceTime - pl.lapStart)}`;
    const timeW = Math.ceil(ctx.measureText(timeStr).width);
    shadowText(timeStr, SCREEN_W - 7 - timeW, 23, '#F8FAFC', 'bold 8px "JetBrains Mono", monospace');
    if (pl.bestLap > 0) {
      const bestStr = `BEST ${this.formatLapTime(pl.bestLap)}`;
      const bestW = Math.ceil(ctx.measureText(bestStr).width);
      shadowText(bestStr, SCREEN_W - 7 - bestW, 33, '#FDE047', 'bold 8px "JetBrains Mono", monospace');
    }

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

    const drawBar = (bx: number, label: string, val01: number, colHex: string, warnBlink = false) => {
      const by = 184, bh = 44;
      ctx.fillStyle = 'rgba(8, 11, 20, 0.68)';
      ctx.fillRect(bx, by, 8, bh);
      const h = Math.round(Math.max(0, Math.min(1, val01)) * bh);
      ctx.fillStyle = warnBlink && (Math.trunc(sim.globalTime * 7) & 1) ? '#FFFFFF' : colHex;
      ctx.fillRect(bx + 1, by + bh - h, 6, h);
      ctx.strokeStyle = warnBlink ? '#F87171' : '#94A3B8';
      ctx.strokeRect(bx + 0.5, by + 0.5, 7, bh - 1);
      ctx.font = 'bold 7px "JetBrains Mono", monospace';
      const lw = ctx.measureText(label).width;
      shadowText(label, Math.round(bx + 4 - lw / 2), by - 9, '#CBD5E1', 'bold 7px "JetBrains Mono", monospace');
    };

    const grip01 = 1 - sim.tyreWear;
    const eng01 = 1 - sim.damage;
    drawBar(203, 'TYR', grip01, grip01 > 0.45 ? '#FACC15' : '#FB923C', sim.tyreWear > 0.75);
    drawBar(219, 'ENG', eng01, eng01 > 0.5 ? '#4ADE80' : '#EF4444', sim.damage > 0.72);
    drawBar(235, 'N2O', sim.nitro, '#38BDF8', false);

    const spX = 250, spY = 184, spW = 64, spH = 50;
    ctx.fillStyle = 'rgba(8, 11, 20, 0.72)';
    ctx.fillRect(spX, spY, spW, spH);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.strokeRect(spX + 0.5, spY + 0.5, spW - 1, spH - 1);
    const kmh = Math.round(sim.speedKmh());
    shadowText(`${kmh}`, spX + 6, spY + 8, '#FFFFFF', 'bold 21px "Barlow Condensed", sans-serif');
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    const kmhUnitW = Math.ceil(ctx.measureText('KM/H').width);
    shadowText('KM/H', spX + spW - 5 - kmhUnitW, spY + 17, '#94A3B8', 'bold 8px "JetBrains Mono", monospace');
    shadowText(`G${sim.gear}`, spX + 6, spY + 35, '#FBBF24', 'bold 9px "JetBrains Mono", monospace');
    if (sim.inPitLane) {
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      const pitW = Math.ceil(ctx.measureText('PIT').width);
      shadowText('PIT', spX + spW - 5 - pitW, spY + 35, '#38BDF8', 'bold 9px "JetBrains Mono", monospace');
    }

    if (sim.inPitLane || sim.lollipopState === 'GO') {
      const bayCrew =
        sim.activePitBay === 'TYRES'
          ? sim.pitBayCrews[0]
          : sim.activePitBay === 'ENGINE'
          ? sim.pitBayCrews[1]
          : null;
      const bayTitle =
        sim.lollipopState === 'GO'
          ? 'LOLLIPOP : GO! VOIE LIBRE'
          : bayCrew && bayCrew.phase === 'WORKING'
          ? sim.activePitBay === 'TYRES'
            ? 'STAND 2 · TRAVAIL EN COURS'
            : 'STAND 3 · REVISION EN COURS'
          : bayCrew && bayCrew.phase === 'WALKING_IN'
          ? 'ARRET · ARRIVEE TECHNICIENS'
          : sim.activePitBay === 'NITRO'
          ? 'STAND 1 · N2O EXPRESS (<95)'
          : sim.activePitBay === 'TYRES'
          ? 'STAND 2 · PNEUS (ARRET 0 KM/H)'
          : sim.activePitBay === 'ENGINE'
          ? 'STAND 3 · MOTEUR (ARRET 0 KM/H)'
          : 'VOIE DES STANDS · 85 KM/H';
      const statsLine = `ENG ${Math.round(eng01 * 100)}% · TYR ${Math.round(grip01 * 100)}% · N2O ${Math.round(sim.nitro * 100)}%`;

      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      const tw1 = ctx.measureText(bayTitle).width;
      const tw2 = ctx.measureText(statsLine).width;
      const availX0 = sim.features.compactHudL1 ? 6 : lbRightEdge + 6;
      const maxBoxW = SCREEN_W - 6 - availX0;
      const boxW = Math.min(maxBoxW, Math.ceil(Math.max(tw1, tw2)) + 18);
      const boxH = 34;
      const boxX = availX0 + Math.max(0, Math.floor((maxBoxW - boxW) / 2));
      const boxY = 44;
      const innerMaxW = boxW - 12;
      const drawW1 = Math.min(tw1, innerMaxW);
      const drawW2 = Math.min(tw2, innerMaxW);

      ctx.fillStyle = 'rgba(10, 15, 28, 0.88)';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = sim.lollipopState === 'GO' ? '#4ADE80' : '#FACC15';
      ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
      shadowText(
        bayTitle,
        boxX + Math.round((boxW - drawW1) / 2),
        boxY + 5,
        sim.lollipopState === 'GO' ? '#4ADE80' : '#FDE047',
        'bold 8px "JetBrains Mono", monospace',
        innerMaxW
      );
      shadowText(
        statsLine,
        boxX + Math.round((boxW - drawW2) / 2),
        boxY + 19,
        '#E2E8F0',
        'bold 8px "JetBrains Mono", monospace',
        innerMaxW
      );
    } else if (sim.damage > 0.42 && (Math.trunc(sim.globalTime * 4) & 1) === 0) {
      const warnTxt = 'STAND A DROITE AVANT LIGNE';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      const ww = Math.min(SCREEN_W - 92, ctx.measureText(warnTxt).width);
      shadowText(
        warnTxt,
        Math.max(lbRightEdge + 6, Math.round((SCREEN_W - ww) / 2)),
        46,
        '#FDBA74',
        'bold 8px "JetBrains Mono", monospace',
        SCREEN_W - 92
      );
    }

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

    if (sim.bannerTimer > 0 && sim.bannerText) {
      const [r, g, b] = sim.bannerColor;
      ctx.font = 'bold 14px "Barlow Condensed", sans-serif';
      const tw = ctx.measureText(sim.bannerText).width;
      shadowText(sim.bannerText, Math.max(6, Math.round((SCREEN_W - tw) / 2)), 84, `rgb(${r},${g},${b})`);
    }

    if (sim.screenState === 'RESULTS') {
      ctx.fillStyle = 'rgba(8, 11, 20, 0.84)';
      ctx.fillRect(18, 28, SCREEN_W - 36, SCREEN_H - 52);
      ctx.strokeStyle = '#F97316';
      ctx.strokeRect(18.5, 28.5, SCREEN_W - 37, SCREEN_H - 53);
      ctx.font = 'bold 14px "Barlow Condensed", sans-serif';
      const titleTxt = 'CLASSEMENT GRAND PRIX';
      const titleW = ctx.measureText(titleTxt).width;
      shadowText(titleTxt, Math.round((SCREEN_W - titleW) / 2), 34, '#FDE047', 'bold 14px "Barlow Condensed", sans-serif');
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
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        const tStrW = ctx.measureText(tStr).width;
        shadowText(tStr, SCREEN_W - 26 - Math.ceil(tStrW), yy, '#CBD5E1', 'bold 9px "JetBrains Mono", monospace');
      }
      const restartTxt = 'A / ESPACE : RELANCER LA COURSE';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      const restartW = ctx.measureText(restartTxt).width;
      shadowText(restartTxt, Math.round((SCREEN_W - restartW) / 2), 192, '#38BDF8', 'bold 9px "JetBrains Mono", monospace');
    }

    if (sim.paused) {
      const pauseTxt = 'PAUSE (RUN / ENTREE)';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      const pw = Math.ceil(ctx.measureText(pauseTxt).width);
      const pBoxW = Math.max(148, pw + 24);
      const pBoxX = Math.round((SCREEN_W - pBoxW) / 2);
      ctx.fillStyle = 'rgba(8, 11, 20, 0.82)';
      ctx.fillRect(pBoxX, 92, pBoxW, 48);
      ctx.strokeStyle = '#FACC15';
      ctx.strokeRect(pBoxX + 0.5, 92.5, pBoxW - 1, 47);
      shadowText(pauseTxt, Math.round((SCREEN_W - pw) / 2), 110, '#FDE047', 'bold 11px "JetBrains Mono", monospace');
    }

    ctx.restore();
  }
}
