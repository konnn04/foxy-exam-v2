// Package record is the recording / evidence service: metadata in SQL, bytes in S3-compatible storage,
// capture driven by LiveKit egress. It owns its own tables and exposes an HTTP API; the Laravel core only
// stores a recording id next to a violation.
package record

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const (
	KindCamera   = "camera"
	KindScreen   = "screen"
	KindEvidence = "evidence"
	// KindCamera2 is the phone used as an extra camera (recorded from its own private room).
	KindCamera2 = "camera2"

	StatusRecording     = "recording"
	StatusPendingUpload = "pending_upload"
	StatusReady         = "ready"
	StatusFailed        = "failed"
	StatusDeleted       = "deleted"
)

// Recording is one stored artefact (video recording or evidence file).
type Recording struct {
	ID         string `json:"id"`
	ExamID     int64  `json:"exam_id"`
	AttemptID  int64  `json:"attempt_id"`
	OrgID      int64  `json:"org_id"`
	Kind       string `json:"kind"`
	EgressID   string `json:"egress_id,omitempty"`
	ObjectKey  string `json:"-"`
	Status     string `json:"status"`
	Mime       string `json:"mime,omitempty"`
	SizeBytes  int64  `json:"size_bytes"`
	DurationMS int64  `json:"duration_ms"`
	Error      string `json:"error,omitempty"`
	StartedAt  int64  `json:"started_at,omitempty"`
	EndedAt    int64  `json:"ended_at,omitempty"`
	CreatedAt  int64  `json:"created_at"`
	URL        string `json:"url,omitempty"` // presigned, filled on read
	// Sealed: the object is encrypted (see seal.go); it is played through /v1/sealed, never presigned.
	Sealed    bool  `json:"sealed"`
	PlainSize int64 `json:"-"`
}

const schema = `
CREATE TABLE IF NOT EXISTS recordings (
  id TEXT PRIMARY KEY,
  exam_id BIGINT NOT NULL,
  attempt_id BIGINT NOT NULL,
  org_id BIGINT NOT NULL DEFAULT 0,
  kind TEXT NOT NULL,
  egress_id TEXT NOT NULL DEFAULT '',
  object_key TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT '',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  duration_ms BIGINT NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  started_at BIGINT NOT NULL DEFAULT 0,
  ended_at BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recordings_exam ON recordings (exam_id, attempt_id);
CREATE INDEX IF NOT EXISTS idx_recordings_egress ON recordings (egress_id);
CREATE INDEX IF NOT EXISTS idx_recordings_created ON recordings (created_at);
CREATE TABLE IF NOT EXISTS seal_keys (
  exam_id BIGINT PRIMARY KEY,
  wrapped TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS seal_requests (
  attempt_id BIGINT PRIMARY KEY,
  exam_id BIGINT NOT NULL,
  requested_at BIGINT NOT NULL
);
`

// columns added after the first release: ALTER is tried each start, "already there" is fine
var addedColumns = []string{
	"ALTER TABLE recordings ADD COLUMN sealed INTEGER NOT NULL DEFAULT 0",
	"ALTER TABLE recordings ADD COLUMN plain_size BIGINT NOT NULL DEFAULT 0",
}

// DB wraps database/sql for both SQLite (dev/tests) and Postgres (production).
type DB struct {
	*sql.DB
	pg bool
}

// ensurePostgres creates the target database when the server answers "does not exist" (SQLSTATE 3D000),
// so a fresh Postgres needs no init script.
func ensurePostgres(ctx context.Context, dsn string) error {
	cfg, err := pgx.ParseConfig(dsn)
	if err != nil {
		return err
	}
	conn, err := pgx.ConnectConfig(ctx, cfg)
	if err == nil {
		return conn.Close(ctx)
	}
	var pe *pgconn.PgError
	if !errors.As(err, &pe) || pe.Code != "3D000" {
		return err
	}
	admin := cfg.Copy()
	admin.Database = "postgres"
	ac, err := pgx.ConnectConfig(ctx, admin)
	if err != nil {
		return fmt.Errorf("create database: %w", err)
	}
	defer ac.Close(ctx)
	if _, err := ac.Exec(ctx, "CREATE DATABASE "+pgx.Identifier{cfg.Database}.Sanitize()); err != nil {
		var ce *pgconn.PgError
		if errors.As(err, &ce) && ce.Code == "42P04" { // created concurrently
			return nil
		}
		return err
	}
	return nil
}

