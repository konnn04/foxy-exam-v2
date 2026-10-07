import React, { useRef, useState } from 'react';
import { ImageIcon, Loader2, Music, Upload, X } from 'lucide-react';
import { FxButton, FxInput } from './ui';
import { useDialog } from './dialogs';

function xsrf(): string {
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

/**
 * URL field + upload button for question illustrations (image) and listening audio.
 * Files go to POST /admin/question-media and come back as a public URL.
 */
export function MediaInput({
  kind,
  value,
  onChange,
  placeholder,
}: {
  kind: 'image' | 'audio';
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
}) {
  const dialog = useDialog();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/admin/question-media', {
        method: 'POST',
        body,
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf(), 'X-Requested-With': 'XMLHttpRequest' },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.errors?.file?.[0] || json?.message || `Lỗi ${res.status}`);
      onChange(json.url);
      dialog.toast.success('Đã tải tệp lên');
    } catch (e) {
      await dialog.alert({ title: 'Không tải được tệp', text: (e as Error).message, tone: 'danger' });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const Icon = kind === 'image' ? ImageIcon : Music;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <FxInput value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? (kind === 'image' ? 'https://… hoặc tải ảnh lên' : 'https://… hoặc tải âm thanh lên')} />
        <input ref={input} type="file" hidden accept={kind === 'image' ? 'image/*' : 'audio/*'} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <FxButton icon={busy ? Loader2 : Upload} disabled={busy} onClick={() => input.current?.click()}>
          Tải lên
        </FxButton>
        {value && (
          <button type="button" aria-label="Xóa" onClick={() => onChange('')} className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-muted">
            <X className="size-4" />
          </button>
        )}
      </div>
      {value ? (
        kind === 'image' ? (
          <img src={value} alt="" className="max-h-48 w-fit rounded-lg border border-border object-contain" />
        ) : (
          <audio src={value} controls className="w-full" />
        )
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="size-3.5" />
          {kind === 'image' ? 'JPG, PNG, WEBP, GIF · tối đa 20 MB' : 'MP3, WAV, OGG, M4A · tối đa 20 MB'}
        </div>
      )}
    </div>
  );
}
