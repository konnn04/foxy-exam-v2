#!/usr/bin/env bash
# Local end-to-end smoke test: real Laravel (artisan serve) + real ingest/hub/worker binaries + in-memory Redis.
# Windows (Git Bash) or Linux. Needs: go, php, python, curl. Run from the repo root:  bash realtime/scripts/smoke.sh
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export PATH="$PATH:/c/Program Files/Go/bin"
export RT_JWT_SECRET=smoke-jwt RT_INTERNAL_SECRET=smoke-internal AI_ENFORCE=false
export REDIS_URL=redis://127.0.0.1:6390/0
APP=http://127.0.0.1:8770
LOGS="${TMPDIR:-/tmp}"
PIDS=()
cleanup() { for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done; }
trap cleanup EXIT

cd "$ROOT/realtime"
go build -o bin/ ./cmd/... || exit 1
EXT=""; [ -f bin/ingest.exe ] && EXT=".exe"
bin/devredis$EXT 127.0.0.1:6390 >/dev/null 2>&1 & PIDS+=($!)
sleep 1
PORT=8781 bin/ingest$EXT >"$LOGS/smoke-ingest.log" 2>&1 & PIDS+=($!)
PORT=8782 bin/hub$EXT >"$LOGS/smoke-hub.log" 2>&1 & PIDS+=($!)
LARAVEL_BULK_URL=$APP/api/internal/v1/events/bulk PORT=8784 bin/worker$EXT >"$LOGS/smoke-worker.log" 2>&1 & PIDS+=($!)

cd "$ROOT/server"
RT_INGEST_URL=http://127.0.0.1:8781 RT_INGEST_INTERNAL_URL=http://127.0.0.1:8781 RT_HUB_URL=ws://127.0.0.1:8782 \
  php artisan serve --port=8770 >"$LOGS/smoke-app.log" 2>&1 & PIDS+=($!)
sleep 4

j() { python -c "import sys,json; d=json.load(sys.stdin); print(eval(sys.argv[1]))" "$1"; }
tink() { php artisan tinker --execute="$1" 2>/dev/null | tail -1; }
fail() { echo "SMOKE FAIL: $1"; for f in "$LOGS"/smoke-*.log; do echo "--- $f"; tail -n 5 "$f"; done; exit 1; }

# CLAS-2026 is a classical exam without face monitoring; any seeded exam works with AI_ENFORCE=false
LOGIN=$(curl -s -X POST $APP/api/v1/student/login -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -d '{"exam_code":"CLAS-2026","username":"student01","password":"student123"}')
TOKEN=$(echo "$LOGIN" | j "d['data']['token']") || fail "login: $LOGIN"
AID=$(echo "$LOGIN" | j "d['data']['attempt_id']")
echo "login ok, attempt $AID"

SESSION=$(curl -s -X POST $APP/api/v1/student/realtime/session -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json')
ITOKEN=$(echo "$SESSION" | j "d['data']['ingest']['token']") || fail "session: $SESSION"
echo "session ok (ingest token minted by PHP, verified by Go)"

NOW=$(python -c "import time;print(int(time.time()*1000))")
RESP=$(curl -s -X POST http://127.0.0.1:8781/v1/batch -H "Authorization: Bearer $ITOKEN" -H 'Content-Type: application/json' -d "{\"events\":[
 {\"seq\":1,\"t\":\"hb\",\"ts\":$NOW,\"data\":{\"focus\":true,\"fullscreen\":true,\"camera\":true,\"latency_ms\":30}},
 {\"seq\":2,\"t\":\"violation\",\"ts\":$NOW,\"data\":{\"violation_type\":\"TAB_SWITCH\",\"severity\":\"HIGH\",\"details\":{\"smoke\":true}}},
 {\"seq\":3,\"t\":\"oplog\",\"ts\":$NOW,\"data\":{\"batch_seq\":1,\"keystroke_count\":10,\"paste_event_count\":1,\"synthetic_flags\":{\"bulk_insert\":true,\"chars_count\":300}}}]}")
echo "ingest: $RESP"
[ "$(echo "$RESP" | j "d['accepted']")" = "3" ] || fail "ingest did not accept 3 events"

EID=$(tink '$a = \App\Models\ExamAttempt::find('"$AID"'); echo $a->exam_id;')
PTOKEN=$(tink 'echo app(\App\Services\Realtime::class)->proctorToken(\App\Models\User::first(), 1, ['"$EID"'], 600);')
sleep 1
SNAP=$(curl -s http://127.0.0.1:8782/v1/rooms/$EID/snapshot -H "Authorization: Bearer $PTOKEN")
echo "hub snapshot: $SNAP"
[ "$(echo "$SNAP" | j "d['rows'][0]['status']")" = "online" ] || fail "hub does not show the candidate online"

for i in 1 2 3 4 5 6 7 8; do
  V=$(tink 'echo \App\Models\Violation::where("exam_attempt_id",'"$AID"')->count();')
  [ "${V:-0}" -ge 2 ] 2>/dev/null && break
  sleep 1
done
echo "violations in the core DB: ${V:-0} (TAB_SWITCH + BULK_PASTE expected)"
[ "${V:-0}" -ge 2 ] 2>/dev/null || fail "worker did not deliver to Laravel"

# a proctor ends the attempt: the client learns it with its next batch
# the real client library against the same stack (batching, seq, gzip, session refresh)
if [ -d "$ROOT/client/node_modules" ]; then
  cd "$ROOT/client"
  OUT=$(VITE_API_BASE_URL=$APP/api/v1 npx --yes vite-node scripts/realtime-e2e.ts 2>&1 | tail -3)
  echo "client: $OUT"
  echo "$OUT" | grep -q '"ok":true' || fail "client RealtimeClient e2e"
  sleep 3
  CV=$(cd "$ROOT/server" && tink 'echo app("db")->table("edit_op_logs")->where("keystroke_count",42)->count();')
  echo "client oplogs delivered to the core: ${CV:-0}"
  [ "${CV:-0}" -ge 1 ] 2>/dev/null || fail "client events did not reach the core"
fi
echo "SMOKE OK"
