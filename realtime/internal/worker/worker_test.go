package worker

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"github.com/foxyexam/realtime/internal/events"
	"github.com/foxyexam/realtime/internal/obs"
	"github.com/foxyexam/realtime/internal/store"
)

type fakeSink struct {
	mu      sync.Mutex
	batches []Batch
	err     error
}

func (f *fakeSink) Deliver(_ context.Context, b Batch) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return f.err
	}
	f.batches = append(f.batches, b)
	return nil
}

func (f *fakeSink) all() (v []Violation, o []OpLog, h []Heartbeat) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, b := range f.batches {
		v = append(v, b.Violations...)
		o = append(o, b.OpLogs...)
		h = append(h, b.Heartbeats...)
	}
	return
}

type fakeArchive struct {
	mu   sync.Mutex
	keys []string
}

func (f *fakeArchive) Put(_ context.Context, key string, gz []byte) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(gz) == 0 {
		return errors.New("empty")
	}
	f.keys = append(f.keys, key)
	return nil
}

func setup(t *testing.T, sink Sink, arch Archiver, mod func(*Config)) (*Worker, *store.Store) {
	t.Helper()
	mr := miniredis.RunT(t)
	st := store.New(redis.NewClient(&redis.Options{Addr: mr.Addr()}))
	if err := st.EnsureGroup(context.Background()); err != nil {
		t.Fatal(err)
	}
	cfg := Config{Block: 10 * time.Millisecond, Backoff: time.Millisecond}
	if mod != nil {
		mod(&cfg)
	}
	return New(cfg, st, sink, arch, obs.Logger("test"), obs.NewMetrics()), st
}

func feed(t *testing.T, st *store.Store, aid int64, evs ...events.Event) {
	t.Helper()
	var maxSeq int64
	for _, e := range evs {
		maxSeq = max(maxSeq, e.Seq)
	}
	if _, err := st.Accept(context.Background(), store.AcceptParams{AttemptID: aid, ExamID: 2, OrgID: 1, UserID: 9, Events: evs, MaxSeq: maxSeq, Now: time.Now()}); err != nil {
		t.Fatal(err)
	}
}

func e(seq int64, typ string, data any) events.Event {
	d, _ := json.Marshal(data)
	return events.Event{Seq: seq, Type: typ, TS: 1000 + seq, Data: d}
}

func pending(t *testing.T, st *store.Store) int64 {
	t.Helper()
	p, err := st.R.XPending(context.Background(), store.StreamEvents, store.Group).Result()
	if err != nil {
		t.Fatal(err)
	}
	return p.Count
}

func TestEventsAreCondensedIntoOneBatchAndAcknowledged(t *testing.T) {
	sink, arch := &fakeSink{}, &fakeArchive{}
	w, st := setup(t, sink, arch, nil)

	var evs []events.Event
	for i := int64(1); i <= 100; i++ { // 100 heartbeats of one candidate...
		evs = append(evs, e(i, "hb", map[string]any{"focus": true}))
	}
	evs = append(evs,
		e(101, "violation", map[string]any{"violation_type": "TAB_SWITCH", "severity": "MEDIUM", "details": map[string]any{"x": 1}}),
		e(102, "oplog", map[string]any{"batch_seq": 1, "keystroke_count": 40, "paste_event_count": 1, "synthetic_flags": map[string]any{"bulk_insert": true}, "raw_ops_payload": "[[1,2],[3,4]]"}),
		e(103, "log", map[string]any{"msg": "cam restarted"}),
		e(104, "cmd_ack", map[string]any{"id": "c1"}),
	)
	feed(t, st, 5, evs...)

	n, err := w.Once(context.Background(), ">")
	if err != nil || n != 104 {
		t.Fatalf("n=%d err=%v", n, err)
	}
	if len(sink.batches) != 1 {
		t.Fatalf("104 events must reach the core as ONE request, got %d", len(sink.batches))
	}
	v, o, h := sink.all()
	if len(v) != 1 || v[0].ClientEventID != "5:101" || v[0].Type != "TAB_SWITCH" {
		t.Fatalf("violation: %+v", v)
	}
	if len(o) != 1 || o[0].Pastes != 1 || o[0].PayloadRef == "" || o[0].ClientEventID != "5:102" {
		t.Fatalf("oplog: %+v", o)
	}
	if len(h) != 1 || h[0].AttemptID != 5 {
		t.Fatalf("100 heartbeats must collapse to one row: %+v", h)
	}
	if len(arch.keys) != 1 {
		t.Fatalf("raw telemetry must be archived once: %v", arch.keys)
	}
	if pending(t, st) != 0 {
		t.Fatal("delivered events must be acknowledged")
	}
	if l, _ := st.R.XLen(context.Background(), store.StreamEvents).Result(); l != 0 {
		t.Fatalf("delivered events must leave the stream, %d left", l)
	}
}

