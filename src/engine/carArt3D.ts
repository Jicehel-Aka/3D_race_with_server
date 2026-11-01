import { CAR_COUNT } from '../shared/raceProtocol';

// Matches main/game/car_art.h dimensions in Race3D-AKA
export const CAR_ART_W = 176;
export const CAR_ART_H = 84;
export const CAR_ART3Q_W = 224;
export const CAR_ART_MID = 5; // stages 1..5 intermediate, stage 6 = full 3/4 rear view
export const UNIFIED_YAW_MAX_DEG = 29.0; // exact calibrated Stage-6 3/4 yaw angle
export const UNIFIED_DENSE_COUNT = 19; // 0.0° .. 29.0° in 1.61° rigid 3D-Hybrid steps (zero 2D morph!)

export type SpriteMode =
  | 'unified_3d'
  | 'repo_2c7e371'
  | 'hybrid_clean'
  | 'v11_front_bug'
  | 'v11_locked';

export interface CarSpriteFrame {
  w: number;
  h: number;
  rgba: Uint8ClampedArray; // w * h * 4
  lampBox: [number, number, number, number, number, number, number, number]; // [lx0,ly0,lx1,ly1, rx0,ry0,rx1,ry1]
  yawDeg?: number;
}

export interface CarArtAtlas {
  ready: boolean;
  // Unified 3D GT Supercar built directly from 2c7e371 Stage 6 anatomy (same trunk, rectangular lamps, wing & low diffuser from 0° to 35°):
  // - unified3dFrames: [driver 0..7][stage 0..6] (exact 7-stage Gamebuino AKA Flash layout)
  // - unified3dDenseFrames: [driver 0..7][angle 0..18] (19 pure rigid Z-buffered 3D angles, 1.94°/step, ZERO cross-fade)
  unified3dFrames: CarSpriteFrame[][];
  unified3dDenseFrames: CarSpriteFrame[][];
  // Current GitHub commit 2c7e371 from Jicehel-Aka/Race3D-AKA: [driver 0..7][stage 0..6]
  repo2c7Frames: CarSpriteFrame[][];
  // Previous 2D cross-fade Hybrid v3 kept for A/B comparison: [driver 0..7][stage 0..6]
  hybridCleanFrames: CarSpriteFrame[][];
  // Archive v1.1 decoded sprites (commit 3fb7d5e) with front-3/4 bug
  v11OrigRear: CarSpriteFrame[];
  v11OrigBad3q: CarSpriteFrame[];
  kLampRearRepo: [number, number, number, number, number, number, number, number];
  kLamp3qRepo: Array<[number, number, number, number, number, number, number, number]>;
  kLampRearUnified: [number, number, number, number, number, number, number, number];
  kLamp3qUnified: [number, number, number, number, number, number, number, number];
}

// Exact lamp boxes from Jicehel-Aka/Race3D-AKA commit 2c7e371 main/game/car_art.h
const REPO_KLAMP_REAR: [number, number, number, number, number, number, number, number] = [
  18, 42, 48, 55, 122, 42, 152, 54,
];
const REPO_KLAMP_3Q: Array<[number, number, number, number, number, number, number, number]> = [
  [82, 41, 111, 50, 176, 41, 206, 50], // VIPER
  [80, 41, 110, 51, 176, 41, 206, 51], // BLAZE
  [83, 40, 109, 50, 178, 41, 203, 49], // NOVA
  [82, 41, 111, 50, 176, 41, 206, 50], // RAVEN
  [82, 41, 111, 50, 176, 41, 206, 50], // ACE
  [82, 41, 111, 50, 176, 41, 206, 50], // ZED
  [80, 41, 110, 51, 176, 41, 206, 51], // KAI
  [83, 41, 110, 50, 178, 41, 200, 50], // YOU
];

