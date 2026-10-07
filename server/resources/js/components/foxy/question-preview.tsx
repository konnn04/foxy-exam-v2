import { MarkdownPreview } from './markdown';
import React from 'react';
import { Hand, Mic, Paperclip } from 'lucide-react';
import { FxInput, FxTextarea } from './ui';
import { blankNumbers, type Draft } from './question-draft';
import { cn } from '@/lib/utils';

/** How a candidate sees the question in FoxyClient (no answer key). */
export function QuestionPreview({ draft }: { draft: Draft }) {
  const k = draft.kind;
  const multi = draft.answers.filter((a) => a.is_correct).length > 1;

  const text =
    k === 'FILL'
      ? draft.content.split(/(\[\d+\])/).filter(Boolean).map((t, i) =>
          /^\[\d+\]$/.test(t) ? (
            <span key={i} className="mx-1 inline-flex h-[26px] min-w-16 items-center rounded-md border border-dashed border-primary/70 bg-primary/8 px-2.5 font-mono text-xs font-semibold text-brand-fg">
              Ô {t.slice(1, -1)}
            </span>
          ) : (
            <span key={i} className="whitespace-pre-wrap">
              {t}
            </span>
          ),
        )
      : <MarkdownPreview source={draft.content} />;

  return (
    <div className="flex flex-col gap-4">
      {k === 'GROUP_QUESTION' && (
        <div className="flex flex-col gap-3 rounded-[10px] border border-border bg-surface p-3.5">
          {draft.group.media === 'text' && <div className="whitespace-pre-wrap text-sm leading-[1.75]">{draft.group.passage || 'Đoạn văn đọc hiểu…'}</div>}
          {draft.group.media === 'audio' && (
            <>
              {draft.group.audio_url ? <audio src={draft.group.audio_url} controls controlsList={draft.group.allow_seek ? undefined : 'nodownload noplaybackrate'} className="w-full" /> : <div className="text-xs text-muted-foreground">Chưa có tệp âm thanh.</div>}
              <div className="text-xs text-muted-foreground">
                {draft.group.listen_limit ? `Được nghe tối đa ${draft.group.listen_limit} lần` : 'Nghe không giới hạn'} · {draft.group.allow_seek ? 'cho tua' : 'không cho tua'}
              </div>
              {draft.group.passage && <div className="whitespace-pre-wrap text-sm">{draft.group.passage}</div>}
            </>
          )}
          {draft.group.media === 'image' && (draft.group.image_url ? <img src={draft.group.image_url} alt="" className="max-h-72 w-fit rounded-lg" /> : <div className="text-xs text-muted-foreground">Chưa có hình ảnh.</div>)}
        </div>
      )}

      <div className="text-base leading-[1.7]">{text}</div>
      {draft.image && k !== 'GROUP_QUESTION' && <img src={draft.image} alt="" className="max-h-64 w-fit rounded-lg border border-border" />}

      {k === 'CHOICE' &&
        draft.answers.map((a, i) => (
          <div key={i} className="flex items-center gap-3 rounded-[10px] border border-border px-3.5 py-3">
            <span className={cn('flex size-6 items-center justify-center border-2 border-foreground/30 text-xs font-semibold', multi ? 'rounded-md' : 'rounded-full')}>{String.fromCharCode(65 + i)}</span>
            <MarkdownPreview source={a.content} className="[&_p]:my-0" />
          </div>
        ))}
      {k === 'TRUE_FALSE' && (
        <div className="grid grid-cols-2 gap-2.5">
          {['Đúng', 'Sai'].map((t) => (
            <div key={t} className="flex h-12 items-center justify-center rounded-[10px] border border-border font-semibold">
              {t}
            </div>
          ))}
        </div>
      )}
      {k === 'FILL' && blankNumbers(draft.content).length === 0 && <div className="text-xs text-muted-foreground">Chưa có ô trống nào.</div>}
      {k === 'SHORT_ANSWER' && <FxInput disabled placeholder="Câu trả lời của thí sinh (tối đa 300 ký tự)…" />}
      {k === 'ESSAY' && draft.essay.mode === 'write' && (
        <>
          <FxTextarea disabled rows={5} placeholder="Bài viết của thí sinh…" />
          {(draft.essay.min_words > 0 || draft.essay.max_words > 0) && (
            <div className="text-xs text-muted-foreground">
              {draft.essay.min_words ? `Tối thiểu ${draft.essay.min_words} từ` : ''}
              {draft.essay.min_words && draft.essay.max_words ? ' · ' : ''}
              {draft.essay.max_words ? `Tối đa ${draft.essay.max_words} từ` : ''}
            </div>
          )}
        </>
      )}
      {k === 'ESSAY' && draft.essay.mode === 'audio' && (
        <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-border px-3.5 py-3 text-sm">
          <Mic className="size-4" /> Chuẩn bị {draft.essay.prep_seconds} giây, ghi âm tối đa {draft.essay.max_seconds} giây
        </div>
      )}
      {k === 'ESSAY' && draft.essay.mode === 'file' && (
        <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-border px-3.5 py-3 text-sm">
          <Paperclip className="size-4" /> Tải tối đa {draft.essay.max_files} tệp ({draft.essay.accept})
        </div>
      )}
      {k === 'ESSAY' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Hand className="size-3.5" /> Chấm tay
        </div>
      )}
    </div>
  );
}
