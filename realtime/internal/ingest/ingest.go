// Package ingest is the front door for FoxyClient telemetry.
//
// Design goals: a 10k-candidate exam must not turn into 10k requests per event.
//   - the client batches (about once a second) and sends everything that happened in one request;
//   - a request costs one local JWT check and ONE pipelined Redis round-trip - no database;
//   - events are appended to a Redis stream; the worker drains it in bulk (see package worker);
//   - retries are idempotent (per-attempt seq), commands ride back on the response (no polling);
//   - under load the server stretches the client's flush interval instead of dropping data.
package ingest

import (
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"sort"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/foxyexam/realtime/internal/auth"
	"github.com/foxyexam/realtime/internal/events"
	"github.com/foxyexam/realtime/internal/obs"
	"github.com/foxyexam/realtime/internal/store"
)

type Config struct {
	JWTSecret      []byte
	InternalSecret []byte
	MaxBodyBytes   int64
	RatePerSec     float64       // sustained batches per second per attempt
	Burst          int           // short bursts (a reconnect flushes its backlog)
	FlushInterval  time.Duration // what the client should normally use
	ShedInflight   int           // in-flight requests above which clients are told to slow down
	Now            func() time.Time
}

func (c *Config) defaults() {
	if c.MaxBodyBytes == 0 {
		c.MaxBodyBytes = 1 << 20
	}
	if c.RatePerSec == 0 {
		c.RatePerSec = 5
	}
	if c.Burst == 0 {
		c.Burst = 20
	}
	if c.FlushInterval == 0 {
		c.FlushInterval = time.Second
	}
	if c.ShedInflight == 0 {
		c.ShedInflight = 2000
	}
	if c.Now == nil {
		c.Now = time.Now
	}
}

type Server struct {
	cfg      Config
	st       *store.Store
	log      *slog.Logger
	m        *obs.Metrics
	limits   *limiter
	inflight atomic.Int64
}

func New(cfg Config, st *store.Store, log *slog.Logger, m *obs.Metrics) *Server {
	cfg.defaults()
	return &Server{cfg: cfg, st: st, log: log, m: m, limits: newLimiter(cfg.RatePerSec, cfg.Burst)}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/batch", s.handleBatch)
	mux.HandleFunc("GET /v1/time", s.handleTime)
	mux.HandleFunc("POST /internal/v1/lifecycle", s.handleLifecycle)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := s.st.R.Ping(ctx).Err(); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "redis"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})
	mux.Handle("GET /metrics", s.m.Handler())
	return mux
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func (s *Server) handleTime(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"server_ts": s.cfg.Now().UnixMilli()})
}

type rejection struct {
	Seq    int64  `json:"seq"`
	Reason string `json:"reason"`
}

type batchResponse struct {
	OK          bool             `json:"ok"`
	AckSeq      int64            `json:"ack_seq"`
	Accepted    int              `json:"accepted"`
	Duplicates  int              `json:"duplicates"`
	Rejected    []rejection      `json:"rejected,omitempty"`
	ServerTS    int64            `json:"server_ts"`
	NextFlushMS int64            `json:"next_flush_ms"`
	Status      string           `json:"status,omitempty"`
	End         bool             `json:"end,omitempty"` // the attempt is over: the client must stop and show the result screen
	Commands    []events.Command `json:"commands,omitempty"`
}

func (s *Server) handleBatch(w http.ResponseWriter, r *http.Request) {
	s.m.Inc("ingest_requests_total")
	n := s.inflight.Add(1)
	defer s.inflight.Add(-1)
	s.m.Set("ingest_inflight", n)

	claims, err := auth.Verify(s.cfg.JWTSecret, auth.BearerToken(r.Header.Get("Authorization")), s.cfg.Now())
	if err != nil || claims.Role != auth.RoleCandidate || claims.AttemptID == 0 || claims.ExamID == 0 {
		s.m.Inc("ingest_unauthorized_total")
		writeJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": "invalid_token"})
		return
	}

	if ok, retry := s.limits.allow(claims.AttemptID, s.cfg.Now()); !ok {
		s.m.Inc("ingest_rate_limited_total")
		w.Header().Set("Retry-After", strconv.Itoa(int(retry.Seconds())+1))
		writeJSON(w, http.StatusTooManyRequests, map[string]any{"ok": false, "error": "rate_limited"})
		return
	}

	var body io.Reader = http.MaxBytesReader(w, r.Body, s.cfg.MaxBodyBytes)
	if r.Header.Get("Content-Encoding") == "gzip" {
		zr, err := gzip.NewReader(body)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "bad_gzip"})
			return
		}
		defer zr.Close()
		body = io.LimitReader(zr, s.cfg.MaxBodyBytes*4) // bound decompression too
	}
	var batch events.Batch
	if err := json.NewDecoder(body).Decode(&batch); err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]any{"ok": false, "error": "too_large"})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "bad_json"})
		return
	}
	if len(batch.Events) > events.MaxBatchEvents {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "too_many_events"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	resp, err := s.process(ctx, claims, batch)
	if err != nil {
		s.log.Error("ingest failed", "attempt", claims.AttemptID, "err", err)
		s.m.Inc("ingest_errors_total")
		// 503 tells the client to keep its buffer and retry the same batch (idempotent by seq)
		w.Header().Set("Retry-After", "2")
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "unavailable"})
		return
	}
	resp.NextFlushMS = s.nextFlush(n)
	writeJSON(w, http.StatusOK, resp)
}

