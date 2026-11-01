import React, { useState } from 'react';
import { Check, Copy, Play, RefreshCw, Users } from 'lucide-react';
import {
  DRIVERS,
  TRACK_DEFS,
  type DevicePlatform,
  type RoomStatePayload,
  type RoomSummary,
} from '../shared/raceProtocol';

interface MultiplayerLobbyPanelProps {
  connected: boolean;
  joined: boolean;
  mySlot: number;
  rttMs: number;
  wsEndpointUrl: string;
  roomState: RoomStatePayload | null;
  availableRooms: RoomSummary[];
  onJoinRoom: (code: string, name: string, platform: DevicePlatform, driverLook: number) => void;
  onLeaveRoom: () => void;
  onUpdateProfile: (patch: { name?: string; driverLook?: number; platform?: DevicePlatform }) => void;
  onConfigureRoom: (patch: { trackId?: number; laps?: number; difficulty?: number; fillAi?: boolean }) => void;
  onStartRaceAndSwitchToSim: () => void;
  onJumpToSim: () => void;
  onRefreshRooms: () => void;
}

export const MultiplayerLobbyPanel: React.FC<MultiplayerLobbyPanelProps> = ({
  connected,
  joined,
  mySlot,
  rttMs,
  wsEndpointUrl,
  roomState,
  availableRooms,
  onJoinRoom,
  onLeaveRoom,
  onUpdateProfile,
  onConfigureRoom,
  onStartRaceAndSwitchToSim,
  onJumpToSim,
  onRefreshRooms,
}) => {
  const [roomInput, setRoomInput] = useState<string>('AKA1');
  const [callsign, setCallsign] = useState<string>('JICEHEL');
  const [platform, setPlatform] = useState<DevicePlatform>('AKA');
  const [driverLook, setDriverLook] = useState<number>(7);
  const [copiedUri, setCopiedUri] = useState<boolean>(false);

  const activeCode = roomState?.code || roomInput || 'AKA1';
  const binaryUri = `${wsEndpointUrl}?mode=binary&room=${encodeURIComponent(activeCode)}&platform=AKA&name=${encodeURIComponent(callsign || 'AKA-S3')}`;

  const handleCopyUri = async () => {
    try {
      await navigator.clipboard.writeText(binaryUri);
      setCopiedUri(true);
      window.setTimeout(() => setCopiedUri(false), 1800);
    } catch {
      // Ignore clipboard restriction
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-800">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-mono text-slate-400 tabular-nums">
            Serveur WebSocket Temps Réel · Tick 20 Hz · JSON Web + Binaire 20 octets (AKA ESP32-S3 / PC SDL2)
          </p>
          <h2 className="text-3xl font-bold font-display tracking-tight text-slate-100">
            Serveur de Course Multijoueur Cross-Plateforme (PC · Gamebuino AKA · Web)
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Ouvrez cette page dans un second onglet ou sur un autre PC/mobile, ou connectez une vraie{' '}
            <strong className="text-white">Gamebuino AKA</strong> en Wi-Fi via{' '}
            <code className="font-mono text-orange-300">net_mp_aka.cpp</code> sur le même code salon pour courir ensemble avec grille et chronos synchronisés.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {joined && (
            <button
              onClick={onStartRaceAndSwitchToSim}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-4 h-4" />
              Lancer le départ synchronisé
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Player Profile & Join Card */}
        <div className="lg:col-span-5 bg-[#121826] border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-100">Profil Pilote & Connexion Salon</h3>
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              {joined && connected ? `Connecté · ${rttMs} ms` : 'Hors salon'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Code Salon (4-8 car.)</label>
              <input
                type="text"
                maxLength={8}
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-sm font-mono uppercase bg-[#0B0F17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-orange-500"
                placeholder="AKA1"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Pseudo Grille</label>
              <input
                type="text"
                maxLength={8}
                value={callsign}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase();
                  setCallsign(v);
                  if (joined) onUpdateProfile({ name: v });
                }}
                className="w-full px-3 py-2 text-sm font-mono uppercase bg-[#0B0F17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-orange-500"
                placeholder="PILOTE"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">Plateforme affichée sur la piste</label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg">
              {(['AKA', 'PC', 'WEB'] as DevicePlatform[]).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPlatform(p);
                    if (joined) onUpdateProfile({ platform: p });
                  }}
                  className={`py-1.5 text-xs font-mono font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    platform === p
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p === 'AKA' ? 'Gamebuino AKA' : p === 'PC' ? 'PC (SDL2)' : 'Navigateur'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">Carrosserie (0..7)</label>
            <div className="grid grid-cols-4 gap-2">
              {DRIVERS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setDriverLook(d.id);
                    if (joined) onUpdateProfile({ driverLook: d.id });
                  }}
                  className={`px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                    driverLook === d.id
                      ? 'bg-slate-800 border-orange-500 text-white'
                      : 'bg-[#0B0F17] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: d.hex }} />
                    <span className="text-xs font-mono truncate">{d.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => onJoinRoom(roomInput || 'AKA1', callsign || 'PILOTE', platform, driverLook)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Users className="w-4 h-4" />
              {joined ? `Changer / Actualiser (${roomInput || 'AKA1'})` : `Rejoindre le salon ${roomInput || 'AKA1'}`}
            </button>
            {joined && (
              <button
                onClick={onLeaveRoom}
                className="px-3.5 py-2.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Quitter
              </button>
            )}
          </div>

          {/* Direct Binary Endpoint Box for ESP32-S3 / PC */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">URL WebSocket Binaire (AKA ESP32-S3 & PC C++)</span>
              <button
                onClick={handleCopyUri}
                className="inline-flex items-center gap-1 text-xs font-mono text-orange-400 hover:text-orange-300 cursor-pointer"
              >
                {copiedUri ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedUri ? 'Copié' : 'Copier URI'}
              </button>
            </div>
            <div className="p-2.5 rounded-lg bg-[#090D15] border border-slate-800 text-[11px] font-mono text-slate-300 break-all">
              {binaryUri}
            </div>
          </div>
        </div>

        {/* Right: Active Room Grid & Race Settings */}
        <div className="lg:col-span-7 space-y-6">
          {joined && roomState ? (
            <div className="bg-[#121826] border border-slate-800 rounded-xl p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <p className="text-xs font-mono text-orange-400 tabular-nums">
                    SALON {roomState.code} · ÉTAT : {roomState.phase} · EMPLACEMENT GRILLE #{mySlot + 1}
                  </p>
                  <h3 className="text-xl font-bold font-display text-slate-100">
                    Grille de Départ Temps Réel (8 Voitures Synchronisées)
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onJumpToSim}
                    className="px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Ouvrir l’écran 320×240
                  </button>
                  <button
                    onClick={onStartRaceAndSwitchToSim}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Départ Course
                  </button>
                </div>
              </div>

              {/* Room Track & Lap Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Circuit du salon</label>
                  <select
                    value={roomState.trackId}
                    onChange={(e) => onConfigureRoom({ trackId: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs font-medium bg-[#0B0F17] border border-slate-700 rounded-lg text-slate-100"
                  >
                    {TRACK_DEFS.map((t) => (
                      <option key={t.id} value={t.id}>
                        0{t.id + 1} · {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Nombre de tours</label>
                  <select
                    value={roomState.laps}
                    onChange={(e) => onConfigureRoom({ laps: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs font-medium bg-[#0B0F17] border border-slate-700 rounded-lg text-slate-100"
                  >
                    {[1, 2, 3, 5].map((l) => (
                      <option key={l} value={l}>
                        {l} {l > 1 ? 'tours' : 'tour'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Compléter la grille avec l’IA</label>
                  <button
                    onClick={() => onConfigureRoom({ fillAi: !roomState.fillAi })}
                    className="w-full px-3 py-2 text-xs font-medium bg-[#0B0F17] border border-slate-700 rounded-lg text-slate-200 text-left cursor-pointer"
                  >
                    {roomState.fillAi ? 'Oui (8 voitures en piste)' : 'Non (Joueurs humains seuls)'}
                  </button>
                </div>
              </div>

              {/* 8-Slot Starting Grid Table */}
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0B0F17] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Grille</th>
                      <th className="py-2.5 px-3 font-medium">Pilote</th>
                      <th className="py-2.5 px-3 font-medium">Appareil</th>
                      <th className="py-2.5 px-3 font-medium text-right">Vitesse</th>
                      <th className="py-2.5 px-3 font-medium text-right">Tour</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                    {roomState.cars.map((c) => {
                      const isMe = c.slot === mySlot;
                      const drv = DRIVERS[c.driverLook % DRIVERS.length];
                      return (
                        <tr
                          key={c.slot}
                          className={isMe ? 'bg-orange-500/10 text-slate-100' : 'text-slate-300'}
                        >
                          <td className="py-2 px-3">P{c.place}</td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: drv.hex }} />
                              <span className="font-semibold">{c.name}</span>
                              {isMe && <span className="text-orange-400">(Vous)</span>}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-slate-400">
                            {c.platform === 'AI' ? (roomState.fillAi ? 'IA Serveur' : 'Inactif') : c.platform}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {Math.round((c.speed / 12000) * 240)} km/h
                          </td>
                          <td className="py-2 px-3 text-right">
                            {Math.min(roomState.laps, c.lapsDone + 1)}/{roomState.laps}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-[#121826] border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-100">Salons publics actifs sur le serveur</h3>
                <button
                  onClick={onRefreshRooms}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualiser
                </button>
              </div>

              <div className="space-y-2.5">
                {availableRooms.map((r) => (
                  <div
                    key={r.code}
                    className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-[#0B0F17] border border-slate-800"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-semibold font-mono text-slate-100">
                        Salon {r.code} · {r.trackName}
                      </div>
                      <div className="text-xs text-slate-400 font-mono tabular-nums">
                        {r.humanCount} pilote(s) connecté(s) · {r.laps} tours · État {r.phase}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setRoomInput(r.code);
                        onJoinRoom(r.code, callsign || 'PILOTE', platform, driverLook);
                      }}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-orange-600 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Rejoindre {r.code}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
