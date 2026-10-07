// Package worker drains the event stream in bulk.
//
// Instead of one database write per client event, it reads up to N events (or whatever arrived in the
// last second), archives raw telemetry to object storage and hands ONE compact, idempotent batch to the
// Laravel core. A crash or an outage never loses data: a message leaves the stream only after the batch
// that contains it was accepted; messages that keep failing move to a dead-letter stream.
package worker

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sort"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/foxyexam/realtime/internal/events"
	"github.com/foxyexam/realtime/internal/obs"
	"github.com/foxyexam/realtime/internal/store"
)

// Sink receives a batch. ErrPermanent marks a batch Laravel will never accept (validation failure).
type Sink interface {
	Deliver(ctx context.Context, b Batch) error
}

// Archiver stores raw telemetry chunks (MinIO / S3). May be nil.
type Archiver interface {
	Put(ctx context.Context, key string, gz []byte) error
}

type PermanentError struct{ Msg string }

func (e PermanentError) Error() string { return "permanent: " + e.Msg }

// ---------------------------------------------------------------- payload sent to Laravel

type Batch struct {
	BatchID    string      `json:"batch_id"`
	SentAt     int64       `json:"sent_at"`
	Violations []Violation `json:"violations,omitempty"`
	OpLogs     []OpLog     `json:"oplogs,omitempty"`
	Heartbeats []Heartbeat `json:"heartbeats,omitempty"`
}

type Violation struct {
	ClientEventID string         `json:"client_event_id"`
	AttemptID     int64          `json:"attempt_id"`
	Type          string         `json:"violation_type"`
	Severity      string         `json:"severity"`
	Details       map[string]any `json:"details,omitempty"`
	EvidenceID    string         `json:"evidence_id,omitempty"`
	OccurredAt    int64          `json:"occurred_at"`
}

type OpLog struct {
	ClientEventID string         `json:"client_event_id"`
	AttemptID     int64          `json:"attempt_id"`
	ProblemID     *int64         `json:"programming_problem_id,omitempty"`
	BatchSeq      int            `json:"batch_seq"`
	Keystrokes    int            `json:"keystroke_count"`
	Pastes        int            `json:"paste_event_count"`
	Flags         map[string]any `json:"synthetic_flags,omitempty"`
	PayloadRef    string         `json:"payload_ref,omitempty"` // object-storage key of the raw keystroke stream
	OccurredAt    int64          `json:"occurred_at"`
}

type Heartbeat struct {
	AttemptID  int64 `json:"attempt_id"`
	LastSeenAt int64 `json:"last_seen_at"`
}

// ---------------------------------------------------------------- worker

type Config struct {
	Consumer       string
	BatchSize      int64
	Block          time.Duration
	MaxFailures    int           // in-process delivery failures before a message goes to the DLQ
	ReclaimEvery   time.Duration // look for messages abandoned by dead consumers
	ReclaimMinIdle time.Duration
	HeartbeatSync  time.Duration // a heartbeat per attempt reaches the database at most this often
	Backoff        time.Duration
	Now            func() time.Time
}

func (c *Config) defaults() {
	if c.Consumer == "" {
		c.Consumer = "worker-1"
	}
	if c.BatchSize == 0 {
		c.BatchSize = 500
	}
	if c.Block == 0 {
		c.Block = time.Second
	}
	if c.MaxFailures == 0 {
		c.MaxFailures = 5
	}
	if c.ReclaimEvery == 0 {
		c.ReclaimEvery = 15 * time.Second
	}
	if c.ReclaimMinIdle == 0 {
		c.ReclaimMinIdle = 30 * time.Second
	}
	if c.HeartbeatSync == 0 {
		c.HeartbeatSync = 15 * time.Second
	}
	if c.Backoff == 0 {
		c.Backoff = 2 * time.Second
	}
	if c.Now == nil {
		c.Now = time.Now
	}
}

type Worker struct {
	cfg  Config
	st   *store.Store
	sink Sink
	arch Archiver
	log  *slog.Logger
	m    *obs.Metrics

	hbSent   map[int64]time.Time
	failures map[string]int
}

func New(cfg Config, st *store.Store, sink Sink, arch Archiver, log *slog.Logger, m *obs.Metrics) *Worker {
	cfg.defaults()
	return &Worker{cfg: cfg, st: st, sink: sink, arch: arch, log: log, m: m, hbSent: map[int64]time.Time{}, failures: map[string]int{}}
}

