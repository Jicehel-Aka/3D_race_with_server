import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ClientCarTelemetry,
  DevicePlatform,
  RoomStatePayload,
  RoomSummary,
} from '../shared/raceProtocol';

interface MultiplayerHookResult {
  connected: boolean;
  joined: boolean;
  clientId: string;
  mySlot: number;
  rttMs: number;
  roomState: RoomStatePayload | null;
  availableRooms: RoomSummary[];
  wsEndpointUrl: string;
  joinRoom: (roomCode: string, name: string, platform: DevicePlatform, driverLook: number) => void;
  leaveMultiplayer: () => void;
  updateProfile: (patch: { name?: string; driverLook?: number; platform?: DevicePlatform; ready?: boolean }) => void;
  configureRoom: (patch: { trackId?: number; laps?: number; difficulty?: number; fillAi?: boolean }) => void;
  startMultiplayerRace: () => void;
  returnToLobby: () => void;
  sendTelemetry: (telemetry: ClientCarTelemetry) => void;
  refreshRooms: () => Promise<void>;
}

function getPersistentClientId(): string {
  try {
    const key = 'aka_race3d_client_id';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = `aka-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `aka-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function useMultiplayerRoom(
  onServerSnapshot?: (room: RoomStatePayload, mySlot: number) => void
): MultiplayerHookResult {
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [mySlot, setMySlot] = useState(7);
  const [rttMs, setRttMs] = useState(14);
  const [roomState, setRoomState] = useState<RoomStatePayload | null>(null);
  const [availableRooms, setAvailableRooms] = useState<RoomSummary[]>([]);

  const clientIdRef = useRef<string>(getPersistentClientId());
  const wsRef = useRef<WebSocket | null>(null);
  const mySlotRef = useRef<number>(7);
  const desiredJoinRef = useRef<{
    roomCode: string;
    name: string;
    platform: DevicePlatform;
    driverLook: number;
  } | null>(null);
  const callbackRef = useRef(onServerSnapshot);
  callbackRef.current = onServerSnapshot;

  const wsProto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
  const wsEndpointUrl = `${wsProto}//${wsHost}/ws/race`;

  const refreshRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.rooms)) setAvailableRooms(data.rooms);
    } catch {
      // Ignore transient network errors
    }
  }, []);

  const connectSocket = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const ws = new WebSocket(`${wsEndpointUrl}?clientId=${encodeURIComponent(clientIdRef.current)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (desiredJoinRef.current) {
        ws.send(JSON.stringify({ type: 'room:join', payload: desiredJoinRef.current }));
      }
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg.type === 'pong' && typeof msg.clientSentAt === 'number') {
          const rtt = Math.max(1, Date.now() - msg.clientSentAt);
          setRttMs(rtt);
          return;
        }
        if (msg.type === 'room:joined') {
          const { slot, room } = msg.payload as { slot: number; room: RoomStatePayload };
          mySlotRef.current = slot;
          setMySlot(slot);
          setJoined(true);
          setRoomState(room);
          callbackRef.current?.(room, slot);
          refreshRooms();
          return;
        }
        if (msg.type === 'room:state' || msg.type === 'race:snapshot') {
          const room = msg.payload as RoomStatePayload;
          setRoomState(room);
          callbackRef.current?.(room, mySlotRef.current);
        }
      } catch {
        // Ignore non-JSON frames
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      // Auto-reconnect if player was in a multiplayer room
      if (desiredJoinRef.current) {
        window.setTimeout(() => {
          if (desiredJoinRef.current) connectSocket();
        }, 1600);
      }
    };
  }, [wsEndpointUrl, refreshRooms]);

  useEffect(() => {
    refreshRooms();
    const poll = window.setInterval(refreshRooms, 4500);
    return () => window.clearInterval(poll);
  }, [refreshRooms]);

  useEffect(() => {
    const pingTimer = window.setInterval(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', clientSentAt: Date.now(), rtt: rttMs }));
      }
    }, 2500);
    return () => window.clearInterval(pingTimer);
  }, [rttMs]);

  useEffect(() => {
    return () => {
      desiredJoinRef.current = null;
      wsRef.current?.close();
    };
  }, []);

  const joinRoom = useCallback(
    (roomCode: string, name: string, platform: DevicePlatform, driverLook: number) => {
      desiredJoinRef.current = { roomCode, name, platform, driverLook };
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connectSocket();
      } else {
        wsRef.current.send(JSON.stringify({ type: 'room:join', payload: desiredJoinRef.current }));
      }
    },
    [connectSocket]
  );

  const leaveMultiplayer = useCallback(() => {
    desiredJoinRef.current = null;
    setJoined(false);
    setRoomState(null);
    wsRef.current?.close();
    wsRef.current = null;
    refreshRooms();
  }, [refreshRooms]);

  const updateProfile = useCallback(
    (patch: { name?: string; driverLook?: number; platform?: DevicePlatform; ready?: boolean }) => {
      if (desiredJoinRef.current) {
        desiredJoinRef.current = {
          ...desiredJoinRef.current,
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.driverLook !== undefined ? { driverLook: patch.driverLook } : {}),
          ...(patch.platform !== undefined ? { platform: patch.platform } : {}),
        };
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'player:profile', payload: patch }));
      }
    },
    []
  );

  const configureRoom = useCallback(
    (patch: { trackId?: number; laps?: number; difficulty?: number; fillAi?: boolean }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'room:configure', payload: patch }));
      }
    },
    []
  );

  const startMultiplayerRace = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'race:start' }));
    }
  }, []);

  const returnToLobby = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'race:lobby' }));
    }
  }, []);

  const sendTelemetry = useCallback((telemetry: ClientCarTelemetry) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'car:telemetry', payload: telemetry }));
    }
  }, []);

  return {
    connected,
    joined,
    clientId: clientIdRef.current,
    mySlot,
    rttMs,
    roomState,
    availableRooms,
    wsEndpointUrl,
    joinRoom,
    leaveMultiplayer,
    updateProfile,
    configureRoom,
    startMultiplayerRace,
    returnToLobby,
    sendTelemetry,
    refreshRooms,
  };
}
