import React, { useEffect, useRef } from 'react';
import { Play, Wrench } from 'lucide-react';
import { TRACK_DEFS } from '../shared/raceProtocol';
import { TECH_H, TECH_PAL_RGB, TECH_PX, TECH_W } from '../engine/techArt';

interface PitAndCircuitGuideProps {
  onLaunchPitTest: (trackId: number) => void;
  onLaunchCircuitSection: (trackId: number, tunnelFocus: boolean) => void;
  onOpenCppPatch: () => void;
}

const TECH_FRAME_LABELS = [
  { id: 0, code: 'TECH_IDLE', role: 'Attente extérieure stand' },
  { id: 1, code: 'TECH_WALK_A', role: 'Approche / départ A' },
  { id: 2, code: 'TECH_WALK_B', role: 'Approche / départ B' },
  { id: 3, code: 'TECH_WORK', role: 'Travail à côté voiture' },
  { id: 4, code: 'TECH_TYRE', role: 'Porteur pneu (arrivée)' },
  { id: 5, code: 'TECH_RAISED', role: 'Lollipop STOP / GO' },
];

const AUDIT_FINDINGS = [
  {
    status: 'ACTIF',
    file: 'race.cpp · IDLE_OUTSIDE → WALKING_IN',
    title: 'Attente à l’extérieur & arrivée autour de la voiture à l’arrêt',
    detail:
      'Tous les mécaniciens et le Lollipop Man patientent à l’extérieur de la voie des stands sur le tablier béton sous auvent (x = 2.63..2.74, derrière la ligne blanche). Dès l’arrêt (< 4 km/h) dans le Stand 2 ou 3, ils convergent vers la voiture en contournant le pare-chocs avant pour le flanc gauche sans traverser la carrosserie.',
  },
  {
    status: 'ACTIF',
    file: 'race.cpp · WORKING → WALKING_OUT',
    title: 'Travail uniquement à côté de la voiture & départ immédiat',
    detail:
      'La pose TECH_WORK, le rebond vertical et les étincelles de clé à chocs ne s’activent qu’une fois chaque technicien arrivé contre son pneu ou le capot. À la seconde où l’intervention se termine, le Lollipop passe sur GO et toute l’équipe fait demi-tour et s’éloigne immédiatement vers l’extérieur, même si la voiture reste encore à 0 km/h.',
  },
  {
    status: 'CORRIGÉ',
    file: 'render.cpp · Bandes fixes & wAt <= 365',
    title: 'Bandes au sol 100 % fixes & visibilité continue à côté du véhicule',
    detail:
      'Suppression du décalage temporel sur les marquages au sol des 3 stands et de la zone N2O : toutes les bandes colorées, lignes d’arrêt et pointillés sont ancrés dans le repère monde, avec interpolation continue inter-segments jusqu’à wAt <= 365 px pour éviter toute disparition à hauteur du joueur.',
  },
  {
    status: 'CORRIGÉ',
    file: 'render.cpp · HUD dynamique & Neon City',
    title: 'Cadre de texte HUD auto-ajusté & dégagement sortie des stands',
    detail:
      'La largeur du cadre jaune/vert des stands (ex. STAND 3 · MOTEUR (ARRET 0 KM/H) / ENG · TYR · N2O) est mesurée dynamiquement avec marges garanties pour qu’aucun texte ne dépasse sur Neon City ou les autres tracés, et les immeubles en bord de sortie des stands sont écartés de la ligne de mire.',
  },
];

const TechSpritePreviewCanvas: React.FC<{ frameIndex: number }> = ({ frameIndex }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = 3;
    ctx.clearRect(0, 0, TECH_W * scale, TECH_H * scale);
    const px = TECH_PX[frameIndex];
    if (!px) return;

    for (let y = 0; y < TECH_H; y++) {
      for (let x = 0; x < TECH_W; x++) {
        const idx = px[y * TECH_W + x];
        if (!idx) continue;
        const [r, g, b] = TECH_PAL_RGB[idx];
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }, [frameIndex]);

  return (
    <canvas
      ref={ref}
      width={TECH_W * 3}
      height={TECH_H * 3}
      className="pixel-canvas mx-auto block"
    />
  );
};

