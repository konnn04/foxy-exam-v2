import { ApiError, saveQuestionAnswer } from "./api";

type Input = Parameters<typeof saveQuestionAnswer>[0];

/**
 * Answers go through a queue kept in localStorage: only the LATEST answer of each question matters, a lost connection
 * keeps it for later, and it is sent again when the network returns, on a timer, and before the paper is submitted.
 * A rejection by the server (the attempt ended, bad data) drops the item: retrying it would never succeed.
 */
const KEY = "foxyexam:answer-queue";
const RETRY_MS = 8000;

type Store = Record<string, Input>;
const listeners = new Set<() => void>();
let timer: number | undefined;
let flushing: Promise<boolean> | null = null;

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function write(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota: the in-flight attempt still goes out */
  }
  listeners.forEach((l) => l());
}

export const pendingAnswers = () => Object.keys(read()).length;

export function onQueueChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

const slot = (i: Input) => `${i.attemptId}:${i.questionId}`;

export function queueAnswer(input: Input): void {
  write({ ...read(), [slot(input)]: input });
  void flushAnswers();
}

export function clearAnswerQueue() {
  window.clearTimeout(timer);
  write({});
}

/** Sends everything that is waiting. Resolves true when nothing is left (false: still offline / server unreachable). */
export function flushAnswers(): Promise<boolean> {
  flushing ??= (async () => {
    try {
      for (const [k, input] of Object.entries(read())) {
        try {
          await saveQuestionAnswer(input);
        } catch (e) {
          if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) {
            const s = read();
            delete s[k];
            write(s);
            continue;
          }
          return false;
        }
        const s = read();
        // a newer answer to the same question may have been queued while this one was in flight
        if (JSON.stringify(s[k]) === JSON.stringify(input)) {
          delete s[k];
          write(s);
        }
      }
      return pendingAnswers() === 0;
    } finally {
      flushing = null;
      window.clearTimeout(timer);
      if (pendingAnswers() > 0) timer = window.setTimeout(() => void flushAnswers(), RETRY_MS);
    }
  })();
  return flushing;
}

if (typeof window !== "undefined") window.addEventListener("online", () => void flushAnswers());