// Analytically projects the exact 3D rectangular taillights of the Unified 3D 2c7 GT model at yawDeg!
export function projectUnifiedLampBox(
  yawDeg: number,
  outW: number
): [number, number, number, number, number, number, number, number] {
  const yaw = (yawDeg * Math.PI) / 180;
  const yawMax = (UNIFIED_YAW_MAX_DEG * Math.PI) / 180;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const zPiv = 0.65;
  const camDist = 7.6;
  const camY = 0.565;
  const horizonY = 36.0;
  const focal = 82.5 * (camDist - zPiv);
  const cxScr =
    outW === CAR_ART_W
      ? CAR_ART_W * 0.5
      : 112.0 + 14.2 * (sy / Math.sin(yawMax));

  const projPt = (x: number, y: number, z: number): [number, number] => {
    const dz = z - zPiv;
    const xw = x * cy - dz * sy;
    const zw = x * sy + dz * cy;
    const zc = camDist + zw;
    return [
      Math.round(cxScr + (xw * focal) / zc),
      Math.round(horizonY - ((y - camY) * focal) / zc),
    ];
  };

  // Left & Right horizontal rectangular lamps on the 3D rear fascia (matches Stage 6 [82..110, 42..51] & [175..204, 42..50])
  const [lx0, ly0] = projPt(-0.93, 0.478, 0.055);
  const [lx1, ly1] = projPt(-0.52, 0.372, 0.032);
  const [rx0, ry0] = projPt(0.52, 0.478, 0.032);
  const [rx1, ry1] = projPt(0.93, 0.372, 0.055);

  return [
    Math.min(lx0, lx1),
    Math.min(ly0, ly1),
    Math.max(lx0, lx1),
    Math.max(ly0, ly1),
    Math.min(rx0, rx1),
    Math.min(ry0, ry1),
    Math.max(rx0, rx1),
    Math.max(ry0, ry1),
  ];
}

function interpolateRepoLampBox(
  driverIdx: number,
  stage: number,
  forceWide = false
): [number, number, number, number, number, number, number, number] {
  if (stage === 0 && !forceWide) return [...REPO_KLAMP_REAR];
  const u = stage / (CAR_ART_MID + 1);
  const tq = REPO_KLAMP_3Q[driverIdx % CAR_COUNT];
  const out = [0, 0, 0, 0, 0, 0, 0, 0] as [
    number, number, number, number, number, number, number, number
  ];
  const padX = (CAR_ART3Q_W - CAR_ART_W) >> 1;
  for (let q = 0; q < 8; q++) {
    const a0 = REPO_KLAMP_REAR[q] + (q & 1 ? 0 : padX);
    const a1 = tq[q];
    out[q] = a0 + Math.trunc((a1 - a0) * u + (a1 >= a0 ? 0.5 : -0.5));
  }
  return out;
}

// Pure Rigid 3D frame selector for 'unified_3d':
// Every single returned frame is a razor-sharp Z-buffered 3D projection — ZERO 2D cross-fade!
export function getUnifiedRigidFrame(
  atlas: CarArtAtlas,
  driverIdx: number,
  absSteer: number,
  useDense19: boolean
): { frame: CarSpriteFrame; uStage: number; angleDeg: number; stageIdx: number; maxStage: number } {
  const d = ((driverIdx % CAR_COUNT) + CAR_COUNT) % CAR_COUNT;
  const norm = absSteer <= 0.03 ? 0 : Math.min(1, (absSteer - 0.03) / 0.82);

  if (useDense19 && atlas.unified3dDenseFrames[d]?.length === UNIFIED_DENSE_COUNT) {
    const idx19 = Math.min(UNIFIED_DENSE_COUNT - 1, Math.round(norm * (UNIFIED_DENSE_COUNT - 1)));
    const frame = atlas.unified3dDenseFrames[d][idx19];
    const angleDeg = (UNIFIED_YAW_MAX_DEG * idx19) / (UNIFIED_DENSE_COUNT - 1);
    return {
      frame,
      uStage: idx19 / (UNIFIED_DENSE_COUNT - 1),
      angleDeg,
      stageIdx: idx19,
      maxStage: UNIFIED_DENSE_COUNT - 1,
    };
  }

  const idx7 = Math.min(6, Math.round(norm * 6));
  const frame = atlas.unified3dFrames[d][idx7];
  const angleDeg = (UNIFIED_YAW_MAX_DEG * idx7) / 6;
  return {
    frame,
    uStage: idx7 / 6,
    angleDeg,
    stageIdx: idx7,
    maxStage: 6,
  };
}