export const PitAndCircuitGuide: React.FC<PitAndCircuitGuideProps> = ({
  onLaunchPitTest,
  onLaunchCircuitSection,
  onOpenCppPatch,
}) => {
  return (
    <div className="space-y-10">
      {/* Section 1: Audit & Choreography of Pit Technicians */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="space-y-1.5 max-w-3xl">
            <p className="text-xs font-mono text-slate-400">
              Chorégraphie Stands 4 Phases · tech_art.cpp (6 poses 28×50, 15 couleurs AKA) · Bandes fixes
            </p>
            <h2 className="text-3xl font-bold font-display tracking-tight text-slate-100">
              Animation des Techniciens aux Stands & Marquages Fixes
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Les équipes des Stands 2 (Pneus) et 3 (Moteur) attendent à l’extérieur sous l’auvent (<code className="font-mono text-slate-200">x = 2.63..2.74</code>), arrivent autour de la voiture une fois immobilisée sur les bandes fixes au sol, interviennent uniquement lorsqu’elles sont en poste, puis s’éloignent dès la fin du travail.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenCppPatch}
              className="px-3.5 py-2.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Voir le patch C++
            </button>
            <button
              onClick={() => onLaunchPitTest(0)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Wrench className="w-4 h-4" />
              Tester les techniciens en piste
            </button>
          </div>
        </div>

        {/* 6 Extracted Technician Frames Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {TECH_FRAME_LABELS.map((f) => (
            <div
              key={f.id}
              className="bg-[#121826] border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-between space-y-3"
            >
              <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 tabular-nums">
                <span>0{f.id}</span>
                <span>28×50</span>
              </div>
              <div className="py-1">
                <TechSpritePreviewCanvas frameIndex={f.id} />
              </div>
              <div className="text-center space-y-0.5">
                <div className="text-xs font-mono font-semibold text-slate-100">{f.code}</div>
                <div className="text-[11px] text-slate-400">{f.role}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 4 Concrete Code Findings Table/Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AUDIT_FINDINGS.map((item, idx) => (
            <div
              key={idx}
              className="bg-[#121826] border border-slate-800 rounded-xl p-5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2 text-xs font-mono">
                <span className="text-amber-400">{item.file}</span>
                <span className="text-emerald-400">{item.status} DANS SIMULATEUR & PATCH</span>
              </div>
              <h3 className="text-base font-semibold text-slate-100">{item.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: 6 Circuits & Undecided Tunnel/Sky Proposal */}
      <section className="space-y-6">
        <div className="space-y-1.5 max-w-2xl pb-5 border-b border-slate-800">
          <p className="text-xs font-mono text-slate-400">
            6 Circuits Officiels · Proposition restante : LUT s_sin8[256] & Portiques SEGF_TUNNEL
          </p>
          <h2 className="text-3xl font-bold font-display tracking-tight text-slate-100">
            Accès Rapide aux 6 Circuits & Sections Tunnels
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Lancez directement chaque tracé en conditions de course ou téléportez la voiture à l’entrée des stands ou d’un tunnel (<code className="font-mono text-slate-200">SEGF_TUNNEL</code>).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TRACK_DEFS.map((tr) => {
            const hasTunnel = tr.id === 1 || tr.id === 2 || tr.id === 4;
            return (
              <div
                key={tr.id}
                className="bg-[#121826] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-5"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 tabular-nums">
                    <span>0{tr.id + 1} · {tr.musicTitle}</span>
                    <span>{tr.bpm} BPM</span>
                  </div>
                  <h3 className="text-xl font-bold font-display tracking-wide text-slate-100">
                    {tr.name}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{tr.animHighlightsFr}</p>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-800/80">
                  <button
                    onClick={() => onLaunchCircuitSection(tr.id, false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Rouler
                  </button>
                  {hasTunnel && (
                    <button
                      onClick={() => onLaunchCircuitSection(tr.id, true)}
                      className="px-3 py-1.5 text-xs font-medium text-sky-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Tunnel
                    </button>
                  )}
                  <button
                    onClick={() => onLaunchPitTest(tr.id)}
                    className="px-3 py-1.5 text-xs font-medium text-amber-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Stands
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