func Open(driver, dsn string) (*DB, error) {
	if driver == "pgx" {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := ensurePostgres(ctx, dsn); err != nil {
			return nil, err
		}
	}
	d, err := sql.Open(driver, dsn)
	if err != nil {
		return nil, err
	}
	if driver == "sqlite" {
		d.SetMaxOpenConns(1) // sqlite: one writer, no lock contention
	}
	db := &DB{DB: d, pg: driver == "pgx"}
	for _, stmt := range strings.Split(schema, ";") {
		if strings.TrimSpace(stmt) == "" {
			continue
		}
		if _, err := d.Exec(stmt); err != nil {
			return nil, fmt.Errorf("migrate: %w", err)
		}
	}
	for _, stmt := range addedColumns {
		if _, err := d.Exec(stmt); err != nil && !strings.Contains(strings.ToLower(err.Error()), "duplicate column") && !strings.Contains(strings.ToLower(err.Error()), "already exists") {
			return nil, fmt.Errorf("migrate: %w", err)
		}
	}
	return db, nil
}

// rebind converts ? placeholders to $n for Postgres.
func (d *DB) rebind(q string) string {
	if !d.pg {
		return q
	}
	var b strings.Builder
	n := 0
	for _, c := range q {
		if c == '?' {
			n++
			fmt.Fprintf(&b, "$%d", n)
			continue
		}
		b.WriteRune(c)
	}
	return b.String()
}

const cols = "id, exam_id, attempt_id, org_id, kind, egress_id, object_key, status, mime, size_bytes, duration_ms, error, started_at, ended_at, created_at, sealed, plain_size"

func scan(r interface{ Scan(...any) error }) (Recording, error) {
	var x Recording
	var sealed int64
	err := r.Scan(&x.ID, &x.ExamID, &x.AttemptID, &x.OrgID, &x.Kind, &x.EgressID, &x.ObjectKey, &x.Status, &x.Mime, &x.SizeBytes, &x.DurationMS, &x.Error, &x.StartedAt, &x.EndedAt, &x.CreatedAt, &sealed, &x.PlainSize)
	x.Sealed = sealed != 0
	return x, err
}

func (d *DB) Insert(ctx context.Context, r Recording) error {
	sealed := 0
	if r.Sealed {
		sealed = 1
	}
	_, err := d.ExecContext(ctx, d.rebind("INSERT INTO recordings ("+cols+") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"),
		r.ID, r.ExamID, r.AttemptID, r.OrgID, r.Kind, r.EgressID, r.ObjectKey, r.Status, r.Mime, r.SizeBytes, r.DurationMS, r.Error, r.StartedAt, r.EndedAt, r.CreatedAt, sealed, r.PlainSize)
	return err
}

// MarkSealed points a recording at its encrypted object.
func (d *DB) MarkSealed(ctx context.Context, id, key string, sealedSize, plainSize int64) error {
	_, err := d.ExecContext(ctx, d.rebind("UPDATE recordings SET sealed = 1, object_key = ?, size_bytes = ?, plain_size = ? WHERE id = ?"), key, sealedSize, plainSize, id)
	return err
}

// SealKey returns the wrapped data key of an exam ("" when it has none yet).
func (d *DB) SealKey(ctx context.Context, examID int64) (string, error) {
	var w string
	err := d.QueryRowContext(ctx, d.rebind("SELECT wrapped FROM seal_keys WHERE exam_id = ?"), examID).Scan(&w)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return w, err
}

// PutSealKey stores an exam's wrapped key unless one exists (a concurrent writer wins; the caller re-reads).
func (d *DB) PutSealKey(ctx context.Context, examID int64, wrapped string, now int64) error {
	_, err := d.ExecContext(ctx, d.rebind("INSERT INTO seal_keys (exam_id, wrapped, created_at) VALUES (?,?,?) ON CONFLICT (exam_id) DO NOTHING"), examID, wrapped, now)
	return err
}