function sampleRowSubpixel(
  rgba: Uint8ClampedArray,
  w: number,
  y: number,
  fx: number
): [number, number, number, number] {
  if (fx < 0 || fx > w - 1) return [0, 0, 0, 0];
  const x0 = Math.floor(fx);
  if (x0 >= w - 1) {
    const idx = (y * w + (w - 1)) * 4;
    return [rgba[idx], rgba[idx + 1], rgba[idx + 2], rgba[idx + 3] / 255];
  }
  const f = fx - x0;
  const i0 = (y * w + x0) * 4;
  const i1 = i0 + 4;
  const a0 = rgba[i0 + 3] / 255;
  const a1 = rgba[i1 + 3] / 255;
  const a = (1 - f) * a0 + f * a1;
  if (a < 1e-3) return [0, 0, 0, 0];
  const w0 = (1 - f) * a0;
  const w1 = f * a1;
  const ws = w0 + w1;
  return [
    (rgba[i0] * w0 + rgba[i1] * w1) / ws,
    (rgba[i0 + 1] * w0 + rgba[i1 + 1] * w1) / ws,
    (rgba[i0 + 2] * w0 + rgba[i1 + 2] * w1) / ws,
    a,
  ];
}

// Legacy 2D cross-fade interpolation kept ONLY for 'hybrid_clean' comparison mode
export function blendContinuousStage(
  stages: CarSpriteFrame[],
  driverIdx: number,
  fStage: number
): CarSpriteFrame {
  const clamped = Math.max(0, Math.min(6, fStage));
  const pad0 = (CAR_ART3Q_W - CAR_ART_W) >> 1;

  if (clamped <= 0.001) {
    const s0 = stages[0];
    if (s0.w === CAR_ART3Q_W) return s0;
    const out0 = new Uint8ClampedArray(CAR_ART3Q_W * CAR_ART_H * 4);
    for (let y = 0; y < CAR_ART_H; y++) {
      const srcOff = y * CAR_ART_W * 4;
      const dstOff = (y * CAR_ART3Q_W + pad0) * 4;
      out0.set(s0.rgba.subarray(srcOff, srcOff + CAR_ART_W * 4), dstOff);
    }
    return {
      w: CAR_ART3Q_W,
      h: CAR_ART_H,
      rgba: out0,
      lampBox: interpolateRepoLampBox(driverIdx, 0, true),
    };
  }

  if (clamped >= 5.999) return stages[6];

  const sA = Math.min(5, Math.floor(clamped));
  const sB = sA + 1;
  const frac = clamped - sA;

  const fA = stages[sA];
  const fB = stages[sB];
  const padA = fA.w === CAR_ART_W ? pad0 : 0;
  const out = new Uint8ClampedArray(CAR_ART3Q_W * CAR_ART_H * 4);

  for (let y = 0; y < CAR_ART_H; y++) {
    const tY = Math.max(0, Math.min(1, (y - 20) / 14));
    const shiftY = 0.5 + tY * 5.9;
    for (let x = 0; x < CAR_ART3Q_W; x++) {
      const zoneW = Math.max(0.25, Math.min(1.0, (x - 42) / 48));
      const ax = x - padA - frac * shiftY * zoneW;
      const bx = x + (1 - frac) * shiftY * zoneW;

      const [aR, aG, aB, aA] = sampleRowSubpixel(fA.rgba, fA.w, y, ax);
      const [bR, bG, bB, bA] = sampleRowSubpixel(fB.rgba, fB.w, y, bx);

      const wA = (1 - frac) * aA;
      const wB = frac * bA;
      const wSum = wA + wB;
      if (wSum >= 0.48) {
        const oi = (y * CAR_ART3Q_W + x) * 4;
        out[oi] = Math.round((aR * wA + bR * wB) / wSum);
        out[oi + 1] = Math.round((aG * wA + bG * wB) / wSum);
        out[oi + 2] = Math.round((aB * wA + bB * wB) / wSum);
        out[oi + 3] = 255;
      }
    }
  }

  return {
    w: CAR_ART3Q_W,
    h: CAR_ART_H,
    rgba: out,
    lampBox: interpolateRepoLampBox(driverIdx, clamped, true),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.referrerPolicy = 'no-referrer';
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = src;
  });
}

