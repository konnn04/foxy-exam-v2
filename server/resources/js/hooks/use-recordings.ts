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
  const [access, setAccess] = useState<{ record_url: string; token: string } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch(`/admin/exams/${examId}/realtime`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
        if (!res.ok) return live && setState('disabled');
        const info = await res.json();
        if (live) setAccess({ record_url: info.record_url, token: info.token });
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

  /** Ask the record service to cut [fromS, toS] seconds out of a recording; resolves the download URL. */
  const clip = async (rec: RecordingInfo, fromS: number, toS: number): Promise<string> => {
    if (!access) throw new Error('Chưa sẵn sàng');
    const res = await fetch(`${access.record_url}/v1/recordings/${rec.id}/clip?from=${Math.max(0, Math.floor(fromS))}&to=${Math.ceil(toS)}`, { headers: { Authorization: `Bearer ${access.token}` } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error === 'clips_disabled' ? 'Máy chủ chưa bật cắt clip.' : 'Không cắt được clip.');
    return json.url as string;
  };

  return { items, state, clip };
}
