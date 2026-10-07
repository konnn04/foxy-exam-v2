/**
 * Anti-Cheat & Telemetry Numerical Constants
 * Eliminates magic numbers across server and client apps
 */

import { MonitoringConfig } from '../types/models';

export const MONITORING_LIMITS = {
  DEFAULT_MAX_PASTE_CHARS: 80,
  MAX_ALLOWED_PASTE_CHARS: 500,
  MIN_EXAM_DURATION_MINUTES: 15,
  MAX_EXAM_DURATION_MINUTES: 360,
  DEFAULT_EXAM_DURATION_MINUTES: 90,
  DEFAULT_TIME_LIMIT_MS: 1000,
  DEFAULT_MEMORY_LIMIT_MB: 256,
  TELEMETRY_HEARTBEAT_INTERVAL_MS: 3000,
  OP_LOG_BATCH_SIZE: 50,
} as const;

export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  prevent_tab_switch: true,
  prevent_paste: true,
  max_paste_chars: MONITORING_LIMITS.DEFAULT_MAX_PASTE_CHARS,
  ai_face_check: true,
  track_keystroke_dynamics: true,
};
