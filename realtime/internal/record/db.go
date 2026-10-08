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
`

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

const cols = "id, exam_id, attempt_id, org_id, kind, egress_id, object_key, status, mime, size_bytes, duration_ms, error, started_at, ended_at, created_at"

func scan(r interface{ Scan(...any) error }) (Recording, error) {
	var x Recording
	err := r.Scan(&x.ID, &x.ExamID, &x.AttemptID, &x.OrgID, &x.Kind, &x.EgressID, &x.ObjectKey, &x.Status, &x.Mime, &x.SizeBytes, &x.DurationMS, &x.Error, &x.StartedAt, &x.EndedAt, &x.CreatedAt)
	return x, err
}

func (d *DB) Insert(ctx context.Context, r Recording) error {
	_, err := d.ExecContext(ctx, d.rebind("INSERT INTO recordings ("+cols+") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"),
		r.ID, r.ExamID, r.AttemptID, r.OrgID, r.Kind, r.EgressID, r.ObjectKey, r.Status, r.Mime, r.SizeBytes, r.DurationMS, r.Error, r.StartedAt, r.EndedAt, r.CreatedAt)
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