type SealRequest struct {
	AttemptID, ExamID, RequestedAt int64
}

func (d *DB) RequestSeal(ctx context.Context, attemptID, examID, now int64) error {
	_, err := d.ExecContext(ctx, d.rebind("INSERT INTO seal_requests (attempt_id, exam_id, requested_at) VALUES (?,?,?) ON CONFLICT (attempt_id) DO NOTHING"), attemptID, examID, now)
	return err
}

func (d *DB) SealRequests(ctx context.Context, limit int) ([]SealRequest, error) {
	rows, err := d.QueryContext(ctx, d.rebind("SELECT attempt_id, exam_id, requested_at FROM seal_requests ORDER BY requested_at LIMIT ?"), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SealRequest
	for rows.Next() {
		var x SealRequest
		if err := rows.Scan(&x.AttemptID, &x.ExamID, &x.RequestedAt); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

func (d *DB) DoneSeal(ctx context.Context, attemptID int64) error {
	_, err := d.ExecContext(ctx, d.rebind("DELETE FROM seal_requests WHERE attempt_id = ?"), attemptID)
	return err
}

func (d *DB) Get(ctx context.Context, id string) (Recording, error) {
	return scan(d.QueryRowContext(ctx, d.rebind("SELECT "+cols+" FROM recordings WHERE id = ? AND status <> 'deleted'"), id))
}

func (d *DB) ByEgress(ctx context.Context, egressID string) (Recording, error) {
	return scan(d.QueryRowContext(ctx, d.rebind("SELECT "+cols+" FROM recordings WHERE egress_id = ?"), egressID))
}

// Active returns the live recording of a kind for an attempt, if any.
func (d *DB) Active(ctx context.Context, attemptID int64, kind string) (Recording, error) {
	return scan(d.QueryRowContext(ctx, d.rebind("SELECT "+cols+" FROM recordings WHERE attempt_id = ? AND kind = ? AND status = ? ORDER BY created_at DESC LIMIT 1"), attemptID, kind, StatusRecording))
}

func (d *DB) ListByExam(ctx context.Context, examID int64) ([]Recording, error) {
	return d.list(ctx, "exam_id = ?", examID)
}

func (d *DB) ListByAttempt(ctx context.Context, examID, attemptID int64) ([]Recording, error) {
	return d.list(ctx, "exam_id = ? AND attempt_id = ?", examID, attemptID)
}

func (d *DB) list(ctx context.Context, where string, args ...any) ([]Recording, error) {
	rows, err := d.QueryContext(ctx, d.rebind("SELECT "+cols+" FROM recordings WHERE status <> 'deleted' AND "+where+" ORDER BY attempt_id, created_at"), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Recording
	for rows.Next() {
		r, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// Finish marks a recording ready/failed with its file facts.
func (d *DB) Finish(ctx context.Context, id, status, errMsg, key string, size, durationMS, endedAt int64) error {
	_, err := d.ExecContext(ctx, d.rebind("UPDATE recordings SET status = ?, error = ?, object_key = CASE WHEN ? <> '' THEN ? ELSE object_key END, size_bytes = ?, duration_ms = ?, ended_at = ? WHERE id = ?"),
		status, errMsg, key, key, size, durationMS, endedAt, id)
	return err
}

func (d *DB) SetStatus(ctx context.Context, id, status string) error {
	_, err := d.ExecContext(ctx, d.rebind("UPDATE recordings SET status = ? WHERE id = ?"), status, id)
	return err
}

func (d *DB) SetSize(ctx context.Context, id string, size int64) error {
	_, err := d.ExecContext(ctx, d.rebind("UPDATE recordings SET size_bytes = ?, status = ? WHERE id = ?"), size, StatusReady, id)
	return err
}

// Expired returns recordings older than the cutoff that still own bytes.
func (d *DB) Expired(ctx context.Context, before time.Time, limit int) ([]Recording, error) {
	rows, err := d.QueryContext(ctx, d.rebind("SELECT "+cols+" FROM recordings WHERE created_at < ? AND status <> 'deleted' ORDER BY created_at LIMIT ?"), before.UnixMilli(), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Recording
	for rows.Next() {
		r, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
