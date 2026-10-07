// Package events defines the wire format shared by FoxyClient, the ingest gateway and the worker.
package events

import (
	"encoding/json"
	"errors"
	"fmt"
)

// Event types a client may send.
const (
	TypeHeartbeat = "hb"        // periodic state: focus, fullscreen, camera, screen, latency
	TypeViolation = "violation" // anti-cheat finding
	TypeOpLog     = "oplog"     // keystroke / paste telemetry of a coding exam
	TypeLog       = "log"       // free-form client diagnostics (archived, never shown live)
	TypeCmdAck    = "cmd_ack"   // the client executed a server command
)

const (
	MaxBatchEvents = 500
	MaxDataBytes   = 64 << 10 // per event
)

var validTypes = map[string]bool{TypeHeartbeat: true, TypeViolation: true, TypeOpLog: true, TypeLog: true, TypeCmdAck: true}

// Violation types and severities mirror the Laravel enums; anything else is rejected at the edge.
var ViolationTypes = map[string]bool{
	"BULK_PASTE": true, "SYNTHETIC_INPUT": true, "TAB_SWITCH": true, "WINDOW_LOST_FOCUS": true, "DEVTOOLS_OPENED": true,
	"MULTIPLE_KEYBOARDS": true, "FACE_MISMATCH": true, "MULTIPLE_PEOPLE": true, "NO_FACE_DETECTED": true, "PROHIBITED_DEVICE": true,
	// detected by FoxyClient itself
	"BANNED_APP": true, "MULTIPLE_MONITORS": true, "DEVICE_CHANGED": true, "SYSTEM_SHORTCUT": true, "APP_NOT_ALLOWED": true,
	"LOOKING_AWAY": true, "FACE_TOO_FAR": true, "CAMERA_LOST": true, "SCREEN_SHARE_STOPPED": true, "OFFLINE_TOO_LONG": true,
}

var Severities = map[string]bool{"LOW": true, "MEDIUM": true, "HIGH": true, "CRITICAL": true}

// Event is one client observation. Seq is strictly increasing per attempt and makes retries idempotent.
type Event struct {
	Seq  int64           `json:"seq"`
	Type string          `json:"t"`
	TS   int64           `json:"ts"` // client wall clock, unix ms
	Data json.RawMessage `json:"data,omitempty"`
}

// Batch is what the client posts about once a second.
type Batch struct {
	Events []Event `json:"events"`
}

// Heartbeat is the Data of a TypeHeartbeat event. Pointers: a field the client omits keeps its previous value.
type Heartbeat struct {
	Focus      *bool `json:"focus,omitempty"`
	Fullscreen *bool `json:"fullscreen,omitempty"`
	Camera     *bool `json:"camera,omitempty"`
	Screen     *bool `json:"screen,omitempty"`
	LatencyMS  *int  `json:"latency_ms,omitempty"`
	Question   *int  `json:"question,omitempty"` // question / problem the candidate is looking at
}

// Violation is the Data of a TypeViolation event.
type Violation struct {
	ViolationType string         `json:"violation_type"`
	Severity      string         `json:"severity"`
	Details       map[string]any `json:"details,omitempty"`
	EvidenceID    string         `json:"evidence_id,omitempty"`
}

// OpLog is the Data of a TypeOpLog event.
type OpLog struct {
	ProblemID      *int64         `json:"programming_problem_id,omitempty"`
	BatchSeq       int            `json:"batch_seq"`
	KeystrokeCount int            `json:"keystroke_count"`
	PasteCount     int            `json:"paste_event_count"`
	Flags          map[string]any `json:"synthetic_flags,omitempty"`
	Payload        string         `json:"raw_ops_payload,omitempty"`
}

// CmdAck is the Data of a TypeCmdAck event.
type CmdAck struct {
	ID string `json:"id"`
}

var ErrInvalid = errors.New("invalid event")

// Validate rejects unknown types, oversize data and violations outside the enums.
func (e Event) Validate() error {
	if e.Seq <= 0 {
		return fmt.Errorf("%w: seq must be positive", ErrInvalid)
	}
	if !validTypes[e.Type] {
		return fmt.Errorf("%w: unknown type %q", ErrInvalid, e.Type)
	}
	if len(e.Data) > MaxDataBytes {
		return fmt.Errorf("%w: data too large (%d bytes)", ErrInvalid, len(e.Data))
	}
	switch e.Type {
	case TypeViolation:
		var v Violation
		if err := json.Unmarshal(e.Data, &v); err != nil {
			return fmt.Errorf("%w: violation data: %v", ErrInvalid, err)
		}
		if !ViolationTypes[v.ViolationType] || !Severities[v.Severity] {
			return fmt.Errorf("%w: violation_type/severity not allowed", ErrInvalid)
		}
	case TypeOpLog:
		var o OpLog
		if err := json.Unmarshal(e.Data, &o); err != nil {
			return fmt.Errorf("%w: oplog data: %v", ErrInvalid, err)
		}
		if o.KeystrokeCount < 0 || o.PasteCount < 0 || o.BatchSeq < 0 {
			return fmt.Errorf("%w: negative counters", ErrInvalid)
		}
	case TypeCmdAck:
		var a CmdAck
		if err := json.Unmarshal(e.Data, &a); err != nil || a.ID == "" {
			return fmt.Errorf("%w: cmd_ack needs an id", ErrInvalid)
		}
	case TypeHeartbeat:
		if len(e.Data) > 0 {
			var h Heartbeat
			if err := json.Unmarshal(e.Data, &h); err != nil {
				return fmt.Errorf("%w: heartbeat data: %v", ErrInvalid, err)
			}
		}
	}
	return nil
}

// Command is a server instruction for one candidate, delivered in an ingest response until acknowledged.
type Command struct {
	ID      string `json:"id"`
	Type    string `json:"type"` // WARN | PAUSE | RESUME | FORCE_END
	Message string `json:"message,omitempty"`
	By      int64  `json:"by,omitempty"` // proctor user id
	At      int64  `json:"at"`           // unix ms
}

var CommandTypes = map[string]bool{"WARN": true, "PAUSE": true, "RESUME": true, "FORCE_END": true}

// Stored is an event as it travels through the Redis stream towards the worker.
type Stored struct {
	StreamID  string
	AttemptID int64
	ExamID    int64
	OrgID     int64
	UserID    int64
	Event
	IngestMS int64
}
