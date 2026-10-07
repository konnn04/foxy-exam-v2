import { format, isValid } from "date-fns";

export const DATE_FORMAT = "dd/MM/yyyy";
export const DATETIME_FORMAT = "dd/MM/yyyy HH:mm";

type DateLike = string | number | Date | null | undefined;

const toDate = (v: DateLike): Date | null => {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return isValid(d) ? d : null;
};

const fmt = (v: DateLike, pattern: string) => {
  const d = toDate(v);
  return d ? format(d, pattern) : "—";
};

export const formatDate = (v: DateLike) => fmt(v, DATE_FORMAT);
export const formatDateTime = (v: DateLike) => fmt(v, DATETIME_FORMAT);
export const formatTime = (v: DateLike, seconds = false) => fmt(v, seconds ? "HH:mm:ss" : "HH:mm");
