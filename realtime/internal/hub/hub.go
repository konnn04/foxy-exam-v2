// Package hub streams the live state of an exam room to proctors over WebSocket.
//
// The hub never forwards individual events. It keeps the room state in memory (fed by the Redis
// deltas ingest publishes) and, once per tick (default 1s), sends ONE message per proctor containing
// only the candidates whose state changed - so 10,000 candidates produce a few hundred changed rows per
// second to a handful of proctors, not 10,000 events per second. Status ("online", "away", "offline"...)
// is derived here from what the client really reports (last heartbeat age, focus, fullscreen), never from
// a stored flag.
package hub

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net/http"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/coder/websocket"

	"github.com/foxyexam/realtime/internal/auth"
	"github.com/foxyexam/realtime/internal/events"
	"github.com/foxyexam/realtime/internal/obs"
	"github.com/foxyexam/realtime/internal/store"
)

type Config struct {
	JWTSecret      []byte
	Tick           time.Duration // flush period
	OfflineAfter   time.Duration // no heartbeat for this long => offline
	RoomIdleTTL    time.Duration // keep a room's subscription this long after the last proctor left
	FeedPerTick    int           // max violations pushed per tick (the rest stays in the DB)
	OriginPatterns []string      // allowed WebSocket origins ("*" in dev)
	Now            func() time.Time
}

func (c *Config) defaults() {
	if c.Tick == 0 {
		c.Tick = time.Second
	}
	if c.OfflineAfter == 0 {
		c.OfflineAfter = 20 * time.Second
	}
	if c.RoomIdleTTL == 0 {
		c.RoomIdleTTL = 30 * time.Second
	}
	if c.FeedPerTick == 0 {
		c.FeedPerTick = 50
	}
	if c.Now == nil {
		c.Now = time.Now
	}
}

// Status values shown to proctors.
const (
	StatusOnline  = "online"
	StatusAway    = "away"    // focus lost or fullscreen left
	StatusOffline = "offline" // heartbeat stopped
	StatusPaused  = "paused"
	StatusEnded   = "ended"
)

type Brief struct {
	Type     string `json:"type"`
	Severity string `json:"severity"`
	TS       int64  `json:"ts"`
}

// View is one candidate row of the proctor dashboard.
type View struct {
	AttemptID     int64  `json:"attempt_id"`
	UserID        int64  `json:"user_id,omitempty"`
	Status        string `json:"status"`
	Focus         *bool  `json:"focus,omitempty"`
	Fullscreen    *bool  `json:"fullscreen,omitempty"`
	Camera        *bool  `json:"camera,omitempty"`
	Screen        *bool  `json:"screen,omitempty"`
	LatencyMS     int    `json:"latency_ms,omitempty"`
	Question      int    `json:"question,omitempty"`
	Attention     *int   `json:"attention,omitempty"` // 0..100, from the candidate's on-device face analysis
	Faces         *int   `json:"faces,omitempty"`
	LastSeenMS    int64  `json:"last_seen_ms"`
	Violations    int    `json:"violations"`
	LastViolation *Brief `json:"last_violation,omitempty"`
	LastOpLogMS   int64  `json:"last_oplog_ms,omitempty"`
	PendingCmd    string `json:"pending_command,omitempty"`
}

type Counts struct {
	Total      int `json:"total"`
	Online     int `json:"online"`
	Away       int `json:"away"`
	Offline    int `json:"offline"`
	Paused     int `json:"paused"`
	Ended      int `json:"ended"`
	Violations int `json:"violations"`
}

// Message is what a proctor receives.
type Message struct {
	Type   string  `json:"type"` // snapshot | delta | ping
	Tick   int64   `json:"tick"`
	Now    int64   `json:"now"`
	Rows   []View  `json:"rows,omitempty"`
	Feed   []Feed  `json:"feed,omitempty"`
	Counts *Counts `json:"counts,omitempty"`
}

type Feed struct {
	AttemptID int64 `json:"attempt_id"`
	Brief
}

type attState struct {
	View
	lifecycle string // "", "paused", "ended", "force_ended"
	dirty     bool
}

func parseBool(s string) *bool {
	if s == "" {
		return nil
	}
	b := s == "1"
	return &b
}

func atoi(s string) int64 { n, _ := strconv.ParseInt(s, 10, 64); return n }

