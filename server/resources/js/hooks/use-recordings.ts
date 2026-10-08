import { useEffect, useState } from 'react';

export interface RecordingInfo {
  id: string;
  kind: 'camera' | 'screen' | 'evidence' | string;
  status: string;
  mime?: string;
  duration_ms: number;
  started_at?: number;
  ended_at?: number;
  created_at: number;
  url?: string;
}

/** Recordings and evidence pictures of one attempt, with short-lived download URLs from the record service. */
export function useAttemptRecordings(examId: number, attemptId: number) {
  const [items, setItems] = useState<RecordingInfo[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'disabled' | 'error'>('loading');

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch(`/admin/exams/${examId}/realtime`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
        if (!res.ok) return live && setState('disabled');
        const info = await res.json();
        const rec = await fetch(`${info.record_url}/v1/exams/${examId}/attempts/${attemptId}/recordings`, { headers: { Authorization: `Bearer ${info.token}` } });
        if (!rec.ok) return live && setState('error');
        const json = await rec.json();
        if (live) {
          setItems(json.recordings ?? []);
          setState('ready');
        }
      } catch {
        if (live) setState('error');
      }
    })();
    return () => {
      live = false;
    };
  }, [examId, attemptId]);

  return { items, state };
}
