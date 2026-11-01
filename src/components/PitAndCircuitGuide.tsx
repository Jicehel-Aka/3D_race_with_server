import React from 'react';
import { Play, Wrench } from 'lucide-react';
import { TRACK_DEFS } from '../shared/raceProtocol';

interface PitAndCircuitGuideProps {
  onLaunchPitTest: (trackId: number) => void;
  onLaunchCircuitSection: (trackId: number, tunnelFocus: boolean) => void;
}

const PIT_BAYS_SPEC = [
  {
    num: '01',
    title: 'Stand 1 — Zone N2O Express (Bleu Cyan)',
    meta: 'Segments 11..18 · Passage lancé ≤ 95 km/h · Sans arrêt complet',
    desc: 'Permet de recharger la bouteille de protoxyde d’azote à la volée en longeant la voie des stands sans perdre 4 secondes à l’arrêt. Idéal en mode Hard/Expert quand le moteur est encore sain.',
    accent: 'text-sky-400',
  },
  {
    num: '02',
    title: 'Stand 2 — Stand Pneus & Train Avant (Jaune)',
    meta: 'Segments 19..26 · Arrêt court ≤ 38 km/h (~1.2 s) · Pistolet pneumatique',
    desc: 'Corrige l’usure des gommes accumulée hors-piste ou en dérapage et réaligne immédiatement la direction (supprime le tirage latéral pullDir) avec gerbes d’étincelles aux 4 roues.',
    accent: 'text-amber-400',
  },
  {
    num: '03',
    title: 'Stand 3 — Garage Moteur Complet & Lollipop (Rouge)',
    meta: 'Segments 27..36 · Arrêt complet ≤ 30 km/h · Mécaniciens + Boost GO!',
    desc: 'Abri thématique selon le circuit, 2 mécaniciens qui s’avancent vers l’auto, remise à neuf du bloc moteur (damage → 0%) et panneau Lollipop STOP → READY → GO! offrant un boost d’accélération à la relance.',
    accent: 'text-rose-400',
  },
];

export const PitAndCircuitGuide: React.FC<PitAndCircuitGuideProps> = ({
  onLaunchPitTest,
  onLaunchCircuitSection,
}) => {
  return (
    <div className="space-y-10">
      {/* Section 1: Pit Stops Architecture */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="space-y-1.5 max-w-2xl">
            <p className="text-xs font-mono text-slate-400">
              Architecture Voie des Stands v1.2 · Muret béton x = 1.04 · Limiteur L1 85 km/h
            </p>
            <h2 className="text-3xl font-bold font-display tracking-tight text-slate-100">
              Refonte de la Voie des Stands : Séparation Sécurisée & 3 Box Spécialisés
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Dans la v1.1, l’unique rectangle jaune était peint directement sur la voie de droite (<code className="font-mono text-slate-200">x = 0.42..0.96</code>),
              exposant le joueur à l’arrêt aux percussions à 240 km/h par l’IA. La v1.2 déporte une vraie allée des stands à droite derrière un muret béton et découpe l’arrêt en 3 choix tactiques.
            </p>
          </div>
          <button
            onClick={() => onLaunchPitTest(0)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Wrench className="w-4 h-4" />
            Tester l’entrée aux stands maintenant
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PIT_BAYS_SPEC.map((b) => (
            <div
              key={b.num}
              className="bg-[#121826] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <p className={`text-xs font-mono ${b.accent}`}>{b.meta}</p>
                <h3 className="text-lg font-semibold text-slate-100">
                  {b.num}. {b.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: 6 Circuits Animations & Tunnels */}
      <section className="space-y-6">
        <div className="space-y-1.5 max-w-2xl pb-5 border-b border-slate-800">
          <p className="text-xs font-mono text-slate-400">
            6 Thèmes Visuels · Table fixe int16_t s_sin8[256] · Flag SEGF_TUNNEL activé · 60 FPS ESP32-S3
          </p>
          <h2 className="text-3xl font-bold font-display tracking-tight text-slate-100">
            Animations Dynamiques par Circuit & Galeries Tunnels
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Auparavant, <code className="font-mono text-slate-200">build_pano()</code> figeait les aurores boréales, les projecteurs et la mer dans un tampon statique en PSRAM, et le flag{' '}
            <code className="font-mono text-slate-200">SEGF_TUNNEL</code> défini dans <code className="font-mono text-slate-200">track.h</code> n’était pas encore rendu. Chaque circuit possède désormais ses propres animations temps réel légères.
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
                  <p className="text-xs text-orange-300/90 font-medium">{tr.pitStyleFr}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{tr.animHighlightsFr}</p>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-800/80">
                  <button
                    onClick={() => onLaunchCircuitSection(tr.id, false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Rouler ici
                  </button>
                  {hasTunnel && (
                    <button
                      onClick={() => onLaunchCircuitSection(tr.id, true)}
                      className="px-3 py-1.5 text-xs font-medium text-sky-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Voir Tunnel
                    </button>
                  )}
                  <button
                    onClick={() => onLaunchPitTest(tr.id)}
                    className="px-3 py-1.5 text-xs font-medium text-amber-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Stand
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