// apply merges stored/delta fields into the state.
func (a *attState) apply(f map[string]string) {
	for k, v := range f {
		switch k {
		case "aid":
			a.AttemptID = atoi(v)
		case "uid":
			a.UserID = atoi(v)
		case "ls":
			a.LastSeenMS = atoi(v)
		case "f":
			a.Focus = parseBool(v)
		case "fs":
			a.Fullscreen = parseBool(v)
		case "cam":
			a.Camera = parseBool(v)
		case "scr":
			a.Screen = parseBool(v)
		case "lat":
			a.LatencyMS = int(atoi(v))
		case "q":
			a.Question = int(atoi(v))
		case "att":
			n := int(atoi(v))
			a.Attention = &n
		case "fc":
			n := int(atoi(v))
			a.Faces = &n
		case "v":
			a.Violations = int(atoi(v))
		case "lv":
			if a.LastViolation == nil {
				a.LastViolation = &Brief{}
			}
			a.LastViolation.Type = v
		case "lvs":
			if a.LastViolation == nil {
				a.LastViolation = &Brief{}
			}
			a.LastViolation.Severity = v
		case "lvt":
			if a.LastViolation == nil {
				a.LastViolation = &Brief{}
			}
			a.LastViolation.TS = atoi(v)
		case "ok":
			a.LastOpLogMS = atoi(v)
		case "cmd":
			a.PendingCmd = v
		case "st":
			a.lifecycle = v
			if v == "active" {
				a.lifecycle = ""
			}
		}
	}
	a.dirty = true
}

// derive computes the status from the raw signals.
func (a *attState) derive(now time.Time, offlineAfter time.Duration) string {
	switch a.lifecycle {
	case "ended", "force_ended":
		return StatusEnded
	case "paused":
		return StatusPaused
	}
	if a.LastSeenMS == 0 || now.Sub(time.UnixMilli(a.LastSeenMS)) > offlineAfter {
		return StatusOffline
	}
	if (a.Focus != nil && !*a.Focus) || (a.Fullscreen != nil && !*a.Fullscreen) {
		return StatusAway
	}
	return StatusOnline
}

// ---------------------------------------------------------------- rooms

type client struct {
	send   chan []byte
	cancel context.CancelFunc
}

type room struct {
	examID int64
	h      *Hub

	mu      sync.Mutex
	atts    map[int64]*attState
	feed    []Feed
	clients map[*client]struct{}
	tick    int64
	last    Counts
	idleAt  time.Time
	cancel  context.CancelFunc
}

func newRoom(h *Hub, examID int64) *room {
	return &room{examID: examID, h: h, atts: map[int64]*attState{}, clients: map[*client]struct{}{}}
}

func (r *room) att(aid int64) *attState {
	a, ok := r.atts[aid]
	if !ok {
		a = &attState{View: View{AttemptID: aid}}
		r.atts[aid] = a
	}
	return a
}

// load fills the room from Redis (initial state).
func (r *room) load(ctx context.Context) error {
	snap, err := r.h.st.Snapshot(ctx, r.examID)
	if err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	for aid, f := range snap {
		r.att(aid).apply(f)
	}
	return nil
}

// ingestDelta merges one published delta.
func (r *room) ingestDelta(d store.Delta) {
	r.mu.Lock()
	defer r.mu.Unlock()
	a := r.att(d.AttemptID)
	f := map[string]string{"aid": strconv.FormatInt(d.AttemptID, 10), "ls": strconv.FormatInt(d.At, 10)}
	if d.UserID != 0 {
		f["uid"] = strconv.FormatInt(d.UserID, 10)
	}
	for k, v := range d.Fields {
		switch t := v.(type) {
		case string:
			f[k] = t
		case float64:
			f[k] = strconv.FormatInt(int64(t), 10)
		}
	}
	// a command push is not candidate activity: do not refresh presence
	if _, isCmd := d.Fields["cmd"]; isCmd && len(d.Fields) == 1 {
		delete(f, "ls")
	}
	if len(d.Violations) > 0 {
		a.Violations += len(d.Violations)
		last := d.Violations[len(d.Violations)-1]
		a.LastViolation = &Brief{Type: last.Type, Severity: last.Severity, TS: last.TS}
		for _, v := range d.Violations {
			r.feed = append(r.feed, Feed{AttemptID: d.AttemptID, Brief: Brief{Type: v.Type, Severity: v.Severity, TS: v.TS}})
		}
	}
	a.apply(f)
}

func (r *room) counts(now time.Time) Counts {
	c := Counts{Total: len(r.atts)}
	for _, a := range r.atts {
		switch a.Status {
		case StatusOnline:
			c.Online++
		case StatusAway:
			c.Away++
		case StatusOffline:
			c.Offline++
		case StatusPaused:
			c.Paused++
		case StatusEnded:
			c.Ended++
		}
		c.Violations += a.Violations
	}
	return c
}

