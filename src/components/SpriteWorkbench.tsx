import React, { useEffect, useRef, useState } from 'react';
import { Check, Download, Pause, Play, RotateCcw } from 'lucide-react';
import { CAR_COUNT, DRIVERS } from '../shared/raceProtocol';
import {
  CAR_ART3Q_W,
  CAR_ART_H,
  CAR_ART_MID,
  UNIFIED_DENSE_COUNT,
  UNIFIED_YAW_MAX_DEG,
  blendContinuousStage,
  generateMagentaSpriteSheetDataUrl,
  getUnifiedRigidFrame,
  type CarArtAtlas,
  type CarSpriteFrame,
  type SpriteMode,
} from '../engine/carArt3D';

interface SpriteWorkbenchProps {
  atlas: CarArtAtlas | null;
  activeSpriteMode: SpriteMode;
  subStageBlend: boolean;
  steerVisRate: number;
  pitModeV12: boolean;
  circuitAnimV12: boolean;
  onSelectSpriteMode: (mode: SpriteMode) => void;
  onToggleSubStageBlend: (enabled: boolean) => void;
  onChangeSteerVisRate: (rate: number) => void;
  onTogglePitMode: (enabled: boolean) => void;
  onToggleCircuitAnim: (enabled: boolean) => void;
  onLaunchSimulator: () => void;
}

const REPO_KSTEP = [0.18, 0.3, 0.42, 0.55, 0.7, 0.88];

function drawFrameToCanvas(
  canvas: HTMLCanvasElement | null,
  frame: CarSpriteFrame | undefined,
  flip: boolean,
  showLampBoxes: boolean,
  braking: boolean,
  zoom2x: boolean
) {
  if (!canvas || !frame) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = 244;
  canvas.height = 108;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Studio tarmac floor
  ctx.fillStyle = '#0D1320';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#172033';
  ctx.fillRect(0, 84, canvas.width, 24);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
  ctx.beginPath();
  ctx.moveTo(0, 84.5);
  ctx.lineTo(canvas.width, 84.5);
  ctx.stroke();

  const off = document.createElement('canvas');
  off.width = frame.w;
  off.height = frame.h;
  const octx = off.getContext('2d')!;
  octx.putImageData(new ImageData(new Uint8ClampedArray(frame.rgba), frame.w, frame.h), 0, 0);

  if (zoom2x) {
    const scale = 1.65;
    const dw = Math.round(frame.w * scale);
    const dh = Math.round(frame.h * scale);
    const ox = Math.round((canvas.width - dw) / 2);
    const oy = Math.round((canvas.height - dh) / 2) - 4;
    ctx.save();
    if (flip) {
      ctx.translate(ox + dw, oy);
      ctx.scale(-1, 1);
      ctx.drawImage(off, 0, 0, dw, dh);
    } else {
      ctx.drawImage(off, ox, oy, dw, dh);
    }
    ctx.restore();
    return;
  }

  const ox = Math.round((canvas.width - frame.w) / 2);
  const oy = 11;

  // Ground contact shadow right under the tyres
  ctx.fillStyle = 'rgba(5, 8, 14, 0.55)';
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, oy + 78, frame.w * 0.44, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  if (flip) {
    ctx.translate(ox + frame.w, oy);
    ctx.scale(-1, 1);
    ctx.drawImage(off, 0, 0);
  } else {
    ctx.drawImage(off, ox, oy);
  }
  ctx.restore();

  if (showLampBoxes) {
    const lb = frame.lampBox;
    for (let k = 0; k < 2; k++) {
      let x0 = lb[k * 4];
      const y0 = lb[k * 4 + 1];
      let x1 = lb[k * 4 + 2];
      const y1 = lb[k * 4 + 3];
      if (flip) {
        const t0 = frame.w - x1;
        const t1 = frame.w - x0;
        x0 = t0;
        x1 = t1;
      }
      if (braking) {
        ctx.fillStyle = 'rgba(255, 42, 28, 0.45)';
        ctx.fillRect(ox + x0 - 2, oy + y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
      }
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1;
      ctx.strokeRect(ox + x0 + 0.5, oy + y0 + 0.5, Math.max(2, x1 - x0), Math.max(2, y1 - y0));
    }
  }
}

function drawMiniFrame(canvas: HTMLCanvasElement | null, frame: CarSpriteFrame | undefined, flip = false) {
  if (!canvas || !frame) return;
  canvas.width = CAR_ART3Q_W;
  canvas.height = CAR_ART_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CAR_ART3Q_W, CAR_ART_H);
  const ox = Math.trunc((CAR_ART3Q_W - frame.w) / 2);
  const off = document.createElement('canvas');
  off.width = frame.w;
  off.height = frame.h;
  off.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(frame.rgba), frame.w, frame.h), 0, 0);
  if (!flip) {
    ctx.drawImage(off, ox, 0);
  } else {
    ctx.save();
    ctx.translate(ox + frame.w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  }
}

