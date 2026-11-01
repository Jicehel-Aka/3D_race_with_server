import { useCallback, useEffect, useRef, useState } from 'react';
import {
  generateMagentaSpriteSheetDataUrl,
  initCarArtAtlas,
  type CarArtAtlas,
  type SpriteMode,
} from './engine/carArt3D';
import { AkaRaceSimulator } from './engine/raceSim';
import { useMultiplayerRoom } from './hooks/useMultiplayerRoom';
import { AkaConsoleStage } from './components/AkaConsoleStage';
import { MultiplayerLobbyPanel } from './components/MultiplayerLobbyPanel';
import { SpriteWorkbench } from './components/SpriteWorkbench';
import { PitAndCircuitGuide } from './components/PitAndCircuitGuide';
import { CppExportPanel } from './components/CppExportPanel';
import { CPP_PATCH_FILES } from './data/cppPatches';
import type { RoomStatePayload } from './shared/raceProtocol';

type ActiveTab = 'simulator' | 'multiplayer' | 'sprites' | 'pits' | 'cpp';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('sprites');
  const [atlas, setAtlas] = useState<CarArtAtlas | null>(null);
  const simRef = useRef<AkaRaceSimulator>(new AkaRaceSimulator());
  const [spriteMode, setSpriteMode] = useState<SpriteMode>('unified_3d');
  const [subStageBlend, setSubStageBlend] = useState<boolean>(true);
  const [steerVisRate, setSteerVisRate] = useState<number>(5.4);
  const [pitModeV12, setPitModeV12] = useState<boolean>(false);
  const [circuitAnimV12, setCircuitAnimV12] = useState<boolean>(false);

  const handleSelectSpriteMode = useCallback((mode: SpriteMode) => {
    setSpriteMode(mode);
    simRef.current.features.spriteMode = mode;
    const label =
      mode === 'unified_3d'
        ? 'SPRITES : ROTATION 3D HYBRIDE (ZERO MORPHING)'
        : mode === 'repo_2c7e371'
        ? 'SPRITES : GITHUB 2C7E371 (OPTICAL FLOW)'
        : mode === 'hybrid_clean'
        ? 'SPRITES : ANCIEN HYBRIDE (FONDU 2D)'
        : 'SPRITES : ARRIERE FIXE 0 DEG';
    simRef.current.showBanner(
      label,
      mode === 'unified_3d'
        ? [130, 255, 180]
        : mode === 'repo_2c7e371'
        ? [255, 200, 110]
        : [160, 195, 235],
      1.8
    );
  }, []);

  const handleToggleSubStageBlend = useCallback((enabled: boolean) => {
    setSubStageBlend(enabled);
    simRef.current.features.subStageBlend = enabled;
    simRef.current.showBanner(
      enabled ? 'ANGLES 3D HYBRIDE : 19 PAS (1.6 DEG)' : 'ANGLES 3D HYBRIDE : 7 PALIERS AKA (4.8 DEG)',
      enabled ? [130, 255, 180] : [200, 210, 230],
      1.5
    );
  }, []);

  const handleChangeSteerVisRate = useCallback((rate: number) => {
    setSteerVisRate(rate);
    simRef.current.features.steerVisSmoothRate = rate;
    simRef.current.showBanner(`INERTIE VIRAGE STEERVIS : ${rate.toFixed(1)}`, [255, 215, 110], 1.5);
  }, []);

  const handleTogglePitMode = useCallback((enabled: boolean) => {
    setPitModeV12(enabled);
    simRef.current.features.pitModeV12 = enabled;
  }, []);

  const handleToggleCircuitAnim = useCallback((enabled: boolean) => {
    setCircuitAnimV12(enabled);
    simRef.current.features.circuitAnimV12 = enabled;
  }, []);

  useEffect(() => {
    initCarArtAtlas().then((loaded) => {
      setAtlas(loaded);
    });
  }, []);

  const handleServerSnapshot = useCallback((room: RoomStatePayload, mySlot: number) => {
    simRef.current.applyServerRoomState(room, mySlot);
  }, []);

  const mp = useMultiplayerRoom(handleServerSnapshot);

  const handleDownloadPackBundle = () => {
    // Download combined markdown/C++ integration bundle + magenta sheet if ready
    const bundleLines: string[] = [
      '# Pack Améliorations Race3D-AKA v1.2 (Gamebuino AKA ESP32-S3 + PC SDL2)',
      '',
      'Ce fichier regroupe les correctifs prêts à intégrer dans https://github.com/Jicehel-Aka/Race3D-AKA :',
      '1. Rotation 3D Hybride (Avant Bas Calibré + Texture Stage 6) : Même GT de 0° à 29°, Z-buffer 3D rigide avec rétro-projection fidèle de la vue 3/4',
      '2. Voie des stands sécurisée à 3 box spécialisés (N2O Express, Pneus & Géométrie, Garage Moteur + Lollipop GO!)',
      '3. Animations temps réel des 6 circuits (LUT int16_t s_sin8[256] 60 FPS + tunnels SEGF_TUNNEL)',
      '4. Client multijoueur temps réel Wi-Fi WebSocket binaire 20 octets (ESP32-S3 & PC)',
      '',
    ];
    for (const f of CPP_PATCH_FILES) {
      bundleLines.push(`// ==================== ${f.filename} (${f.targetPathInRepo}) ====================`);
      bundleLines.push(f.code);
      bundleLines.push('');
    }
    const blob = new Blob([bundleLines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Race3D_AKA_v1.2_Patches_Bundle.cpp';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadMagentaSheet = () => {
    if (!atlas) return;
    const src: 'unified_3d' | 'hybrid_clean' | 'repo_2c7e371' =
      spriteMode === 'repo_2c7e371'
        ? 'repo_2c7e371'
        : spriteMode === 'hybrid_clean'
        ? 'hybrid_clean'
        : 'unified_3d';
    const dataUrl = generateMagentaSpriteSheetDataUrl(atlas, src, false);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `cars_sheet_${src}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-[#0B0F17]/95 backdrop-blur border-b border-slate-800/90">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-8 px-5 sm:px-8 py-3.5">
          {/* Zone 1: Single text element wordmark */}
          <button
            onClick={() => setActiveTab('simulator')}
            className="text-xl font-bold font-display tracking-wide text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Race3D AKA Studio
          </button>

          {/* Zone 2: 5 concise single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'simulator'
                  ? 'text-white border-b-2 border-orange-500'
                  : 'hover:text-slate-100'
              }`}
            >
              Simulateur AKA
            </button>
            <button
              onClick={() => setActiveTab('multiplayer')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'multiplayer'
                  ? 'text-white border-b-2 border-orange-500'
                  : 'hover:text-slate-100'
              }`}
            >
              Serveur Multijoueur
            </button>
            <button
              onClick={() => setActiveTab('sprites')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'sprites'
                  ? 'text-white border-b-2 border-orange-500'
                  : 'hover:text-slate-100'
              }`}
            >
              Comparateur 3/4
            </button>
            <button
              onClick={() => setActiveTab('pits')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'pits'
                  ? 'text-white border-b-2 border-orange-500'
                  : 'hover:text-slate-100'
              }`}
            >
              Stands & Circuits
            </button>
            <button
              onClick={() => setActiveTab('cpp')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'cpp'
                  ? 'text-white border-b-2 border-orange-500'
                  : 'hover:text-slate-100'
              }`}
            >
              Code C++ AKA
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleDownloadPackBundle}
              className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Exporter Pack C++ v1.2
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Tab Selector (only below md) */}
      <div className="md:hidden border-b border-slate-800 px-4 py-2 overflow-x-auto flex items-center gap-2 bg-[#0E1420]">
        {[
          { id: 'simulator', label: 'Simulateur' },
          { id: 'multiplayer', label: 'Multijoueur' },
          { id: 'sprites', label: 'Sprites 3/4' },
          { id: 'pits', label: 'Stands & Circuits' },
          { id: 'cpp', label: 'Code C++' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as ActiveTab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
              activeTab === item.id ? 'bg-slate-800 text-white' : 'text-slate-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-5 sm:px-8 py-7">
        {activeTab === 'simulator' && (
          <AkaConsoleStage
            simRef={simRef}
            spriteMode={spriteMode}
            subStageBlend={subStageBlend}
            steerVisRate={steerVisRate}
            pitModeV12={pitModeV12}
            circuitAnimV12={circuitAnimV12}
            onChangeSpriteMode={handleSelectSpriteMode}
            onToggleSubStageBlend={handleToggleSubStageBlend}
            onChangeSteerVisRate={handleChangeSteerVisRate}
            onTogglePitMode={handleTogglePitMode}
            onToggleCircuitAnim={handleToggleCircuitAnim}
            multiplayerJoined={mp.joined}
            roomState={mp.roomState}
            mySlot={mp.mySlot}
            rttMs={mp.rttMs}
            onSendTelemetry={mp.sendTelemetry}
            onOpenTab={(t) => setActiveTab(t)}
          />
        )}

        {activeTab === 'multiplayer' && (
          <MultiplayerLobbyPanel
            connected={mp.connected}
            joined={mp.joined}
            mySlot={mp.mySlot}
            rttMs={mp.rttMs}
            wsEndpointUrl={mp.wsEndpointUrl}
            roomState={mp.roomState}
            availableRooms={mp.availableRooms}
            onJoinRoom={mp.joinRoom}
            onLeaveRoom={() => {
              mp.leaveMultiplayer();
              simRef.current.multiplayerActive = false;
            }}
            onUpdateProfile={mp.updateProfile}
            onConfigureRoom={mp.configureRoom}
            onStartRaceAndSwitchToSim={() => {
              mp.startMultiplayerRace();
              setActiveTab('simulator');
            }}
            onJumpToSim={() => setActiveTab('simulator')}
            onRefreshRooms={mp.refreshRooms}
          />
        )}

        {activeTab === 'sprites' && (
          <SpriteWorkbench
            atlas={atlas}
            activeSpriteMode={spriteMode}
            subStageBlend={subStageBlend}
            steerVisRate={steerVisRate}
            pitModeV12={pitModeV12}
            circuitAnimV12={circuitAnimV12}
            onSelectSpriteMode={handleSelectSpriteMode}
            onToggleSubStageBlend={handleToggleSubStageBlend}
            onChangeSteerVisRate={handleChangeSteerVisRate}
            onTogglePitMode={handleTogglePitMode}
            onToggleCircuitAnim={handleToggleCircuitAnim}
            onLaunchSimulator={() => setActiveTab('simulator')}
          />
        )}

        {activeTab === 'pits' && (
          <PitAndCircuitGuide
            onLaunchPitTest={(trackId) => {
              handleTogglePitMode(true);
              simRef.current.setupRace(trackId, 1, 3, false);
              simRef.current.teleportToPitApproach(0.64);
              setActiveTab('simulator');
            }}
            onLaunchCircuitSection={(trackId, tunnelFocus) => {
              handleToggleCircuitAnim(true);
              simRef.current.setupRace(trackId, 1, 3, false);
              if (tunnelFocus) {
                simRef.current.teleportToTunnelOrHighlight();
              } else {
                simRef.current.player().speed = 12000 * 0.72;
              }
              setActiveTab('simulator');
            }}
          />
        )}

        {activeTab === 'cpp' && (
          <CppExportPanel onDownloadMagentaSheet={handleDownloadMagentaSheet} />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 py-5 px-5 sm:px-8 text-xs text-slate-500">
        <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <span>
            Atelier d’évolution pour AKA Turbo 3D Grand Prix (Jicehel-Aka/Race3D-AKA) · Gamebuino AKA ESP32-S3
          </span>
          <span className="font-mono">
            320×240 RGB565 · WebSocket /ws/race · Trame binaire 0xA4 / 0xA5
          </span>
        </div>
      </footer>
    </div>
  );
}
