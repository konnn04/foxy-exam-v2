import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { FxInput } from '@/components/foxy/ui';
import { DATETIME_FORMAT, DATE_FORMAT, formatDate, formatDateTime, parseDate, parseDateTime } from '@/lib/datetime';

/** Keeps the digits and re-inserts the separators of dd/MM/yyyy HH:mm while typing. */
function mask(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 12);
  let out = d.slice(0, 2);
  if (d.length > 2) out += '/' + d.slice(2, 4);
  if (d.length > 4) out += '/' + d.slice(4, 8);
  if (d.length > 8) out += ' ' + d.slice(8, 10);
  if (d.length > 10) out += ':' + d.slice(10, 12);
  return out;
}

export function DateTimeInput({ value, onChange }: { value: string | null; onChange: (iso: string | null) => void }) {
  const [text, setText] = useState(value ? formatDateTime(value) : '');
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value && parseDateTime(text) !== value) setText(formatDateTime(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const type = (raw: string) => {
    const next = mask(raw);
    setText(next);
    if (next === '') onChange(null);
    else if (next.length === DATETIME_FORMAT.length) {
      const iso = parseDateTime(next);
      if (iso) onChange(iso);
    }
  };
  const invalid = text.length > 0 && !parseDateTime(text);

  return (
    <div className="relative">
      <FxInput mono inputMode="numeric" placeholder="dd/mm/yyyy hh:mm" value={text} onChange={(e) => type(e.target.value)} aria-invalid={invalid} />
      <button
        type="button"
        title="Chọn ngày giờ"
        onClick={() => picker.current?.showPicker?.()}
        className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
      >
        <CalendarDays className="size-4" />
      </button>
      <input
        ref={picker}
        type="datetime-local"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute right-0 top-full size-0 opacity-0"
        value={value ? format(new Date(value), "yyyy-MM-dd'T'HH:mm") : ''}
        onChange={(e) => {
          if (!e.target.value) return;
          const d = new Date(e.target.value);
          if (!Number.isNaN(d.getTime())) {
            setText(formatDateTime(d));
            onChange(d.toISOString());
          }
        }}
      />
    </div>
  );
}

/** dd/MM/yyyy field. The value is a plain yyyy-MM-dd date string (what the server stores). */
export function DateInput({ value, onChange }: { value: string | null; onChange: (ymd: string) => void }) {
  const [text, setText] = useState(value ? formatDate(value) : '');

  useEffect(() => {
    if (value && parseDate(text) !== value) setText(formatDate(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const type = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 8);
    let next = d.slice(0, 2);
    if (d.length > 2) next += '/' + d.slice(2, 4);
    if (d.length > 4) next += '/' + d.slice(4, 8);
    setText(next);
    if (next === '') onChange('');
    else if (next.length === DATE_FORMAT.length) {
      const ymd = parseDate(next);
      if (ymd) onChange(ymd);
    }
  };

  return <FxInput mono inputMode="numeric" placeholder="dd/mm/yyyy" value={text} onChange={(e) => type(e.target.value)} aria-invalid={text.length > 0 && !parseDate(text)} />;
}
