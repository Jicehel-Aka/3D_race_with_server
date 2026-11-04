import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, Volume2, VolumeX, Wrench, Zap } from 'lucide-react';
import { SCREEN_H, SCREEN_W, TRACK_DEFS, type ClientCarTelemetry, type RoomStatePayload } from '../shared/raceProtocol';
import { AkaRaceSimulator, type InputState } from '../engine/raceSim';
import { Renderer320x240 } from '../engine/renderer320';
import { synthAudio } from '../engine/synthAudio';

interface AkaConsoleStageProps {
  simRef: React.MutableRefObject<AkaRaceSimulator>;
  circuitAnimV12: boolean;
  onToggleCircuitAnim: (enabled: boolean) => void;
  multiplayerJoined: boolean;
  roomState: RoomStatePayload | null;
  mySlot: number;
  rttMs: number;
  onSendTelemetry: (t: ClientCarTelemetry) => void;
  onOpenTab: (tab: 'multiplayer' | 'pits' | 'cpp') => void;
}

const DIFF_LABELS = ['Facile', 'Normal', 'Difficile', 'Expert'];

export const AkaConsoleStage: React.FC<AkaConsoleStageProps> = ({
  simRef,
  circuitAnimV12,
  onToggleCircuitAnim,
  multiplayerJoined,
  roomState,
  rttMs,
  onSendTelemetry,
  onOpenTab,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer320x240>(new Renderer320x240());
  const keysRef = useRef<Record<string, boolean>>({});
  const touchHoldRef = useRef<Partial<Record<Exclude<keyof InputState, 'joyX'>, boolean>>>({});

  const [trackId, setTrackId] = useState<number>(simRef.current.trackId);
  const [difficulty, setDifficulty] = useState<number>(simRef.current.difficulty);
  const [audioOn, setAudioOn] = useState<boolean>(synthAudio.isEnabled());
  const [hudStats, setHudStats] = useState({
    kmh: 0,
    damagePct: 0,
    tyrePct: 100,
    nitroPct: 100,
    place: 8,
    bay: 'NONE',
  });

  // Keyboard listener (Arrows / WASD / ZQSD + Space/X Gas + Z/B Brake + C/Shift Nitro + L L1 + Enter Pause)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const inInput = (document.activeElement?.tagName || '') === 'INPUT';
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && !inInput) {
        e.preventDefault();
      }
      keysRef.current[e.code] = true;
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Main 60 FPS Gamebuino AKA Framebuffer Loop + 20 Hz Multiplayer Telemetry Emit
  useEffect(() => {
    let raf = 0;
    let lastTime = performance.now();
    let netAccum = 0;
    let uiAccum = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const k = keysRef.current;
      const th = touchHoldRef.current;
      const activeInput = (document.activeElement?.tagName || '') === 'INPUT';

      const input: InputState = {
        left: (!activeInput && (k.ArrowLeft || k.KeyA || k.KeyQ)) || Boolean(th.left),
        right: (!activeInput && (k.ArrowRight || k.KeyD)) || Boolean(th.right),
        up: (!activeInput && k.ArrowUp) || Boolean(th.up),
        down: (!activeInput && (k.ArrowDown || k.KeyS)) || Boolean(th.down),
        a: (!activeInput && (k.Space || k.KeyX || k.ArrowUp || k.KeyW)) || Boolean(th.a),
        b: (!activeInput && (k.KeyZ || k.KeyB || k.ArrowDown)) || Boolean(th.b),
        c: (!activeInput && (k.KeyC || k.ShiftLeft || k.ShiftRight)) || Boolean(th.c),
        l1: (!activeInput && k.KeyL) || Boolean(th.l1),
        run: (!activeInput && k.Enter) || Boolean(th.run),
        joyX: 0,
      };

      const sim = simRef.current;
      sim.multiplayerActive = multiplayerJoined;
      sim.step(dt, input);

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) rendererRef.current.renderFrame(ctx, sim);
      }

      if (multiplayerJoined) {
        netAccum += dt;
        if (netAccum >= 0.05) {
          netAccum = 0;
          onSendTelemetry(sim.getLocalTelemetry());
        }
      }

      uiAccum += dt;
      if (uiAccum >= 0.14) {
        uiAccum = 0;
        setHudStats({
          kmh: Math.round(sim.speedKmh()),
          damagePct: Math.round(sim.damage * 100),
          tyrePct: Math.round((1 - sim.tyreWear) * 100),
          nitroPct: Math.round(sim.nitro * 100),
          place: sim.player().place,
          bay: sim.activePitBay,
        });
        setTrackId(sim.trackId);
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [multiplayerJoined, onSendTelemetry, simRef]);

  const setHold = (btn: Exclude<keyof InputState, 'joyX'>, pressed: boolean) => {
    touchHoldRef.current[btn] = pressed;
  };

  const handleChangeTrack = (id: number) => {
    setTrackId(id);
    simRef.current.setupRace(id, difficulty, 3, false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-stretch">
      {/* Left 7 Cols: Authentic Gamebuino AKA Console Shell + 320x240 RGB565 Viewport */}
      <div className="lg:col-span-7 bg-[#121826] border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-5">
        {/* Console Top Shoulder Strip */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onMouseDown={() => setHold('l1', true)}
              onMouseUp={() => setHold('l1', false)}
              onMouseLeave={() => setHold('l1', false)}
              onTouchStart={(e) => { e.preventDefault(); setHold('l1', true); }}
              onTouchEnd={() => setHold('l1', false)}
              className="px-3 py-1.5 text-xs font-mono font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              title="Touche L : Limiteur Stand / HUD Compact"
            >
              L1 · Limiteur / HUD
            </button>
            <span className="text-xs font-mono text-slate-400 hidden sm:inline tabular-nums">
              320×240 RGB565 · 60 FPS
              {multiplayerJoined && roomState ? ` · Salon ${roomState.code} (${rttMs} ms)` : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAudioOn(synthAudio.toggleAudio())}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                audioOn
                  ? 'bg-orange-600/20 border-orange-500 text-orange-200'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {audioOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              {audioOn ? 'Audio Chiptune ON' : 'Activer Son'}
            </button>
            <button
              onMouseDown={() => setHold('c', true)}
              onMouseUp={() => setHold('c', false)}
              onMouseLeave={() => setHold('c', false)}
              onTouchStart={(e) => { e.preventDefault(); setHold('c', true); }}
              onTouchEnd={() => setHold('c', false)}
              className="px-3 py-1.5 text-xs font-mono font-semibold text-sky-200 bg-sky-950/60 hover:bg-sky-900/70 border border-sky-700/60 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              R1 · N2O
            </button>
          </div>
        </div>

        {/* 320x240 Crisp Pixel Screen Bezel */}
        <div className="relative bg-[#070A10] border-2 border-slate-800 rounded-xl p-2.5 sm:p-3">
          <canvas
            ref={canvasRef}
            width={SCREEN_W}
            height={SCREEN_H}
            className="pixel-canvas w-full aspect-[4/3] rounded-md bg-black block"
          />
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
            <span>GAMEBUINO AKA · ESP32-S3</span>
            <span className="tabular-nums">
              P{hudStats.place}/8 · {hudStats.kmh} KM/H · Dégâts {hudStats.damagePct}% · Pneus {hudStats.tyrePct}%
            </span>
          </div>
        </div>

        {/* Tactile On-Screen Gamebuino AKA Controls + Keyboard Legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          {/* D-Pad */}
          <div className="flex items-center gap-2">
            <button
              onMouseDown={() => setHold('left', true)}
              onMouseUp={() => setHold('left', false)}
              onMouseLeave={() => setHold('left', false)}
              onTouchStart={(e) => { e.preventDefault(); setHold('left', true); }}
              onTouchEnd={() => setHold('left', false)}
              className="w-11 h-11 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-orange-600 text-white font-mono font-bold text-sm border border-slate-700 cursor-pointer select-none"
            >
              ◀
            </button>
            <button
              onMouseDown={() => setHold('right', true)}
              onMouseUp={() => setHold('right', false)}
              onMouseLeave={() => setHold('right', false)}
              onTouchStart={(e) => { e.preventDefault(); setHold('right', true); }}
              onTouchEnd={() => setHold('right', false)}
              className="w-11 h-11 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-orange-600 text-white font-mono font-bold text-sm border border-slate-700 cursor-pointer select-none"
            >
              ▶
            </button>
            <span className="text-xs text-slate-400 ml-1 hidden sm:inline">
              Clavier : <strong className="text-slate-200">← →</strong> tourner · <strong className="text-slate-200">↑ / Espace</strong> gaz · <strong className="text-slate-200">↓ / Z</strong> frein · <strong className="text-slate-200">C</strong> nitro · <strong className="text-slate-200">L</strong> limiteur
            </span>
          </div>

          {/* Action Buttons A / B / C */}
          <div className="flex items-center gap-2">
            <button
              onMouseDown={() => setHold('b', true)}
              onMouseUp={() => setHold('b', false)}
              onMouseLeave={() => setHold('b', false)}
              onTouchStart={(e) => { e.preventDefault(); setHold('b', true); }}
              onTouchEnd={() => setHold('b', false)}
              className="px-3.5 h-11 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-rose-600 text-rose-200 font-mono font-bold text-xs border border-slate-700 cursor-pointer select-none whitespace-nowrap shrink-0"
            >
              B · Frein
            </button>
            <button
              onMouseDown={() => setHold('c', true)}
              onMouseUp={() => setHold('c', false)}
              onMouseLeave={() => setHold('c', false)}
              onTouchStart={(e) => { e.preventDefault(); setHold('c', true); }}
              onTouchEnd={() => setHold('c', false)}
              className="px-3.5 h-11 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-sky-600 text-sky-200 font-mono font-bold text-xs border border-slate-700 cursor-pointer select-none whitespace-nowrap shrink-0"
            >
              C · N2O
            </button>
            <button
              onMouseDown={() => setHold('a', true)}
              onMouseUp={() => setHold('a', false)}
              onMouseLeave={() => setHold('a', false)}
              onTouchStart={(e) => { e.preventDefault(); setHold('a', true); }}
              onTouchEnd={() => setHold('a', false)}
              className="px-4 h-11 rounded-lg bg-orange-600 hover:bg-orange-500 active:bg-orange-400 text-white font-mono font-bold text-xs cursor-pointer select-none whitespace-nowrap shrink-0"
            >
              A · Gaz
            </button>
          </div>
        </div>
      </div>

      {/* Right 5 Cols: Streamlined Race Control & Remaining Undecided Option */}
      <div className="lg:col-span-5 bg-[#121826] border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-6">
        <div className="space-y-5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
              <span>GitHub f0b651e</span>
              <span aria-hidden="true">·</span>
              <span>Sprites 3D Hybride</span>
              <span aria-hidden="true">·</span>
              <span>Stands 3 Box & Techniciens corrigés</span>
            </div>
            <h2 className="text-2xl font-bold font-display tracking-tight text-slate-100">
              Contrôle de Course & Stands
            </h2>
          </div>

          {/* 01. Circuit Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">01. Sélection du Circuit</span>
              <span className="font-mono text-slate-400 tabular-nums">
                IA : {DIFF_LABELS[difficulty]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TRACK_DEFS.map((t) => (
                <button
                  key={t.id}
                  disabled={multiplayerJoined}
                  onClick={() => handleChangeTrack(t.id)}
                  className={`px-3 py-2 text-xs font-mono text-left rounded-lg transition-colors whitespace-nowrap truncate cursor-pointer disabled:opacity-50 ${
                    trackId === t.id
                      ? 'bg-orange-600 text-white font-semibold'
                      : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  0{t.id + 1} · {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* 02. Pit Crew & Track Scenarios */}
          <div className="space-y-2.5 pt-3 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">02. Scénarios Stands & Techniciens</span>
              <button
                onClick={() => onOpenTab('pits')}
                className="text-orange-400 hover:text-orange-300 font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                Audit des techniciens →
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => simRef.current.teleportToPitApproach(0.62)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-200 bg-amber-950/40 hover:bg-amber-900/50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                Tester Arrêt Stands
              </button>
              <button
                onClick={() => simRef.current.triggerTestSpinAndDamage()}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-200 bg-rose-950/40 hover:bg-rose-900/50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                Simuler Choc & Dégâts
              </button>
              <button
                onClick={() => {
                  onToggleCircuitAnim(true);
                  simRef.current.teleportToTunnelOrHighlight();
                }}
                className="px-3 py-2 text-xs font-medium text-sky-200 bg-sky-950/40 hover:bg-sky-900/50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Voir Section Tunnel
              </button>
              <button
                onClick={() => {
                  const nextDiff = (difficulty + 1) % 4;
                  setDifficulty(nextDiff);
                  simRef.current.setupRace(trackId, nextDiff, 3, true);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Départ ({DIFF_LABELS[(difficulty + 1) % 4]})
              </button>
            </div>
          </div>

          {/* 03. Remaining Undecided Visual Proposal */}
          <div className="space-y-2.5 pt-3 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">
                03. Option ouverte : Ciel animé & Tunnels
              </span>
              <button
                onClick={() => onOpenTab('cpp')}
                className="text-slate-400 hover:text-slate-200 font-mono whitespace-nowrap shrink-0 cursor-pointer"
              >
                Patch C++ →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0B0F17] rounded-lg">
              <button
                onClick={() => onToggleCircuitAnim(true)}
                className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  circuitAnimV12
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                LUT Ciel & SEGF_TUNNEL
              </button>
              <button
                onClick={() => onToggleCircuitAnim(false)}
                className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  !circuitAnimV12
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Décors Origine GitHub
              </button>
            </div>
          </div>
        </div>

        {/* Multiplayer Callout Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {multiplayerJoined && roomState
              ? `En ligne dans ${roomState.code} (${roomState.phase})`
              : 'Serveur multijoueur PC / AKA / Web prêt sur port 3000'}
          </div>
          <button
            onClick={() => onOpenTab('multiplayer')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-orange-600 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {multiplayerJoined ? 'Gérer Salon' : 'Mode Multijoueur →'}
          </button>
        </div>
      </div>
    </div>
  );
};