export const SpriteWorkbench: React.FC<SpriteWorkbenchProps> = ({
  atlas,
  activeSpriteMode,
  subStageBlend,
  steerVisRate,
  pitModeV12,
  circuitAnimV12,
  onSelectSpriteMode,
  onToggleSubStageBlend,
  onChangeSteerVisRate,
  onTogglePitMode,
  onToggleCircuitAnim,
  onLaunchSimulator,
}) => {
  const [selectedDriver, setSelectedDriver] = useState<number>(7); // YOU (Red)
  const [steerVal, setSteerVal] = useState<number>(-0.46);
  const [leftCompareSource, setLeftCompareSource] = useState<'repo_2c7e371' | 'hybrid_clean'>('repo_2c7e371');
  const [showLampBoxes, setShowLampBoxes] = useState<boolean>(false);
  const [brakingPreview, setBrakingPreview] = useState<boolean>(false);
  const [zoom2x, setZoom2x] = useState<boolean>(false);
  const [autoSweep, setAutoSweep] = useState<boolean>(true);
  const [showAll8Grid, setShowAll8Grid] = useState<boolean>(false);

  const leftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const unifiedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftStripRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const unifiedStripRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const gridLeftRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const gridUnifiedRefs = useRef<Array<HTMLCanvasElement | null>>([]);

  useEffect(() => {
    if (!autoSweep) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      const s = Math.sin(((now - t0) / 1000) * 1.25);
      setSteerVal(Number(s.toFixed(3)));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [autoSweep]);

  const absS = Math.abs(steerVal);
  const flip = steerVal > 0;

  // Repo discrete stage (0..6)
  let repoStage = 0;
  while (repoStage <= CAR_ART_MID && absS >= REPO_KSTEP[repoStage]) repoStage++;

  // Legacy 2D cross-fade continuous fStage (0.00 .. 6.00)
  const fStageContinuous = absS <= 0.05 ? 0 : Math.min(6, ((absS - 0.05) / 0.8) * 6);

  // Unified Rigid 3D selection (zero 2D cross-fade!)
  const unifiedSel = atlas
    ? getUnifiedRigidFrame(atlas, selectedDriver, absS, subStageBlend)
    : null;

  useEffect(() => {
    if (!atlas) return;

    const leftFrame =
      leftCompareSource === 'repo_2c7e371'
        ? atlas.repo2c7Frames[selectedDriver]?.[repoStage]
        : blendContinuousStage(atlas.hybridCleanFrames[selectedDriver], selectedDriver, fStageContinuous);

    const rightFrame = getUnifiedRigidFrame(atlas, selectedDriver, absS, subStageBlend).frame;

    drawFrameToCanvas(leftCanvasRef.current, leftFrame, flip, showLampBoxes, brakingPreview, zoom2x);
    drawFrameToCanvas(unifiedCanvasRef.current, rightFrame, flip, showLampBoxes, brakingPreview, zoom2x);

    const leftBank =
      leftCompareSource === 'repo_2c7e371' ? atlas.repo2c7Frames : atlas.hybridCleanFrames;

    for (let s = 0; s <= 6; s++) {
      drawMiniFrame(leftStripRefs.current[s], leftBank[selectedDriver]?.[s], false);
      drawMiniFrame(unifiedStripRefs.current[s], atlas.unified3dFrames[selectedDriver]?.[s], false);
    }

    if (showAll8Grid) {
      for (let d = 0; d < CAR_COUNT; d++) {
        const lFr =
          leftCompareSource === 'repo_2c7e371'
            ? atlas.repo2c7Frames[d]?.[repoStage]
            : blendContinuousStage(atlas.hybridCleanFrames[d], d, fStageContinuous);
        const rFr = getUnifiedRigidFrame(atlas, d, absS, subStageBlend).frame;
        drawMiniFrame(gridLeftRefs.current[d], lFr, flip);
        drawMiniFrame(gridUnifiedRefs.current[d], rFr, flip);
      }
    }
  }, [
    atlas,
    selectedDriver,
    leftCompareSource,
    repoStage,
    fStageContinuous,
    absS,
    subStageBlend,
    flip,
    showLampBoxes,
    brakingPreview,
    zoom2x,
    showAll8Grid,
  ]);

  const handleDownloadUnifiedSheet = (all7Stages: boolean) => {
    if (!atlas) return;
    const dataUrl = generateMagentaSpriteSheetDataUrl(atlas, 'unified_3d', all7Stages);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = all7Stages
      ? 'cars_sheet_unified_3d_7stages.png'
      : 'cars_sheet_unified_3d_2c7.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const drv = DRIVERS[selectedDriver];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-800">
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs font-mono text-slate-400">
            Vue 3D Hybride · Avant bas recalibré au pixel près sur Stage 6 · Rétro-projection Z-buffer rigide
          </p>
          <h2 className="text-3xl font-bold tracking-tight font-display text-slate-100">
            Rotation 3D Hybride (Avant Bas Calibré + Texture 3/4 Projetée en 3D)
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Le profil avant du maillage 3D est désormais calé au pixel près sur votre vue 3/4 (<code className="font-mono text-slate-200">Stage 6</code> : capot plongeant bas <code className="font-mono text-slate-200">y = 31 → 45</code>, montant A incliné et toit plat horizontal à <code className="font-mono text-slate-200">y = 5</code> sans bosse avant), combiné en <strong className="text-orange-300">3D Hybride</strong> par rétro-projection Z-buffer de la vraie texture 3/4 sur la géométrie 3D rigide.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => setShowAll8Grid((v) => !v)}
            className={`px-3.5 py-2.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showAll8Grid
                ? 'bg-slate-800 border-orange-500 text-white'
                : 'bg-[#121826] border-slate-700 text-slate-200 hover:border-slate-500'
            }`}
          >
            {showAll8Grid ? 'Vue 1 pilote détaillée' : 'Voir les 8 voitures'}
          </button>
          <button
            onClick={onLaunchSimulator}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-4 h-4" />
            Tester en virage sur l’écran 320×240
          </button>
        </div>
      </div>

      {/* Main Controls + Side-by-Side Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 4 Cols: Driver, Angle & Rigid Step Controls */}
        <div className="lg:col-span-4 bg-[#121826] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Pilote inspecté (0..7)</span>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                look = {selectedDriver} · {drv.name}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {DRIVERS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDriver(d.id)}
                  className={`px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                    selectedDriver === d.id
                      ? 'bg-slate-800 border-orange-500 text-white'
                      : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: d.hex }} />
                    <span className="text-xs font-mono font-semibold truncate">{d.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Slider + Exact Rigid Yaw Angle Readout */}
          <div className="space-y-2.5 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Angle de lacet (steerVis)</span>
              <span className="font-mono text-orange-400 tabular-nums">
                {steerVal > 0 ? `+${steerVal.toFixed(2)}` : steerVal.toFixed(2)} ·{' '}
                {unifiedSel ? `${(flip ? '+' : '-')}${unifiedSel.angleDeg.toFixed(1)}°` : '0.0°'}
              </span>
            </div>

            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={steerVal}
              onChange={(e) => {
                setAutoSweep(false);
                setSteerVal(Number(e.target.value));
              }}
              className="w-full accent-orange-500 cursor-pointer"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
              <span>-{UNIFIED_YAW_MAX_DEG}° Gauche (3/4)</span>
              <span>0° Dos unifié</span>
              <span>+{UNIFIED_YAW_MAX_DEG}° Droite (3/4)</span>
            </div>
          </div>

          {/* Rigid 3D Step Density & Inertia Tuning */}
          <div className="space-y-3 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Finesse 3D Hybride (0% morphing 2D)</span>
              <button
                onClick={() => onToggleSubStageBlend(!subStageBlend)}
                className="font-mono text-emerald-400 hover:text-emerald-300 cursor-pointer tabular-nums"
              >
                {subStageBlend ? `${UNIFIED_DENSE_COUNT} angles (1.6°)` : '7 paliers AKA (4.8°)'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg">
              {[
                { rate: 5.4, label: 'Fluide (5.4)' },
                { rate: 7.2, label: 'Vive (7.2)' },
                { rate: 9.5, label: 'Directe (9.5)' },
              ].map((opt) => (
                <button
                  key={opt.rate}
                  onClick={() => onChangeSteerVisRate(opt.rate)}
                  className={`py-1.5 text-[11px] font-mono rounded-md transition-colors cursor-pointer tabular-nums ${
                    Math.abs(steerVisRate - opt.rate) < 0.25
                      ? 'bg-slate-800 text-white border border-orange-500/70'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Inspection Toggles */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800/80">
            <button
              onClick={() => setAutoSweep((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                autoSweep
                  ? 'bg-orange-600/20 border-orange-500 text-orange-200'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {autoSweep ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {autoSweep ? 'Pause rotation' : 'Animer Gauche/Droite'}
            </button>
            <button
              onClick={() => setZoom2x((v) => !v)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                zoom2x
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              Loupe ×1.7
            </button>
            <button
              onClick={() => setShowLampBoxes((v) => !v)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                showLampBoxes
                  ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              Feux 3D
            </button>
            <button
              onClick={() => setBrakingPreview((v) => !v)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                brakingPreview
                  ? 'bg-red-500/20 border-red-400 text-red-200'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              Frein
            </button>
            <button
              onClick={() => {
                setAutoSweep(false);
                setSteerVal(0);
              }}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-700 rounded-md cursor-pointer"
              title="Comparer la vue de dos 0°"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right 8 Cols: Side-by-Side Viewports */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LEFT CARD: Reference comparison (GitHub 2c7e371 OR Legacy 2D Cross-Fade Hybrid) */}
          <div
            className={`bg-[#121826] border rounded-xl p-5 flex flex-col justify-between space-y-4 ${
              activeSpriteMode === leftCompareSource ? 'border-orange-500' : 'border-slate-800'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex p-0.5 bg-[#0B0F17] border border-slate-800 rounded-md text-[11px] font-mono">
                  <button
                    onClick={() => setLeftCompareSource('repo_2c7e371')}
                    className={`px-2 py-1 rounded-xs transition-colors cursor-pointer ${
                      leftCompareSource === 'repo_2c7e371'
                        ? 'bg-slate-800 text-sky-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    GitHub 2c7e371
                  </button>
                  <button
                    onClick={() => setLeftCompareSource('hybrid_clean')}
                    className={`px-2 py-1 rounded-xs transition-colors cursor-pointer ${
                      leftCompareSource === 'hybrid_clean'
                        ? 'bg-slate-800 text-sky-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Hybride (Fondu 2D)
                  </button>
                </div>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {leftCompareSource === 'repo_2c7e371'
                    ? `Palier ${repoStage}/6`
                    : `Fondu ${fStageContinuous.toFixed(1)}/6`}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-slate-100">
                {leftCompareSource === 'repo_2c7e371'
                  ? 'Dos ≠ 3/4 (coffre, feux et pare-chocs différents)'
                  : 'Fondu 2D entre deux formes de carrosserie'}
              </h3>
            </div>

            <div className="flex items-center justify-center bg-[#0B0F17] border border-slate-800/90 rounded-lg p-3">
              <canvas ref={leftCanvasRef} className="pixel-canvas w-full max-w-[380px] h-auto" />
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                {leftCompareSource === 'repo_2c7e371'
                  ? 'Stage 0 provient de la 1re planche (feux carrés, plaque blanche) tandis que Stage 6 vient de la 2de planche (GT à bandeau noir et feux rectangulaires).'
                  : 'Même adouci, un fondu d’images entre deux voitures d’anatomies différentes donne l’illusion que la coque se déforme au lieu de pivoter.'}
              </p>
              <button
                onClick={() => onSelectSpriteMode(leftCompareSource)}
                className={`w-full py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeSpriteMode === leftCompareSource
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {activeSpriteMode === leftCompareSource
                  ? '✓ Actif sur le simulateur'
                  : `Tester ${leftCompareSource === 'repo_2c7e371' ? 'GitHub 2c7e371' : 'Fondu 2D'} en piste`}
              </button>
            </div>
          </div>

          {/* RIGHT CARD: Unified Rigid 3D GT Supercar built from Stage 6 */}
          <div
            className={`bg-[#121826] border rounded-xl p-5 flex flex-col justify-between space-y-4 ${
              activeSpriteMode === 'unified_3d' ? 'border-orange-500' : 'border-slate-800'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-mono text-emerald-400">
                  3D HYBRIDE RIGIDE · Avant Bas Calibré + Texture Stage 6
                </p>
                <span className="text-[11px] font-mono text-emerald-300 tabular-nums">
                  {unifiedSel
                    ? `Angle ${unifiedSel.angleDeg.toFixed(1)}° (${unifiedSel.stageIdx}/${unifiedSel.maxStage})`
                    : '0.0°'}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-slate-100">
                Poupe 3D unifiée + avant plongeant fidèle à l’image 3/4
              </h3>
            </div>

            <div className="flex items-center justify-center bg-[#0B0F17] border border-slate-800/90 rounded-lg p-3">
              <canvas ref={unifiedCanvasRef} className="pixel-canvas w-full max-w-[380px] h-auto" />
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                Capot avant abaissé (<code className="font-mono text-slate-300">y = 31 → 45</code>), toit plat (<code className="font-mono text-slate-300">y = 5</code>) et rétro-projection Z-buffer de la vraie texture 3/4 (<code className="font-mono text-slate-300">Stage 6</code>) sur la rotation 3D rigide.
              </p>
              <button
                onClick={() => onSelectSpriteMode('unified_3d')}
                className={`w-full py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeSpriteMode === 'unified_3d'
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-800 hover:bg-orange-600 text-slate-200'
                }`}
              >
                {activeSpriteMode === 'unified_3d'
                  ? '✓ Sélectionné (Rotation 3D Hybride Rigide)'
                  : 'Activer la Rotation 3D Hybride'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Optional All-8-Drivers Overview */}
      {showAll8Grid && (
        <div className="bg-[#121826] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Les 8 voitures côte à côte ({leftCompareSource === 'repo_2c7e371' ? 'GitHub 2c7e371' : 'Hybride Fondu 2D'} vs 3D Hybride Rigide)
              </h3>
              <p className="text-xs text-slate-400">
                Cliquez sur <code className="font-mono text-slate-200">0° (Dos)</code> puis <code className="font-mono text-slate-200">29° (3/4)</code> pour vérifier l’avant bas, le toit plat et l’identité arrière sur les 8 livrées.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: '0° (Dos)', val: 0 },
                { label: '10° (Début virage)', val: -0.31 },
                { label: '19° (Mi-virage)', val: -0.58 },
                { label: '29° (Plein 3/4)', val: -0.92 },
              ].map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    setAutoSweep(false);
                    setSteerVal(p.val);
                  }}
                  className="px-2.5 py-1 text-xs font-mono rounded-md border bg-[#0B0F17] border-slate-800 text-slate-300 hover:border-orange-500 cursor-pointer tabular-nums"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {DRIVERS.map((d) => (
              <div
                key={d.id}
                onClick={() => setSelectedDriver(d.id)}
                className={`p-3 rounded-lg border bg-[#0B0F17] space-y-2.5 cursor-pointer transition-colors ${
                  selectedDriver === d.id ? 'border-orange-500' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-semibold text-slate-100 tabular-nums">{d.id}. {d.name}</span>
                  <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: d.hex }} />
                </div>
                <div className="space-y-1.5">
                  <div>
                    <p className="text-[10px] font-mono text-sky-400 mb-0.5">
                      {leftCompareSource === 'repo_2c7e371' ? 'GitHub 2c7e371' : 'Hybride Fondu 2D'}
                    </p>
                    <canvas
                      ref={(el) => { gridLeftRefs.current[d.id] = el; }}
                      className="pixel-canvas w-full h-11 object-contain bg-[#111726] rounded-xs"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-emerald-400 mb-0.5">3D Hybride</p>
                    <canvas
                      ref={(el) => { gridUnifiedRefs.current[d.id] = el; }}
                      className="pixel-canvas w-full h-11 object-contain bg-[#111726] rounded-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aligned 7-Stage Strip Comparison */}
      <div className="bg-[#121826] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Les 7 paliers Gamebuino AKA (`Stage 0` → `Stage 6`) pour {drv.name}
            </h3>
            <p className="text-xs text-slate-400">
              Échelle 1:1 exacte (`224×84`) : la même GT tourne en 3D Hybride rigide de 0° à {UNIFIED_YAW_MAX_DEG}° avec avant bas plongeant fidèle à Stage 6.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            Angles 3D : 0.0° · 4.8° · 9.7° · 14.5° · 19.3° · 24.2° · 29.0°
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[0, 1, 2, 3, 4, 5, 6].map((s) => {
            const presetSteers = [0, -0.17, -0.30, -0.44, -0.58, -0.71, -0.88];
            const currentStage7 = unifiedSel ? Math.round(unifiedSel.uStage * 6) : 0;
            const isNear = currentStage7 === s;
            return (
              <button
                key={s}
                onClick={() => {
                  setAutoSweep(false);
                  setSteerVal(presetSteers[s]);
                }}
                className={`p-2.5 rounded-lg border bg-[#0B0F17] flex flex-col gap-2 transition-colors cursor-pointer ${
                  isNear ? 'border-orange-500' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full text-[11px] font-mono text-slate-300 tabular-nums">
                  <span>Stage {s}</span>
                  <span className="text-slate-400">{((UNIFIED_YAW_MAX_DEG * s) / 6).toFixed(0)}°</span>
                </div>

                <div className="w-full space-y-1">
                  <div className="text-[10px] font-mono text-sky-400 text-left">
                    {leftCompareSource === 'repo_2c7e371' ? 'GitHub 2c7' : 'Fondu 2D'}
                  </div>
                  <canvas
                    ref={(el) => { leftStripRefs.current[s] = el; }}
                    className="pixel-canvas w-full h-11 object-contain bg-[#111726] rounded-xs"
                  />
                </div>

                <div className="w-full space-y-1 pt-1 border-t border-slate-800/80">
                  <div className="text-[10px] font-mono text-emerald-400 text-left">3D Hybride</div>
                  <canvas
                    ref={(el) => { unifiedStripRefs.current[s] = el; }}
                    className="pixel-canvas w-full h-11 object-contain bg-[#111726] rounded-xs"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modular "Ce qu'on garde" Panel */}
      <div className="bg-[#121826] border border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="space-y-1">
            <p className="text-xs font-mono text-orange-400">
              ÉTAPE DE VALIDATION · Sprites 3D Unifiés validables avant d’activer les stands et circuits
            </p>
            <h3 className="text-xl font-bold font-display text-slate-100">
              Configuration retenue & Export des Planches Unifiées (#FF00FF)
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => handleDownloadUnifiedSheet(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Planche Dos + 3/4 (#FF00FF)
            </button>
            <button
              onClick={() => handleDownloadUnifiedSheet(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              7 Paliers 3D Complets (#FF00FF)
            </button>
            <button
              onClick={onLaunchSimulator}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              Tester en course sur 320×240 →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1: Sprites */}
          <div className="p-4 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-3">
            <div className="text-xs font-mono text-slate-400">01 · Modèle & Rotation Voitures</div>
            <div className="space-y-1.5">
              {[
                { id: 'unified_3d' as SpriteMode, label: 'Rotation 3D Hybride (Avant Bas + Stage 6)' },
                { id: 'repo_2c7e371' as SpriteMode, label: 'GitHub 2c7e371 (Brut)' },
                { id: 'hybrid_clean' as SpriteMode, label: 'Ancien Hybride (Fondu 2D)' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onSelectSpriteMode(opt.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    activeSpriteMode === opt.id
                      ? 'bg-slate-800 border-orange-500 text-white'
                      : 'bg-[#121826] border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {activeSpriteMode === opt.id && <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Pit Stop Toggle */}
          <div className="p-4 rounded-xl bg-[#0B0F17] border border-slate-800 flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="text-xs font-mono text-slate-400">02 · Voie des Stands (À activer ensuite)</div>
              <div className="text-sm font-semibold text-slate-100">
                {pitModeV12 ? 'Activé : 3 Stands séparés + Lollipop' : 'Désactivé : Stand d’origine 2c7e371'}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Débrayé par défaut tant que vous validez le comportement de la nouvelle GT 3D unifiée en virage.
              </p>
            </div>
            <button
              onClick={() => onTogglePitMode(!pitModeV12)}
              className={`w-full py-2 px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                pitModeV12
                  ? 'bg-amber-600/20 border-amber-500 text-amber-200'
                  : 'bg-[#121826] border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {pitModeV12 ? 'Revenir au stand d’origine' : 'Activer les 3 Stands'}
            </button>
          </div>

          {/* Step 3: Circuit Animations Toggle */}
          <div className="p-4 rounded-xl bg-[#0B0F17] border border-slate-800 flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="text-xs font-mono text-slate-400">03 · Animations Circuits (À activer ensuite)</div>
              <div className="text-sm font-semibold text-slate-100">
                {circuitAnimV12 ? 'Activé : Animations 60 FPS & Tunnels' : 'Désactivé : Décors d’origine 2c7e371'}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Active sur demande l’eau animée, les aurores ondulantes, le monorail, le phare tournant et les tunnels.
              </p>
            </div>
            <button
              onClick={() => onToggleCircuitAnim(!circuitAnimV12)}
              className={`w-full py-2 px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                circuitAnimV12
                  ? 'bg-sky-600/20 border-sky-500 text-sky-200'
                  : 'bg-[#121826] border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {circuitAnimV12 ? 'Revenir aux décors d’origine' : 'Activer les animations circuits'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