// flush builds the message for one tick. It returns nil when nothing changed.
func (r *room) flush(now time.Time) *Message {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.tick++
	var rows []View
	for _, a := range r.atts {
		st := a.derive(now, r.h.cfg.OfflineAfter)
		if st != a.Status {
			a.Status = st
			a.dirty = true
		}
		if a.dirty {
			rows = append(rows, a.View)
			a.dirty = false
		}
	}
	feed := r.feed
	if len(feed) > r.h.cfg.FeedPerTick {
		feed = feed[len(feed)-r.h.cfg.FeedPerTick:]
	}
	r.feed = nil
	if len(rows) == 0 && len(feed) == 0 {
		return nil
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].AttemptID < rows[j].AttemptID })
	c := r.counts(now)
	r.last = c
	return &Message{Type: "delta", Tick: r.tick, Now: now.UnixMilli(), Rows: rows, Feed: feed, Counts: &c}
}

func (r *room) snapshot(now time.Time) *Message {
	r.mu.Lock()
	defer r.mu.Unlock()
	rows := make([]View, 0, len(r.atts))
	for _, a := range r.atts {
		a.Status = a.derive(now, r.h.cfg.OfflineAfter)
		rows = append(rows, a.View)
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].AttemptID < rows[j].AttemptID })
	c := r.counts(now)
	return &Message{Type: "snapshot", Tick: r.tick, Now: now.UnixMilli(), Rows: rows, Counts: &c}
}

func (r *room) broadcast(m *Message) {
	raw, _ := json.Marshal(m)
	r.mu.Lock()
	defer r.mu.Unlock()
	for c := range r.clients {
		select {
		case c.send <- raw:
		default: // slow consumer: drop it, it reconnects and gets a fresh snapshot
			r.h.m.Inc("hub_slow_consumers_dropped_total")
			c.cancel()
			delete(r.clients, c)
		}
	}
}

// run feeds the room until it is idle.
func (r *room) run(ctx context.Context) {
	sub := r.h.st.Subscribe(ctx, r.examID)
	defer sub.Close()
	msgs := sub.Channel()
	t := time.NewTicker(r.h.cfg.Tick)
	defer t.Stop()
	lastPing := r.h.cfg.Now()
	for {
		select {
		case <-ctx.Done():
			return
		case m, ok := <-msgs:
			if !ok {
				return
			}
			var d store.Delta
			if json.Unmarshal([]byte(m.Payload), &d) == nil {
				r.ingestDelta(d)
				r.h.m.Inc("hub_deltas_total")
			}
		case <-t.C:
			now := r.h.cfg.Now()
			if msg := r.flush(now); msg != nil {
				r.broadcast(msg)
				lastPing = now
			} else if now.Sub(lastPing) > 10*time.Second {
				r.broadcast(&Message{Type: "ping", Now: now.UnixMilli()})
				lastPing = now
			}
			r.mu.Lock()
			idle := len(r.clients) == 0 && !r.idleAt.IsZero() && now.Sub(r.idleAt) > r.h.cfg.RoomIdleTTL
			r.mu.Unlock()
			if idle {
				r.h.dropRoom(r.examID, r)
				return
			}
		}
	}
}

// ---------------------------------------------------------------- hub

type Hub struct {
	cfg Config
	st  *store.Store
	log *slog.Logger
	m   *obs.Metrics

	mu    sync.Mutex
	rooms map[int64]*room
}

func New(cfg Config, st *store.Store, log *slog.Logger, m *obs.Metrics) *Hub {
	cfg.defaults()
	return &Hub{cfg: cfg, st: st, log: log, m: m, rooms: map[int64]*room{}}
}

func (h *Hub) dropRoom(id int64, r *room) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[id] == r {
		delete(h.rooms, id)
	}
	r.cancel()
}

// join returns the room, creating and loading it on first use.
func (h *Hub) join(ctx context.Context, examID int64) (*room, error) {
	h.mu.Lock()
	r, ok := h.rooms[examID]
	if !ok {
		r = newRoom(h, examID)
		rctx, cancel := context.WithCancel(context.Background())
		r.cancel = cancel
		h.rooms[examID] = r
		h.mu.Unlock()
		if err := r.load(ctx); err != nil {
			h.dropRoom(examID, r)
			return nil, err
		}
		go r.run(rctx)
		return r, nil
	}
	h.mu.Unlock()
	return r, nil
}

func (h *Hub) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/rooms/{eid}/ws", h.handleWS)
	mux.HandleFunc("GET /v1/rooms/{eid}/snapshot", h.handleSnapshot)
	mux.HandleFunc("POST /v1/rooms/{eid}/commands", h.handleCommand)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		if err := h.st.R.Ping(r.Context()).Err(); err != nil {
			http.Error(w, `{"ok":false}`, http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	})
	mux.Handle("GET /metrics", h.m.Handler())
	return mux
}