// Run loops until ctx ends.
func (w *Worker) Run(ctx context.Context) error {
	if err := w.st.EnsureGroup(ctx); err != nil {
		return err
	}
	lastReclaim := time.Time{}
	for ctx.Err() == nil {
		// 1. my own un-acked messages (a failed delivery, or a restart), 2. abandoned by others, 3. new
		n, err := w.Once(ctx, "0")
		if err == nil && w.cfg.Now().Sub(lastReclaim) > w.cfg.ReclaimEvery {
			lastReclaim = w.cfg.Now()
			err = w.reclaim(ctx)
		}
		if err == nil {
			var m int
			m, err = w.Once(ctx, ">")
			n += m
		}
		if err != nil && ctx.Err() == nil {
			w.log.Warn("worker round failed", "err", err)
			w.m.Inc("worker_failures_total")
			select {
			case <-ctx.Done():
			case <-time.After(w.cfg.Backoff):
			}
			continue
		}
		w.m.Set("worker_last_round_events", int64(n))
	}
	return nil
}

func (w *Worker) reclaim(ctx context.Context) error {
	msgs, _, err := w.st.R.XAutoClaim(ctx, &redis.XAutoClaimArgs{
		Stream: store.StreamEvents, Group: store.Group, Consumer: w.cfg.Consumer,
		MinIdle: w.cfg.ReclaimMinIdle, Start: "0-0", Count: w.cfg.BatchSize,
	}).Result()
	if err != nil && err != redis.Nil {
		return err
	}
	if len(msgs) > 0 {
		w.m.Add("worker_reclaimed_total", int64(len(msgs)))
	}
	return nil // claimed messages are now in our PEL; Once("0") delivers them next round
}

// Once reads one batch. start is ">" for new messages or "0" for this consumer's pending ones.
// It returns how many events were delivered (and acknowledged).
func (w *Worker) Once(ctx context.Context, start string) (int, error) {
	block := w.cfg.Block
	if start == "0" {
		block = -1 // never block on the pending list
	}
	res, err := w.st.R.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group: store.Group, Consumer: w.cfg.Consumer, Streams: []string{store.StreamEvents, start},
		Count: w.cfg.BatchSize, Block: block,
	}).Result()
	if err == redis.Nil || (err == nil && (len(res) == 0 || len(res[0].Messages) == 0)) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	msgs := res[0].Messages
	stored := make([]events.Stored, len(msgs))
	for i, m := range msgs {
		stored[i] = store.Decode(m)
	}

	batch := w.build(ctx, stored)
	w.m.Inc("worker_batches_total")
	err = w.deliver(ctx, batch)
	ids := make([]string, len(msgs))
	for i, m := range msgs {
		ids[i] = m.ID
	}

	switch e := err.(type) {
	case nil:
		for _, id := range ids {
			delete(w.failures, id)
		}
		if err := w.ack(ctx, ids...); err != nil {
			return 0, err
		}
		w.m.Add("worker_events_total", int64(len(msgs)))
		return len(msgs), nil
	case PermanentError:
		// Laravel will never accept this batch: park it instead of blocking the pipeline
		w.log.Error("batch rejected permanently, moving to DLQ", "err", e.Error(), "events", len(msgs))
		if err := w.deadLetter(ctx, msgs, e.Msg); err != nil {
			return 0, err
		}
		return 0, nil
	default:
		var poisoned []redis.XMessage
		for _, m := range msgs {
			w.failures[m.ID]++
			if w.failures[m.ID] >= w.cfg.MaxFailures {
				poisoned = append(poisoned, m)
			}
		}
		if len(poisoned) > 0 {
			if derr := w.deadLetter(ctx, poisoned, "max failures: "+err.Error()); derr != nil {
				return 0, derr
			}
		}
		return 0, err
	}
}

func (w *Worker) ack(ctx context.Context, ids ...string) error {
	pipe := w.st.R.Pipeline()
	pipe.XAck(ctx, store.StreamEvents, store.Group, ids...)
	pipe.XDel(ctx, store.StreamEvents, ids...)
	_, err := pipe.Exec(ctx)
	return err
}

func (w *Worker) deadLetter(ctx context.Context, msgs []redis.XMessage, reason string) error {
	pipe := w.st.R.Pipeline()
	ids := make([]string, len(msgs))
	for i, m := range msgs {
		vals := map[string]any{"reason": reason, "orig_id": m.ID}
		for k, v := range m.Values {
			vals[k] = v
		}
		pipe.XAdd(ctx, &redis.XAddArgs{Stream: store.StreamDLQ, MaxLen: 100000, Approx: true, Values: vals})
		ids[i] = m.ID
		delete(w.failures, m.ID)
	}
	pipe.XAck(ctx, store.StreamEvents, store.Group, ids...)
	pipe.XDel(ctx, store.StreamEvents, ids...)
	if _, err := pipe.Exec(ctx); err != nil {
		return err
	}
	w.m.Add("worker_dead_lettered_total", int64(len(msgs)))
	return nil
}