// nextFlush stretches the client's interval when the instance is saturated.
func (s *Server) nextFlush(inflight int64) int64 {
	base := s.cfg.FlushInterval.Milliseconds()
	if inflight <= int64(s.cfg.ShedInflight) {
		return base
	}
	f := base * (1 + inflight/int64(s.cfg.ShedInflight))
	if f > 5000 {
		f = 5000
	}
	return f
}

func (s *Server) process(ctx context.Context, c auth.Claims, b events.Batch) (batchResponse, error) {
	now := s.cfg.Now()
	resp := batchResponse{OK: true, ServerTS: now.UnixMilli()}

	last, err := s.st.LastSeq(ctx, c.AttemptID)
	if err != nil {
		return resp, err
	}
	sort.SliceStable(b.Events, func(i, j int) bool { return b.Events[i].Seq < b.Events[j].Seq })

	p := store.AcceptParams{AttemptID: c.AttemptID, ExamID: c.ExamID, OrgID: c.OrgID, UserID: c.UserID, Now: now, Fields: map[string]any{}}
	prev := last
	for _, e := range b.Events {
		if e.Seq <= prev {
			resp.Duplicates++
			continue
		}
		if err := e.Validate(); err != nil {
			resp.Rejected = append(resp.Rejected, rejection{Seq: e.Seq, Reason: err.Error()})
			continue
		}
		prev = e.Seq
		p.Events = append(p.Events, e)
		s.fold(&p, e)
	}
	p.MaxSeq = max(last, prev)
	resp.AckSeq = p.MaxSeq
	resp.Accepted = len(p.Events)
	s.m.Add("ingest_events_total", int64(len(p.Events)))
	s.m.Add("ingest_duplicates_total", int64(resp.Duplicates))

	// A batch with nothing new (pure retry) still refreshes presence, so only skip the stream when empty.
	res, err := s.st.Accept(ctx, p)
	if err != nil {
		return resp, err
	}
	resp.Commands = res.Commands
	resp.Status = res.Status
	resp.End = res.Status == "ended" || res.Status == "force_ended"
	return resp, nil
}

// fold derives the live-state fields (what a proctor sees) from one event.
func (s *Server) fold(p *store.AcceptParams, e events.Event) {
	switch e.Type {
	case events.TypeHeartbeat:
		var h events.Heartbeat
		if len(e.Data) > 0 && json.Unmarshal(e.Data, &h) != nil {
			return
		}
		set := func(k string, b *bool) {
			if b != nil {
				if *b {
					p.Fields[k] = 1
				} else {
					p.Fields[k] = 0
				}
			}
		}
		set("f", h.Focus)
		set("fs", h.Fullscreen)
		set("cam", h.Camera)
		set("scr", h.Screen)
		if h.LatencyMS != nil {
			p.Fields["lat"] = *h.LatencyMS
		}
		if h.Question != nil {
			p.Fields["q"] = *h.Question
		}
	case events.TypeViolation:
		var v events.Violation
		if json.Unmarshal(e.Data, &v) == nil {
			p.ViolationsAdded++
			p.Violations = append(p.Violations, store.ViolationBrief{Type: v.ViolationType, Severity: v.Severity, TS: e.TS})
		}
	case events.TypeOpLog:
		p.Fields["ok"] = e.TS
	case events.TypeCmdAck:
		var a events.CmdAck
		if json.Unmarshal(e.Data, &a) == nil {
			p.AckedCommands = append(p.AckedCommands, a.ID)
			p.Fields["cmd"] = ""
		}
	}
}

// ---------------------------------------------------------------- lifecycle (Laravel -> ingest)

type lifecycleRequest struct {
	AttemptID int64  `json:"attempt_id"`
	ExamID    int64  `json:"exam_id"`
	UserID    int64  `json:"user_id"`
	Status    string `json:"status"` // active | paused | ended | force_ended
}

var lifecycleStatuses = map[string]bool{"active": true, "paused": true, "ended": true, "force_ended": true}

func (s *Server) handleLifecycle(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<16))
	if err != nil {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]any{"ok": false})
		return
	}
	if err := auth.VerifyBody(s.cfg.InternalSecret, body, r.Header.Get(auth.HeaderTimestamp), r.Header.Get(auth.HeaderSignature), s.cfg.Now(), 5*time.Minute); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": "bad_signature"})
		return
	}
	var req lifecycleRequest
	if json.Unmarshal(body, &req) != nil || req.AttemptID == 0 || req.ExamID == 0 || !lifecycleStatuses[req.Status] {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "bad_request"})
		return
	}
	if err := s.st.SetLifecycle(r.Context(), req.AttemptID, req.ExamID, req.UserID, req.Status, s.cfg.Now()); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// ---------------------------------------------------------------- per-attempt token bucket

type bucket struct {
	tokens float64
	at     time.Time
}

type limiter struct {
	mu     sync.Mutex
	rate   float64
	burst  float64
	b      map[int64]*bucket
	sweepN int
}

func newLimiter(rate float64, burst int) *limiter {
	return &limiter{rate: rate, burst: float64(burst), b: map[int64]*bucket{}}
}

func (l *limiter) allow(key int64, now time.Time) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	bk, ok := l.b[key]
	if !ok {
		bk = &bucket{tokens: l.burst, at: now}
		l.b[key] = bk
	}
	bk.tokens = min(l.burst, bk.tokens+now.Sub(bk.at).Seconds()*l.rate)
	bk.at = now
	if l.sweepN++; l.sweepN%5000 == 0 { // keep the map bounded without a goroutine
		for k, v := range l.b {
			if now.Sub(v.at) > 10*time.Minute {
				delete(l.b, k)
			}
		}
	}
	if bk.tokens < 1 {
		return false, time.Duration((1 - bk.tokens) / l.rate * float64(time.Second))
	}
	bk.tokens--
	return true, 0
}