// authorize returns the proctor claims for a request to a room, or writes the error.
func (h *Hub) authorize(w http.ResponseWriter, r *http.Request) (auth.Claims, int64, bool) {
	eid := atoi(r.PathValue("eid"))
	tok := auth.BearerToken(r.Header.Get("Authorization"))
	if tok == "" {
		tok = r.URL.Query().Get("token") // browsers cannot set headers on WebSocket
	}
	c, err := auth.Verify(h.cfg.JWTSecret, tok, h.cfg.Now())
	if err != nil {
		http.Error(w, `{"ok":false,"error":"invalid_token"}`, http.StatusUnauthorized)
		return c, 0, false
	}
	if !c.CanWatch(eid) {
		http.Error(w, `{"ok":false,"error":"forbidden"}`, http.StatusForbidden)
		return c, 0, false
	}
	return c, eid, true
}

func (h *Hub) handleSnapshot(w http.ResponseWriter, r *http.Request) {
	_, eid, ok := h.authorize(w, r)
	if !ok {
		return
	}
	room, err := h.join(r.Context(), eid)
	if err != nil {
		http.Error(w, `{"ok":false}`, http.StatusServiceUnavailable)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(room.snapshot(h.cfg.Now()))
}

type commandRequest struct {
	Type      string `json:"type"` // "cmd" over WS, ignored over REST
	AttemptID int64  `json:"attempt_id"`
	Command   string `json:"command"` // WARN | PAUSE | RESUME | FORCE_END
	Message   string `json:"message"`
}

func (h *Hub) sendCommand(ctx context.Context, c auth.Claims, eid int64, req commandRequest) (int, string) {
	if !events.CommandTypes[req.Command] {
		return http.StatusBadRequest, "unknown_command"
	}
	// the target must really belong to this room: a proctor token of exam A must not act on exam B
	got, err := h.st.AttemptExam(ctx, req.AttemptID)
	if err != nil {
		return http.StatusServiceUnavailable, "unavailable"
	}
	if got != eid {
		return http.StatusNotFound, "attempt_not_in_room"
	}
	id := make([]byte, 8)
	_, _ = rand.Read(id)
	cmd := events.Command{ID: hex.EncodeToString(id), Type: req.Command, Message: req.Message, By: c.UserID, At: h.cfg.Now().UnixMilli()}
	if err := h.st.PushCommand(ctx, req.AttemptID, eid, cmd); err != nil {
		return http.StatusServiceUnavailable, "unavailable"
	}
	h.m.Inc("hub_commands_total")
	return http.StatusOK, cmd.ID
}

func (h *Hub) handleCommand(w http.ResponseWriter, r *http.Request) {
	c, eid, ok := h.authorize(w, r)
	if !ok {
		return
	}
	var req commandRequest
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<14)).Decode(&req) != nil {
		http.Error(w, `{"ok":false,"error":"bad_json"}`, http.StatusBadRequest)
		return
	}
	code, v := h.sendCommand(r.Context(), c, eid, req)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	if code == http.StatusOK {
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "command_id": v})
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": v})
}

func (h *Hub) handleWS(w http.ResponseWriter, r *http.Request) {
	claims, eid, ok := h.authorize(w, r)
	if !ok {
		return
	}
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: h.cfg.OriginPatterns})
	if err != nil {
		return
	}
	defer conn.CloseNow()
	conn.SetReadLimit(1 << 14)

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	rm, err := h.join(ctx, eid)
	if err != nil {
		conn.Close(websocket.StatusTryAgainLater, "unavailable")
		return
	}
	cl := &client{send: make(chan []byte, 16), cancel: cancel}
	snap, _ := json.Marshal(rm.snapshot(h.cfg.Now()))
	rm.mu.Lock()
	rm.clients[cl] = struct{}{}
	rm.idleAt = time.Time{}
	rm.mu.Unlock()
	h.m.Inc("hub_connections_total")
	defer func() {
		rm.mu.Lock()
		delete(rm.clients, cl)
		if len(rm.clients) == 0 {
			rm.idleAt = h.cfg.Now()
		}
		rm.mu.Unlock()
	}()

	cl.send <- snap

	// writer
	go func() {
		for {
			select {
			case <-ctx.Done():
				conn.Close(websocket.StatusGoingAway, "bye")
				return
			case b := <-cl.send:
				wctx, wc := context.WithTimeout(ctx, 5*time.Second)
				err := conn.Write(wctx, websocket.MessageText, b)
				wc()
				if err != nil {
					cancel()
					return
				}
			}
		}
	}()

	// reader: proctor commands
	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		var req commandRequest
		if json.Unmarshal(data, &req) != nil || req.Type != "cmd" {
			continue
		}
		code, v := h.sendCommand(ctx, claims, eid, req)
		reply, _ := json.Marshal(map[string]any{"type": "cmd_result", "ok": code == http.StatusOK, "attempt_id": req.AttemptID, "detail": v})
		select {
		case cl.send <- reply:
		default:
		}
	}
}
