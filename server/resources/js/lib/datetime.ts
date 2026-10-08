import { format, isValid, parse } from 'date-fns';

export const DATE_FORMAT = 'dd/MM/yyyy';
export const TIME_FORMAT = 'HH:mm';
export const DATETIME_FORMAT = 'dd/MM/yyyy HH:mm';

type DateLike = string | number | Date | null | undefined;

const toDate = (v: DateLike): Date | null => {
  if (v === null || v === undefined || v === '') return null;
  // a plain calendar date (birthday) must not shift with the time zone
  const plain = typeof v === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  const d = v instanceof Date ? v : plain ? new Date(+plain[1], +plain[2] - 1, +plain[3]) : new Date(v);
  return isValid(d) ? d : null;
};

export const formatDate = (v: DateLike) => {
  const d = toDate(v);
  return d ? format(d, DATE_FORMAT) : '—';
};

export const formatDateTime = (v: DateLike) => {
  const d = toDate(v);
  return d ? format(d, DATETIME_FORMAT) : '—';
};

export const formatTime = (v: DateLike, withSeconds = false) => {
  const d = toDate(v);
  return d ? format(d, withSeconds ? 'HH:mm:ss' : TIME_FORMAT) : '—';
};

/** "dd/MM/yyyy HH:mm" typed by a person -> ISO string, or null when it is not a complete valid date. */
export const parseDateTime = (text: string): string | null => {
  const d = parse(text.trim(), DATETIME_FORMAT, new Date());
  return isValid(d) ? d.toISOString() : null;
};

/** "dd/MM/yyyy" typed by a person -> "yyyy-MM-dd", or null when it is not a valid date. */
export const parseDate = (text: string): string | null => {
  const d = parse(text.trim(), DATE_FORMAT, new Date());
  return isValid(d) ? format(d, 'yyyy-MM-dd') : null;
};