let cachedAtlas: CarArtAtlas | null = null;

export async function initCarArtAtlas(): Promise<CarArtAtlas> {
  if (cachedAtlas) return cachedAtlas;

  const extractAtlasStages = async (
    url: string,
    stageCount: number,
    useUnifiedLamps: boolean
  ): Promise<CarSpriteFrame[][] | null> => {
    try {
      const img = await loadImage(url);
      const off = document.createElement('canvas');
      off.width = CAR_ART_W + (stageCount - 1) * CAR_ART3Q_W;
      off.height = CAR_COUNT * CAR_ART_H;
      const ctx = off.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      const out: CarSpriteFrame[][] = [];
      for (let d = 0; d < CAR_COUNT; d++) {
        const y = d * CAR_ART_H;
        const driverStages: CarSpriteFrame[] = [];
        const s0 = ctx.getImageData(0, y, CAR_ART_W, CAR_ART_H);
        driverStages.push({
          w: CAR_ART_W,
          h: CAR_ART_H,
          rgba: s0.data,
          lampBox: useUnifiedLamps ? projectUnifiedLampBox(0, CAR_ART_W) : interpolateRepoLampBox(d, 0),
          yawDeg: 0,
        });
        for (let s = 1; s < stageCount; s++) {
          const sx = CAR_ART_W + (s - 1) * CAR_ART3Q_W;
          const sd = ctx.getImageData(sx, y, CAR_ART3Q_W, CAR_ART_H);
          const yawDeg = (UNIFIED_YAW_MAX_DEG * s) / (stageCount - 1);
          driverStages.push({
            w: CAR_ART3Q_W,
            h: CAR_ART_H,
            rgba: sd.data,
            lampBox: useUnifiedLamps
              ? projectUnifiedLampBox(yawDeg, CAR_ART3Q_W)
              : interpolateRepoLampBox(d, Math.min(6, Math.round((s * 6) / (stageCount - 1)))),
            yawDeg,
          });
        }
        out.push(driverStages);
      }
      return out;
    } catch {
      return null;
    }
  };

  const [loadedUnified7, loadedUnified19, loadedRepo, loadedHybrid] = await Promise.all([
    extractAtlasStages('/assets/unified_3d_car_art.png?v=6', 7, true),
    extractAtlasStages('/assets/unified_3d_dense19.png?v=6', UNIFIED_DENSE_COUNT, true),
    extractAtlasStages('/assets/repo_latest_car_art.png', 7, false),
    extractAtlasStages('/assets/hybrid_progressive_car_art.png?v=3', 7, false),
  ]);

  const fallbackEmpty = (): CarSpriteFrame => ({
    w: CAR_ART_W,
    h: CAR_ART_H,
    rgba: new Uint8ClampedArray(CAR_ART_W * CAR_ART_H * 4),
    lampBox: [...REPO_KLAMP_REAR],
  });

  const unified3dFrames: CarSpriteFrame[][] = [];
  const unified3dDenseFrames: CarSpriteFrame[][] = [];
  const repo2c7Frames: CarSpriteFrame[][] = [];
  const hybridCleanFrames: CarSpriteFrame[][] = [];

  for (let d = 0; d < CAR_COUNT; d++) {
    const r7 = loadedRepo?.[d] || Array.from({ length: 7 }, fallbackEmpty);
    const u7 = loadedUnified7?.[d] || r7;
    const u19 = loadedUnified19?.[d] || u7;
    const h7 = loadedHybrid?.[d] || r7;

    unified3dFrames.push(u7);
    unified3dDenseFrames.push(u19);
    repo2c7Frames.push(r7);
    hybridCleanFrames.push(h7);
  }

  // Archive v1.1 sprites (commit 3fb7d5e) with front-headlight bug
  const v11OrigRear: CarSpriteFrame[] = [];
  const v11OrigBad3q: CarSpriteFrame[] = [];

  try {
    const img = await loadImage('/assets/orig_car_art_v11.png');
    const off = document.createElement('canvas');
    off.width = 400;
    off.height = 8 * 84;
    const ctx = off.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      for (let d = 0; d < CAR_COUNT; d++) {
        const rearData = ctx.getImageData(0, d * 84, 176, 84);
        const bad3qData = ctx.getImageData(176, d * 84, 224, 84);
        v11OrigRear.push({
          w: 176,
          h: 84,
          rgba: rearData.data,
          lampBox: [...REPO_KLAMP_REAR],
        });
        v11OrigBad3q.push({
          w: 224,
          h: 84,
          rgba: bad3qData.data,
          lampBox: [78, 41, 110, 52, 172, 41, 203, 51],
        });
      }
    }
  } catch {
    for (let d = 0; d < CAR_COUNT; d++) {
      v11OrigRear.push(repo2c7Frames[d][0]);
      v11OrigBad3q.push(repo2c7Frames[d][6]);
    }
  }

  cachedAtlas = {
    ready: true,
    unified3dFrames,
    unified3dDenseFrames,
    repo2c7Frames,
    hybridCleanFrames,
    v11OrigRear,
    v11OrigBad3q,
    kLampRearRepo: REPO_KLAMP_REAR,
    kLamp3qRepo: REPO_KLAMP_3Q,
    kLampRearUnified: projectUnifiedLampBox(0, CAR_ART_W),
    kLamp3qUnified: projectUnifiedLampBox(UNIFIED_YAW_MAX_DEG, CAR_ART3Q_W),
  };
  return cachedAtlas;
}

