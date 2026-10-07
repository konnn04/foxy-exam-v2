import { useCallback, useEffect, useRef, useState } from 'react';

/** One candidate row as the realtime hub reports it (derived from real client signals, never a stored flag). */
export interface LiveRow {
  attempt_id: number;
  user_id?: number;
  status: 'online' | 'away' | 'offline' | 'paused' | 'ended';
  focus?: boolean;
  fullscreen?: boolean;
  camera?: boolean;
  screen?: boolean;
  latency_ms?: number;
  question?: number;
  attention?: number;
  faces?: number;
  last_seen_ms: number;
  violations: number;
  last_violation?: { type: string; severity: string; ts: number };
  pending_command?: string;
}

export interface LiveCounts {
  total: number;
  online: number;
  away: number;
  offline: number;
  paused: number;
  ended: number;
  violations: number;
}

export type LiveState = 'disabled' | 'connecting' | 'live' | 'reconnecting';
export type LiveCommand = 'WARN' | 'PAUSE' | 'RESUME' | 'FORCE_END';

/**
 * Connects the proctor UI to the realtime hub of one exam.
 *
 * The server pushes at most one delta per second; this hook merges them into `rows` (by attempt id).
 * When the realtime plane is not configured (`/admin/exams/{id}/realtime` answers 503) the state is
 * `disabled` and callers keep using the polled Inertia data.
 */
export function useLiveRoom(examId: number, enabled = true) {
  const [rows, setRows] = useState<Record<number, LiveRow>>({});
  const [counts, setCounts] = useState<LiveCounts | null>(null);
  const [state, setState] = useState<LiveState>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string>('');
  const hubHttp = useRef<string>('');

  useEffect(() => {
    if (!enabled) {
      setState('disabled');
      return;
    }
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = async () => {
      try {
        const res = await fetch(`/admin/exams/${examId}/realtime`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
        if (res.status === 503 || res.status === 404 || res.status === 403) {
          setState('disabled');
          return;
        }
        const info = await res.json();
        tokenRef.current = info.token;
        hubHttp.current = info.hub_http_url;
        if (closed) return;

        const ws = new WebSocket(`${info.hub_ws_url}?token=${encodeURIComponent(info.token)}`);
        wsRef.current = ws;
        ws.onopen = () => {
          retry = 0;
          setState('live');
        };
        ws.onmessage = (e) => {
          let m: any;
          try {
            m = JSON.parse(e.data);
          } catch {
            return;
          }
          if (m.type === 'snapshot') {
            setRows(Object.fromEntries((m.rows ?? []).map((r: LiveRow) => [r.attempt_id, r])));
            setCounts(m.counts ?? null);
          } else if (m.type === 'delta') {
            setRows((prev) => {
              const next = { ...prev };
              for (const r of m.rows ?? []) next[r.attempt_id] = r;
              return next;
            });
            if (m.counts) setCounts(m.counts);
          }
        };
        ws.onclose = () => {
          if (closed) return;
          setState('reconnecting');
          // exponential backoff 1s..15s; the token is re-fetched, so an expired one heals itself
          timer = setTimeout(connect, Math.min(15_000, 1000 * 2 ** retry++));
        };
        ws.onerror = () => ws.close();
      } catch {
        if (!closed) {
          setState('reconnecting');
          timer = setTimeout(connect, Math.min(15_000, 1000 * 2 ** retry++));
        }
      }
    };

    setState('connecting');
    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      wsRef.current?.close();
    };
  }, [examId, enabled]);

  /** Warn / pause / resume / end one candidate. Resolves true when the hub accepted the command. */
  const sendCommand = useCallback(
    async (attemptId: number, command: LiveCommand, message?: string): Promise<boolean> => {
      if (!hubHttp.current) return false;
      const base = hubHttp.current.replace(/^ws/, 'http');
      try {
        const res = await fetch(`${base}/v1/rooms/${examId}/commands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
          body: JSON.stringify({ attempt_id: attemptId, command, message }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [examId],
  );

  return { rows, counts, state, sendCommand };
}
