// Package store is the Redis layer of the realtime plane. Every key and channel is defined here.
//
//	foxy:events            stream   every accepted client event, consumed by the worker group
//	foxy:events:dlq        stream   events the worker could not deliver after several attempts
//	foxy:seq:{aid}         string   highest acknowledged client seq of an attempt (idempotency)
//	foxy:att:{aid}         hash     live state of an attempt (what the proctor sees)
//	foxy:room:{eid}:set    set      attempts present in an exam room
//	foxy:room:{eid}        channel  deltas published for hubs
//	foxy:cmds:{aid}        hash     un-acknowledged commands (id -> json)
package store

import (
	"context"
	"encoding/json"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/foxyexam/realtime/internal/events"
)

const (
	StreamEvents = "foxy:events"
	StreamDLQ    = "foxy:events:dlq"
	Group        = "workers"

	stateTTL     = 12 * time.Hour
	streamMaxLen = 2_000_000
)

func keySeq(aid int64) string     { return "foxy:seq:" + strconv.FormatInt(aid, 10) }
func KeyAttempt(aid int64) string { return "foxy:att:" + strconv.FormatInt(aid, 10) }
func keyRoomSet(eid int64) string { return "foxy:room:" + strconv.FormatInt(eid, 10) + ":set" }
func ChannelRoom(eid int64) string {
	return "foxy:room:" + strconv.FormatInt(eid, 10)
}
func keyCmds(aid int64) string { return "foxy:cmds:" + strconv.FormatInt(aid, 10) }

type Store struct {
	R *redis.Client
}

func New(r *redis.Client) *Store { return &Store{R: r} }

// ---------------------------------------------------------------- ingest side

// Delta is what ingest publishes to hubs: only the fields that changed, plus fresh violations.
type Delta struct {
	AttemptID  int64            `json:"aid"`
	UserID     int64            `json:"uid,omitempty"`
	Fields     map[string]any   `json:"f,omitempty"`
	Violations []ViolationBrief `json:"vio,omitempty"`
	At         int64            `json:"at"`
}

type ViolationBrief struct {
	Type     string `json:"type"`
	Severity string `json:"sev"`
	TS       int64  `json:"ts"`
}

// LastSeq returns the highest acknowledged seq of an attempt (0 if none).
func (s *Store) LastSeq(ctx context.Context, aid int64) (int64, error) {
	v, err := s.R.Get(ctx, keySeq(aid)).Int64()
	if err == redis.Nil {
		return 0, nil
	}
	return v, err
}

// AcceptParams is everything ingest persists for one batch, written in a single pipeline round-trip.
type AcceptParams struct {
	AttemptID, ExamID, OrgID, UserID int64
	Events                           []events.Event
	MaxSeq                           int64
	Fields                           map[string]any // merged live-state fields
	ViolationsAdded                  int64
	Violations                       []ViolationBrief
	AckedCommands                    []string
	Now                              time.Time
}

// AcceptResult is what the client learns from a batch.
type AcceptResult struct {
	Commands []events.Command
	Status   string // lifecycle status known to the server: "", "active", "ended", "force_ended", "paused"
}

// Accept appends the events to the stream, updates the live state, publishes a delta and returns the
// pending commands and lifecycle status - all in one pipelined round-trip.
func (s *Store) Accept(ctx context.Context, p AcceptParams) (AcceptResult, error) {
	pipe := s.R.Pipeline()
	nowMS := p.Now.UnixMilli()
	for _, e := range p.Events {
		pipe.XAdd(ctx, &redis.XAddArgs{
			Stream: StreamEvents, MaxLen: streamMaxLen, Approx: true,
			Values: map[string]any{
				"a": p.AttemptID, "e": p.ExamID, "o": p.OrgID, "u": p.UserID,
				"seq": e.Seq, "t": e.Type, "ts": e.TS, "d": string(e.Data), "ing": nowMS,
			},
		})
	}
	pipe.Set(ctx, keySeq(p.AttemptID), p.MaxSeq, stateTTL)

	attKey := KeyAttempt(p.AttemptID)
	flat := make([]any, 0, len(p.Fields)*2+8)
	flat = append(flat, "aid", p.AttemptID, "eid", p.ExamID, "uid", p.UserID, "ls", nowMS)
	for k, v := range p.Fields {
		flat = append(flat, k, v)
	}
	pipe.HSet(ctx, attKey, flat...)
	if p.ViolationsAdded > 0 {
		pipe.HIncrBy(ctx, attKey, "v", p.ViolationsAdded)
		last := p.Violations[len(p.Violations)-1]
		pipe.HSet(ctx, attKey, "lv", last.Type, "lvs", last.Severity, "lvt", last.TS)
	}
	pipe.Expire(ctx, attKey, stateTTL)
	pipe.SAdd(ctx, keyRoomSet(p.ExamID), p.AttemptID)
	pipe.Expire(ctx, keyRoomSet(p.ExamID), stateTTL)

	for _, id := range p.AckedCommands {
		pipe.HDel(ctx, keyCmds(p.AttemptID), id)
	}

	delta, _ := json.Marshal(Delta{AttemptID: p.AttemptID, UserID: p.UserID, Fields: p.Fields, Violations: p.Violations, At: nowMS})
	pipe.Publish(ctx, ChannelRoom(p.ExamID), delta)
	cmdsCmd := pipe.HGetAll(ctx, keyCmds(p.AttemptID))
	stCmd := pipe.HGet(ctx, attKey, "st")

	if _, err := pipe.Exec(ctx); err != nil && err != redis.Nil {
		return AcceptResult{}, err
	}
	res := AcceptResult{Status: stCmd.Val()}
	for _, raw := range cmdsCmd.Val() {
		var c events.Command
		if json.Unmarshal([]byte(raw), &c) == nil {
			res.Commands = append(res.Commands, c)
		}
	}
	return res, nil
}