export function getCarArtAtlasSync(): CarArtAtlas | null {
  return cachedAtlas;
}

// Generates a magenta (#FF00FF) sprite sheet directly compatible with tools/import_car_art.py
// OR exports all 7 rigid 3D stages on #FF00FF magenta!
export function generateMagentaSpriteSheetDataUrl(
  atlas: CarArtAtlas,
  source: 'unified_3d' | 'hybrid_clean' | 'repo_2c7e371' = 'unified_3d',
  all7Stages = false
): string {
  const bank =
    source === 'unified_3d'
      ? atlas.unified3dFrames
      : source === 'hybrid_clean'
      ? atlas.hybridCleanFrames
      : atlas.repo2c7Frames;

  const pad = 20;
  const cellW = 244;
  const cellH = 104;

  const putFrame = (ctx: CanvasRenderingContext2D, frame: CarSpriteFrame, col: number, row: number) => {
    const tmp = document.createElement('canvas');
    tmp.width = frame.w;
    tmp.height = frame.h;
    const tctx = tmp.getContext('2d')!;
    const id = new ImageData(new Uint8ClampedArray(frame.rgba), frame.w, frame.h);
    tctx.putImageData(id, 0, 0);
    const ox = pad + col * cellW + Math.trunc((cellW - pad - frame.w) / 2);
    const oy = pad + row * cellH + (cellH - pad - frame.h);
    ctx.drawImage(tmp, ox, oy);
  };

  if (all7Stages) {
    const cols = 7;
    const rows = CAR_COUNT;
    const canvas = document.createElement('canvas');
    canvas.width = pad + cols * cellW;
    canvas.height = pad + rows * cellH;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FF00FF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let d = 0; d < CAR_COUNT; d++) {
      for (let s = 0; s <= 6; s++) {
        putFrame(ctx, bank[d][s], s, d);
      }
    }
    return canvas.toDataURL('image/png');
  }

  const cols = 4;
  const rows = 4; // 8 rear (0°) + 8 rear-3/4 (35°) = 16 sprites cleanly separated on #FF00FF
  const canvas = document.createElement('canvas');
  canvas.width = pad + cols * cellW;
  canvas.height = pad + rows * cellH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FF00FF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let d = 0; d < CAR_COUNT; d++) {
    putFrame(ctx, bank[d][0], d % 4, Math.trunc(d / 4));
    putFrame(ctx, bank[d][6], d % 4, 2 + Math.trunc(d / 4));
  }

  return canvas.toDataURL('image/png');
}