func TestOutageDoesNotLoseEventsAndRecoveryDoesNotDuplicate(t *testing.T) {
	sink := &fakeSink{err: errors.New("core is down")}
	w, st := setup(t, sink, nil, func(c *Config) { c.MaxFailures = 100 })
	feed(t, st, 5, e(1, "violation", map[string]any{"violation_type": "BULK_PASTE", "severity": "HIGH"}))

	if _, err := w.Once(context.Background(), ">"); err == nil {
		t.Fatal("expected the delivery error")
	}
	if pending(t, st) != 1 {
		t.Fatal("an undelivered event must stay pending")
	}
	if len(sink.batches) != 0 {
		t.Fatal("nothing should have been delivered yet")
	}

	sink.err = nil // the core is back
	n, err := w.Once(context.Background(), "0")
	if err != nil || n != 1 {
		t.Fatalf("redelivery: n=%d err=%v", n, err)
	}
	if v, _, _ := sink.all(); len(v) != 1 {
		t.Fatalf("exactly one delivery expected, got %d", len(v))
	}
	if pending(t, st) != 0 {
		t.Fatal("must be acked after recovery")
	}
}

func TestPermanentRejectionGoesToTheDeadLetterStream(t *testing.T) {
	sink := &fakeSink{err: PermanentError{Msg: "422 bad payload"}}
	w, st := setup(t, sink, nil, nil)
	feed(t, st, 5, e(1, "violation", map[string]any{"violation_type": "BULK_PASTE", "severity": "HIGH"}))

	if _, err := w.Once(context.Background(), ">"); err != nil {
		t.Fatal(err)
	}
	if l, _ := st.R.XLen(context.Background(), store.StreamDLQ).Result(); l != 1 {
		t.Fatalf("DLQ has %d, want 1", l)
	}
	if pending(t, st) != 0 {
		t.Fatal("a parked event must not block the pipeline")
	}
}

func TestRepeatedFailuresEventuallyParkTheMessage(t *testing.T) {
	sink := &fakeSink{err: errors.New("boom")}
	w, st := setup(t, sink, nil, func(c *Config) { c.MaxFailures = 3 })
	feed(t, st, 5, e(1, "violation", map[string]any{"violation_type": "BULK_PASTE", "severity": "HIGH"}))

	w.Once(context.Background(), ">")
	w.Once(context.Background(), "0")
	w.Once(context.Background(), "0")
	if l, _ := st.R.XLen(context.Background(), store.StreamDLQ).Result(); l != 1 {
		t.Fatalf("after 3 failures the message must be parked, DLQ=%d", l)
	}
	if pending(t, st) != 0 {
		t.Fatal("parked message must be acked")
	}
}

func TestHeartbeatsReachTheCoreAtMostEveryInterval(t *testing.T) {
	sink := &fakeSink{}
	now := time.Now()
	w, st := setup(t, sink, nil, func(c *Config) { c.HeartbeatSync = 15 * time.Second; c.Now = func() time.Time { return now } })

	feed(t, st, 5, e(1, "hb", map[string]any{}))
	w.Once(context.Background(), ">")
	feed(t, st, 5, e(2, "hb", map[string]any{}))
	w.Once(context.Background(), ">")
	if _, _, h := sink.all(); len(h) != 1 {
		t.Fatalf("second heartbeat within 15s must not be sent, got %d", len(h))
	}
	now = now.Add(20 * time.Second)
	feed(t, st, 5, e(3, "hb", map[string]any{}))
	w.Once(context.Background(), ">")
	if _, _, h := sink.all(); len(h) != 2 {
		t.Fatalf("after the interval it must be sent again, got %d", len(h))
	}
}

func TestRunDrainsUntilCancelled(t *testing.T) {
	sink := &fakeSink{}
	w, st := setup(t, sink, nil, nil)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { w.Run(ctx); close(done) }()

	feed(t, st, 5, e(1, "violation", map[string]any{"violation_type": "TAB_SWITCH", "severity": "LOW"}))
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if v, _, _ := sink.all(); len(v) == 1 {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	cancel()
	<-done
	if v, _, _ := sink.all(); len(v) != 1 {
		t.Fatalf("Run did not deliver: %d", len(v))
	}
}