// SetLifecycle records that an attempt started / ended (called from Laravel through ingest's internal API).
func (s *Store) SetLifecycle(ctx context.Context, aid, eid, uid int64, status string, now time.Time) error {
	pipe := s.R.Pipeline()
	pipe.HSet(ctx, KeyAttempt(aid), "aid", aid, "eid", eid, "uid", uid, "st", status, "ls", now.UnixMilli())
	pipe.Expire(ctx, KeyAttempt(aid), stateTTL)
	pipe.SAdd(ctx, keyRoomSet(eid), aid)
	pipe.Expire(ctx, keyRoomSet(eid), stateTTL)
	d, _ := json.Marshal(Delta{AttemptID: aid, UserID: uid, Fields: map[string]any{"st": status}, At: now.UnixMilli()})
	pipe.Publish(ctx, ChannelRoom(eid), d)
	_, err := pipe.Exec(ctx)
	return err
}

// ---------------------------------------------------------------- commands

// PushCommand stores a command for delivery with the candidate's next ingest responses.
func (s *Store) PushCommand(ctx context.Context, aid, eid int64, c events.Command) error {
	raw, _ := json.Marshal(c)
	pipe := s.R.Pipeline()
	pipe.HSet(ctx, keyCmds(aid), c.ID, raw)
	pipe.Expire(ctx, keyCmds(aid), stateTTL)
	d, _ := json.Marshal(Delta{AttemptID: aid, Fields: map[string]any{"cmd": c.Type}, At: c.At})
	pipe.Publish(ctx, ChannelRoom(eid), d)
	_, err := pipe.Exec(ctx)
	return err
}

// AttemptExam returns the exam an attempt belongs to according to the live state (0 if unknown).
func (s *Store) AttemptExam(ctx context.Context, aid int64) (int64, error) {
	v, err := s.R.HGet(ctx, KeyAttempt(aid), "eid").Int64()
	if err == redis.Nil {
		return 0, nil
	}
	return v, err
}

// ---------------------------------------------------------------- hub side

// Snapshot returns the raw live state of every attempt in a room.
func (s *Store) Snapshot(ctx context.Context, eid int64) (map[int64]map[string]string, error) {
	ids, err := s.R.SMembers(ctx, keyRoomSet(eid)).Result()
	if err != nil {
		return nil, err
	}
	pipe := s.R.Pipeline()
	cmds := make([]*redis.MapStringStringCmd, len(ids))
	for i, id := range ids {
		n, _ := strconv.ParseInt(id, 10, 64)
		cmds[i] = pipe.HGetAll(ctx, KeyAttempt(n))
	}
	if _, err := pipe.Exec(ctx); err != nil && err != redis.Nil {
		return nil, err
	}
	out := make(map[int64]map[string]string, len(ids))
	for i, id := range ids {
		n, _ := strconv.ParseInt(id, 10, 64)
		if m := cmds[i].Val(); len(m) > 0 {
			out[n] = m
		}
	}
	return out, nil
}

// Subscribe listens to a room's deltas.
func (s *Store) Subscribe(ctx context.Context, eid int64) *redis.PubSub {
	return s.R.Subscribe(ctx, ChannelRoom(eid))
}

// ---------------------------------------------------------------- worker side

func (s *Store) EnsureGroup(ctx context.Context) error {
	err := s.R.XGroupCreateMkStream(ctx, StreamEvents, Group, "$").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		return err
	}
	return nil
}

func toInt(v any) int64 {
	switch t := v.(type) {
	case string:
		n, _ := strconv.ParseInt(t, 10, 64)
		return n
	case int64:
		return t
	}
	return 0
}

// Decode turns a stream message into a Stored event.
func Decode(m redis.XMessage) events.Stored {
	str := func(k string) string {
		s, _ := m.Values[k].(string)
		return s
	}
	return events.Stored{
		StreamID:  m.ID,
		AttemptID: toInt(m.Values["a"]), ExamID: toInt(m.Values["e"]), OrgID: toInt(m.Values["o"]), UserID: toInt(m.Values["u"]),
		Event:    events.Event{Seq: toInt(m.Values["seq"]), Type: str("t"), TS: toInt(m.Values["ts"]), Data: json.RawMessage(str("d"))},
		IngestMS: toInt(m.Values["ing"]),
	}
}
