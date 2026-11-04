import { useCallback, useEffect, useRef, useState } from 'react';
import {
  generateMagentaSpriteSheetDataUrl,
  initCarArtAtlas,
  type CarArtAtlas,
} from './engine/carArt3D';
import { AkaRaceSimulator } from './engine/raceSim';
import { useMultiplayerRoom } from './hooks/useMultiplayerRoom';
import { AkaConsoleStage } from './components/AkaConsoleStage';
import { MultiplayerLobbyPanel } from './components/MultiplayerLobbyPanel';
import { PitAndCircuitGuide } from './components/PitAndCircuitGuide';
import { CppExportPanel } from './components/CppExportPanel';
import { CPP_PATCH_FILES } from './data/cppPatches';
import type { RoomStatePayload } from './shared/raceProtocol';

type ActiveTab = 'simulator' | 'pits' | 'multiplayer' | 'cpp';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('simulator');
  const [atlas, setAtlas] = useState<CarArtAtlas | null>(null);
  const simRef = useRef<AkaRaceSimulator>(new AkaRaceSimulator());
  const [circuitAnimV12, setCircuitAnimV12] = useState<boolean>(true);

  const handleToggleCircuitAnim = useCallback((enabled: boolean) => {
    setCircuitAnimV12(enabled);
    simRef.current.features.circuitAnimV12 = enabled;
    simRef.current.showBanner(
      enabled ? 'CIEL LUT SIN8 & PORTIQUES TUNNEL : ON' : 'DECORS ORIGINE GITHUB : ON',
      enabled ? [130, 235, 255] : [200, 210, 230],
      1.5
    );
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
    const bundleLines: string[] = [
      '# Pack Correctifs & Briques C++ Race3D-AKA (Gamebuino AKA ESP32-S3 + PC SDL2)',
      '',
      'Synchronisé sur https://github.com/Jicehel-Aka/Race3D-AKA (commit f0b651e) :',
      '1. Chorégraphie 4 phases des techniciens (attente extérieure, contournement avant à l’arrêt, bandes au sol fixes, travail en poste, départ immédiat) + cadre HUD auto-ajusté',
      '2. Animations temps réel des 6 circuits (LUT int16_t s_sin8[256] 60 FPS + portiques SEGF_TUNNEL)',
      '3. Architecture rastériseur 3D virgule fixe Q16.16 (int32_t + table réciproque 1/z pour ESP32-S3 LX7)',
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
    a.download = 'Race3D_AKA_Patches_Bundle.cpp';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadMagentaSheet = () => {
    if (!atlas) return;
    const dataUrl = generateMagentaSpriteSheetDataUrl(atlas, 'unified_3d', false);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'cars_sheet_unified_3d.png';
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

          {/* Zone 2: 4 concise single-line text navigation links */}
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
              onClick={() => setActiveTab('pits')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'pits'
                  ? 'text-white border-b-2 border-orange-500'
                  : 'hover:text-slate-100'
              }`}
            >
              Stands & Techniciens
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
              Exporter Correctifs C++
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Tab Selector (only below md) */}
      <div className="md:hidden border-b border-slate-800 px-4 py-2 overflow-x-auto flex items-center gap-2 bg-[#0E1420]">
        {[
          { id: 'simulator', label: 'Simulateur' },
          { id: 'pits', label: 'Techniciens' },
          { id: 'multiplayer', label: 'Multijoueur' },
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
            circuitAnimV12={circuitAnimV12}
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

        {activeTab === 'pits' && (
          <PitAndCircuitGuide
            onLaunchPitTest={(trackId) => {
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
            onOpenCppPatch={() => setActiveTab('cpp')}
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