func (w *Worker) deliver(ctx context.Context, b Batch) error {
	if len(b.Violations) == 0 && len(b.OpLogs) == 0 && len(b.Heartbeats) == 0 {
		return nil // nothing the core cares about (e.g. only cmd_ack / log events)
	}
	dctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	return w.sink.Deliver(dctx, b)
}

// build condenses the raw events into the batch the core stores.
func (w *Worker) build(ctx context.Context, evs []events.Stored) Batch {
	now := w.cfg.Now()
	b := Batch{BatchID: fmt.Sprintf("%s-%d", w.cfg.Consumer, now.UnixNano()), SentAt: now.UnixMilli()}

	type chunkKey struct{ eid, aid int64 }
	chunks := map[chunkKey][]events.Stored{}
	lastHB := map[int64]int64{}

	for _, e := range evs {
		cid := strconv.FormatInt(e.AttemptID, 10) + ":" + strconv.FormatInt(e.Seq, 10)
		switch e.Type {
		case events.TypeViolation:
			var v events.Violation
			if json.Unmarshal(e.Data, &v) != nil {
				continue
			}
			b.Violations = append(b.Violations, Violation{ClientEventID: cid, AttemptID: e.AttemptID, Type: v.ViolationType, Severity: v.Severity, Details: v.Details, EvidenceID: v.EvidenceID, OccurredAt: e.TS})
		case events.TypeOpLog:
			var o events.OpLog
			if json.Unmarshal(e.Data, &o) != nil {
				continue
			}
			b.OpLogs = append(b.OpLogs, OpLog{ClientEventID: cid, AttemptID: e.AttemptID, ProblemID: o.ProblemID, BatchSeq: o.BatchSeq, Keystrokes: o.KeystrokeCount, Pastes: o.PasteCount, Flags: o.Flags, OccurredAt: e.TS})
			if o.Payload != "" {
				chunks[chunkKey{e.ExamID, e.AttemptID}] = append(chunks[chunkKey{e.ExamID, e.AttemptID}], e)
			}
		case events.TypeLog:
			chunks[chunkKey{e.ExamID, e.AttemptID}] = append(chunks[chunkKey{e.ExamID, e.AttemptID}], e)
		case events.TypeHeartbeat:
			if e.IngestMS > lastHB[e.AttemptID] {
				lastHB[e.AttemptID] = e.IngestMS
			}
		}
	}

	// raw keystroke streams / client logs go to object storage, one compressed chunk per attempt per round
	refs := map[int64]string{}
	if w.arch != nil {
		for k, list := range chunks {
			key, err := w.archive(ctx, k.eid, k.aid, list)
			if err != nil {
				w.log.Warn("archive failed; raw payload dropped for this chunk", "attempt", k.aid, "err", err)
				w.m.Inc("worker_archive_failures_total")
				continue
			}
			refs[k.aid] = key
		}
		for i := range b.OpLogs {
			b.OpLogs[i].PayloadRef = refs[b.OpLogs[i].AttemptID]
		}
	}

	// heartbeats reach the database at most every HeartbeatSync per attempt (presence itself is live in Redis)
	ids := make([]int64, 0, len(lastHB))
	for aid := range lastHB {
		ids = append(ids, aid)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	for _, aid := range ids {
		if t, ok := w.hbSent[aid]; ok && now.Sub(t) < w.cfg.HeartbeatSync {
			continue
		}
		w.hbSent[aid] = now
		b.Heartbeats = append(b.Heartbeats, Heartbeat{AttemptID: aid, LastSeenAt: lastHB[aid]})
	}
	if len(w.hbSent) > 50000 { // bounded memory
		for aid, t := range w.hbSent {
			if now.Sub(t) > time.Hour {
				delete(w.hbSent, aid)
			}
		}
	}
	return b
}

func (w *Worker) archive(ctx context.Context, eid, aid int64, list []events.Stored) (string, error) {
	var buf bytes.Buffer
	zw := gzip.NewWriter(&buf)
	enc := json.NewEncoder(zw)
	for _, e := range list {
		_ = enc.Encode(map[string]any{"seq": e.Seq, "t": e.Type, "ts": e.TS, "data": json.RawMessage(e.Data)})
	}
	if err := zw.Close(); err != nil {
		return "", err
	}
	key := fmt.Sprintf("telemetry/%d/%d/%d-%d.jsonl.gz", eid, aid, list[0].Seq, list[len(list)-1].Seq)
	if err := w.arch.Put(ctx, key, buf.Bytes()); err != nil {
		return "", err
	}
	return key, nil
}
