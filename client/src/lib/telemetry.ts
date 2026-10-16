import * as Sentry from "@sentry/browser";
import { getAuth } from "./authStore";

/**
 * Error reporting. Off unless VITE_SENTRY_DSN is set at build time. Nothing personal is sent: no request bodies, no
 * default PII; the only identity attached is the numeric user id.
 */
export function initTelemetry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    release: `foxyclient@${import.meta.env.VITE_APP_VERSION ?? "dev"}`,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
    beforeSend(event) {
      const id = getAuth()?.user?.id;
      if (id) event.user = { id: String(id) };
      if (event.request) delete event.request.data;
      return event;
    },
  });
}

export function reportError(e: unknown, context?: Record<string, unknown>) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.captureException(e, { extra: context });
}
