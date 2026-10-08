package record

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"github.com/foxyexam/realtime/internal/auth"
	"github.com/foxyexam/realtime/internal/obs"
)

// Storage is the object store (MinIO / S3 / R2).
type Storage interface {
	PresignPut(ctx context.Context, key, contentType string, ttl time.Duration) (string, error)
	// Put stores an object streamed through this service (FoxyClient does not need to reach the storage endpoint).
	Put(ctx context.Context, key, contentType string, body io.Reader, size int64) error
	PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error)
	Stat(ctx context.Context, key string) (size int64, err error)
	Delete(ctx context.Context, key string) error
}

// S3Storage implements Storage with minio-go. Presigned URLs are signed for the PUBLIC endpoint (what a
// browser / FoxyClient can reach), while Stat/Delete use the internal one.
type S3Storage struct {
	internal *minio.Client
	public   *minio.Client
	bucket   string
}

func NewS3Storage(endpoint, publicEndpoint, access, secret, bucket, region string, ssl, publicSSL bool) (*S3Storage, error) {
	in, err := minio.New(endpoint, &minio.Options{Creds: credentials.NewStaticV4(access, secret, ""), Secure: ssl, Region: region})
	if err != nil {
		return nil, err
	}
	pub := in
	if publicEndpoint != "" {
		if pub, err = minio.New(publicEndpoint, &minio.Options{Creds: credentials.NewStaticV4(access, secret, ""), Secure: publicSSL, Region: region}); err != nil {
			return nil, err
		}
	}
	return &S3Storage{internal: in, public: pub, bucket: bucket}, nil
}

func (s *S3Storage) EnsureBucket(ctx context.Context) error {
	ok, err := s.internal.BucketExists(ctx, s.bucket)
	if err != nil || ok {
		return err
	}
	return s.internal.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{})
}

func (s *S3Storage) PresignPut(ctx context.Context, key, _ string, ttl time.Duration) (string, error) {
	u, err := s.public.PresignedPutObject(ctx, s.bucket, key, ttl)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

func (s *S3Storage) Put(ctx context.Context, key, contentType string, body io.Reader, size int64) error {
	_, err := s.internal.PutObject(ctx, s.bucket, key, body, size, minio.PutObjectOptions{ContentType: contentType})
	return err
}

func (s *S3Storage) PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error) {
	u, err := s.public.PresignedGetObject(ctx, s.bucket, key, ttl, nil)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

func (s *S3Storage) Stat(ctx context.Context, key string) (int64, error) {
	i, err := s.internal.StatObject(ctx, s.bucket, key, minio.StatObjectOptions{})
	if err != nil {
		return 0, err
	}
	return i.Size, nil
}

func (s *S3Storage) Delete(ctx context.Context, key string) error {
	return s.internal.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{})
}

// ---------------------------------------------------------------- server

type Config struct {
	JWTSecret      []byte
	InternalSecret []byte
	LiveKitKey     string
	LiveKitSecret  string
	PresignTTL     time.Duration
	UploadTTL      time.Duration
	Retention      time.Duration // 0 = keep forever
	MaxEvidence    int           // per attempt
	Now            func() time.Time
}

func (c *Config) defaults() {
	if c.PresignTTL == 0 {
		c.PresignTTL = 15 * time.Minute
	}
	if c.UploadTTL == 0 {
		c.UploadTTL = 5 * time.Minute
	}
	if c.MaxEvidence == 0 {
		c.MaxEvidence = 600
	}
	if c.Now == nil {
		c.Now = time.Now
	}
}

type Server struct {
	cfg Config
	db  *DB
	st  Storage
	eg  Egress
	log *slog.Logger
	m   *obs.Metrics
}

func New(cfg Config, db *DB, st Storage, eg Egress, log *slog.Logger, m *obs.Metrics) *Server {
	cfg.defaults()
	return &Server{cfg: cfg, db: db, st: st, eg: eg, log: log, m: m}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/webhooks/livekit", s.handleWebhook)

	mux.HandleFunc("POST /v1/evidence/presign", s.handleEvidencePresign)
	mux.HandleFunc("POST /v1/evidence/{id}/commit", s.handleEvidenceCommit)
	mux.HandleFunc("PUT /v1/evidence/{id}/content", s.handleEvidenceContent)

	mux.HandleFunc("GET /v1/exams/{eid}/recordings", s.handleListExam)
	mux.HandleFunc("GET /v1/exams/{eid}/attempts/{aid}/recordings", s.handleListAttempt)
	mux.HandleFunc("GET /v1/recordings/{id}/url", s.handleURL)

	mux.HandleFunc("POST /internal/v1/egress/start", s.handleStart)
	mux.HandleFunc("POST /internal/v1/evidence", s.handleInternalEvidence)
	mux.HandleFunc("POST /internal/v1/recordings/{id}/stop", s.handleStop)
	mux.HandleFunc("DELETE /internal/v1/recordings/{id}", s.handleDelete)
	mux.HandleFunc("POST /internal/v1/exams/{eid}/purge", s.handlePurge)

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		if err := s.db.PingContext(r.Context()); err != nil {
			writeJSON(w, 503, map[string]any{"ok": false})
			return
		}
		writeJSON(w, 200, map[string]any{"ok": true})
	})
	mux.Handle("GET /metrics", s.m.Handler())
	return mux
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func newID() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func pathInt(r *http.Request, name string) int64 {
	n, _ := strconv.ParseInt(r.PathValue(name), 10, 64)
	return n
}

func (s *Server) claims(w http.ResponseWriter, r *http.Request) (auth.Claims, bool) {
	c, err := auth.Verify(s.cfg.JWTSecret, auth.BearerToken(r.Header.Get("Authorization")), s.cfg.Now())
	if err != nil {
		writeJSON(w, 401, map[string]any{"ok": false, "error": "invalid_token"})
		return c, false
	}
	return c, true
}

func (s *Server) proctor(w http.ResponseWriter, r *http.Request, examID int64) bool {
	c, ok := s.claims(w, r)
	if !ok {
		return false
	}
	if !c.CanWatch(examID) {
		writeJSON(w, 403, map[string]any{"ok": false, "error": "forbidden"})
		return false
	}
	return true
}

func (s *Server) internal(w http.ResponseWriter, r *http.Request) ([]byte, bool) {
	return s.internalLimited(w, r, 1<<16)
}

// internalLimited is internal() with a bigger body cap (pictures sent by the supervisor agent).
func (s *Server) internalLimited(w http.ResponseWriter, r *http.Request, max int64) ([]byte, bool) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, max))
	if err != nil {
		writeJSON(w, 413, map[string]any{"ok": false})
		return nil, false
	}
	if err := auth.VerifyBody(s.cfg.InternalSecret, body, r.Header.Get(auth.HeaderTimestamp), r.Header.Get(auth.HeaderSignature), s.cfg.Now(), 5*time.Minute); err != nil {
		writeJSON(w, 401, map[string]any{"ok": false, "error": "bad_signature"})
		return nil, false
	}
	return body, true
}

// handleInternalEvidence stores a picture sent by a trusted backend service (the supervisor agent), signed like every
// internal call: POST /internal/v1/evidence?exam_id=&attempt_id=&org_id= with the image as the body.
func (s *Server) handleInternalEvidence(w http.ResponseWriter, r *http.Request) {
	body, ok := s.internalLimited(w, r, 2<<20)
	if !ok {
		return
	}
	q := r.URL.Query()
	examID, attemptID, orgID := queryInt(q.Get("exam_id")), queryInt(q.Get("attempt_id")), queryInt(q.Get("org_id"))
	ct := r.Header.Get("Content-Type")
	spec, known := evidenceTypes[ct]
	if examID <= 0 || attemptID <= 0 || !known || !strings.HasPrefix(ct, "image/") || len(body) == 0 || int64(len(body)) > spec.max {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "bad_request"})
		return
	}
	existing, _ := s.db.ListByAttempt(r.Context(), examID, attemptID)
	n := 0
	for _, e := range existing {
		if e.Kind == KindEvidence {
			n++
		}
	}
	if n >= s.cfg.MaxEvidence {
		writeJSON(w, 429, map[string]any{"ok": false, "error": "evidence_quota"})
		return
	}
	now := s.cfg.Now()
	id := newID()
	key := fmt.Sprintf("evidence/%d/%d/%s.%s", examID, attemptID, id, spec.ext)
	if err := s.st.Put(r.Context(), key, ct, strings.NewReader(string(body)), int64(len(body))); err != nil {
		writeJSON(w, 503, map[string]any{"ok": false, "error": "storage_unavailable"})
		return
	}
	rec := Recording{ID: id, ExamID: examID, AttemptID: attemptID, OrgID: orgID, Kind: KindEvidence, ObjectKey: key, Status: StatusReady, Mime: ct, SizeBytes: int64(len(body)), CreatedAt: now.UnixMilli()}
	if err := s.db.Insert(r.Context(), rec); err != nil {
		_ = s.st.Delete(r.Context(), key)
		writeJSON(w, 503, map[string]any{"ok": false})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "evidence_id": id})
}

func queryInt(v string) int64 {
	n, _ := strconv.ParseInt(v, 10, 64)
	return n
}

// ---------------------------------------------------------------- LiveKit webhook -> egress

func parseRoom(name string) (examID int64, ok bool) {
	if !strings.HasPrefix(name, "exam-") {
		return 0, false
	}
	n, err := strconv.ParseInt(strings.TrimPrefix(name, "exam-"), 10, 64)
	return n, err == nil && n > 0
}

func parseIdentity(id string) (attemptID int64, ok bool) {
	if !strings.HasPrefix(id, "attempt-") {
		return 0, false
	}
	n, err := strconv.ParseInt(strings.TrimPrefix(id, "attempt-"), 10, 64)
	return n, err == nil && n > 0
}

func (s *Server) handleWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		writeJSON(w, 413, map[string]any{"ok": false})
		return
	}
	ev, err := ParseWebhook(s.cfg.LiveKitKey, s.cfg.LiveKitSecret, r.Header.Get("Authorization"), body, s.cfg.Now())
	if errors.Is(err, ErrWebhookAuth) {
		writeJSON(w, 401, map[string]any{"ok": false, "error": "bad_webhook"})
		return
	}
	if err != nil { // authentic but not understood: acknowledge so LiveKit does not retry it forever
		s.log.Warn("unreadable livekit webhook", "err", err)
		writeJSON(w, 200, map[string]any{"ok": true})
		return
	}
	s.m.Inc("record_webhooks_total")
	ctx := r.Context()

	switch ev.Event {
	case "track_published":
		eid, ok1 := parseRoom(ev.Room.Name)
		aid, ok2 := parseIdentity(ev.Participant.Identity)
		if !ok1 || !ok2 {
			break // proctors / agents / unknown rooms are never recorded
		}
		var kind string
		switch ev.Track.Source {
		case "CAMERA":
			kind = KindCamera
		case "SCREEN_SHARE":
			kind = KindScreen
		}
		if kind == "" {
			break
		}
		var meta struct {
			OrgID int64 `json:"oid"`
		}
		_ = json.Unmarshal([]byte(ev.Participant.Metadata), &meta)
		if _, err := s.startRecording(ctx, eid, aid, meta.OrgID, kind); err != nil {
			s.log.Warn("start recording failed", "exam", eid, "attempt", aid, "kind", kind, "err", err)
		}
	case "egress_ended":
		if ev.EgressInfo != nil {
			s.finishEgress(ctx, *ev.EgressInfo)
		}
	}
	writeJSON(w, 200, map[string]any{"ok": true}) // always 200: LiveKit retries on errors, we only log
}

// startRecording starts an egress for (attempt, kind) unless one is already running.
func (s *Server) startRecording(ctx context.Context, examID, attemptID, orgID int64, kind string) (Recording, error) {
	return s.startRecordingIn(ctx, examID, attemptID, orgID, kind, "", "")
}

// startRecordingIn records one participant. room / identity default to the candidate's own (exam room, attempt-N);
// the phone camera passes its private room and identity "phone".
func (s *Server) startRecordingIn(ctx context.Context, examID, attemptID, orgID int64, kind, room, identity string) (Recording, error) {
	if cur, err := s.db.Active(ctx, attemptID, kind); err == nil {
		return cur, nil // idempotent: reconnects republish tracks
	}
	now := s.cfg.Now()
	id := newID()
	key := fmt.Sprintf("recordings/%d/%d/%s-%d.mp4", examID, attemptID, kind, now.Unix())
	rec := Recording{ID: id, ExamID: examID, AttemptID: attemptID, OrgID: orgID, Kind: kind, ObjectKey: key, Mime: "video/mp4", StartedAt: now.UnixMilli(), CreatedAt: now.UnixMilli()}

	if room == "" {
		room = fmt.Sprintf("exam-%d", examID)
	}
	if identity == "" {
		identity = fmt.Sprintf("attempt-%d", attemptID)
	}
	egressID, err := s.eg.StartParticipant(ctx, room, identity, kind == KindScreen, key)
	if err != nil {
		rec.Status, rec.Error = StatusFailed, err.Error()
		_ = s.db.Insert(ctx, rec) // keep a visible trace so the proctor knows the video is missing
		s.m.Inc("record_start_failures_total")
		return rec, err
	}
	rec.EgressID, rec.Status = egressID, StatusRecording
	if err := s.db.Insert(ctx, rec); err != nil {
		_ = s.eg.Stop(ctx, egressID)
		return rec, err
	}
	s.m.Inc("record_started_total")
	return rec, nil
}

func (s *Server) finishEgress(ctx context.Context, info EgressInfo) {
	rec, err := s.db.ByEgress(ctx, info.EgressID)
	if err != nil {
		return
	}
	end := s.cfg.Now().UnixMilli()
	switch info.Status {
	case "EGRESS_COMPLETE":
		var size, dur int64
		if len(info.FileResults) > 0 {
			size, dur = int64(info.FileResults[0].Size), int64(info.FileResults[0].Duration)/1_000_000
		}
		_ = s.db.Finish(ctx, rec.ID, StatusReady, "", "", size, dur, end)
		s.m.Inc("record_completed_total")
	case "EGRESS_FAILED", "EGRESS_ABORTED", "EGRESS_LIMIT_REACHED":
		_ = s.db.Finish(ctx, rec.ID, StatusFailed, firstNonEmpty(info.Error, info.Status), "", 0, 0, end)
		s.m.Inc("record_failed_total")
	}
}

func firstNonEmpty(a ...string) string {
	for _, v := range a {
		if v != "" {
			return v
		}
	}
	return ""
}

// ---------------------------------------------------------------- evidence (candidate uploads straight to storage)

var evidenceTypes = map[string]struct {
	ext string
	max int64
}{
	"image/jpeg": {"jpg", 8 << 20},
	"image/png":  {"png", 8 << 20},
	"image/webp": {"webp", 8 << 20},
	"video/webm": {"webm", 60 << 20},
	"video/mp4":  {"mp4", 60 << 20},
}

func (s *Server) handleEvidencePresign(w http.ResponseWriter, r *http.Request) {
	c, ok := s.claims(w, r)
	if !ok {
		return
	}
	if c.Role != auth.RoleCandidate || c.AttemptID == 0 {
		writeJSON(w, 403, map[string]any{"ok": false, "error": "forbidden"})
		return
	}
	var req struct {
		ContentType string `json:"content_type"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<12)).Decode(&req) != nil {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "bad_json"})
		return
	}
	spec, ok := evidenceTypes[req.ContentType]
	if !ok {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "content_type_not_allowed"})
		return
	}
	existing, _ := s.db.ListByAttempt(r.Context(), c.ExamID, c.AttemptID)
	n := 0
	for _, e := range existing {
		if e.Kind == KindEvidence {
			n++
		}
	}
	if n >= s.cfg.MaxEvidence {
		writeJSON(w, 429, map[string]any{"ok": false, "error": "evidence_quota"})
		return
	}
	now := s.cfg.Now()
	id := newID()
	key := fmt.Sprintf("evidence/%d/%d/%s.%s", c.ExamID, c.AttemptID, id, spec.ext)
	url, err := s.st.PresignPut(r.Context(), key, req.ContentType, s.cfg.UploadTTL)
	if err != nil {
		writeJSON(w, 503, map[string]any{"ok": false, "error": "storage_unavailable"})
		return
	}
	rec := Recording{ID: id, ExamID: c.ExamID, AttemptID: c.AttemptID, OrgID: c.OrgID, Kind: KindEvidence, ObjectKey: key, Status: StatusPendingUpload, Mime: req.ContentType, CreatedAt: now.UnixMilli()}
	if err := s.db.Insert(r.Context(), rec); err != nil {
		writeJSON(w, 503, map[string]any{"ok": false})
		return
	}
	writeJSON(w, 200, map[string]any{
		"ok": true, "evidence_id": id, "upload_url": url, "method": "PUT",
		"headers": map[string]string{"Content-Type": req.ContentType}, "content_url": fmt.Sprintf("/v1/evidence/%s/content", id), "max_bytes": spec.max, "expires_in": int(s.cfg.UploadTTL.Seconds()),
	})
}

// handleEvidenceContent receives the file itself and stores it: the candidate machine only ever talks to this
// service, so object storage stays private. The size limit and content type are those given at presign time.
func (s *Server) handleEvidenceContent(w http.ResponseWriter, r *http.Request) {
	c, ok := s.claims(w, r)
	if !ok {
		return
	}
	rec, err := s.db.Get(r.Context(), r.PathValue("id"))
	if err != nil || rec.Kind != KindEvidence || rec.AttemptID != c.AttemptID || c.Role != auth.RoleCandidate {
		writeJSON(w, 404, map[string]any{"ok": false, "error": "not_found"})
		return
	}
	if rec.Status != StatusPendingUpload {
		writeJSON(w, 409, map[string]any{"ok": false, "error": "already_uploaded"})
		return
	}
	spec := evidenceTypes[rec.Mime]
	if ct := r.Header.Get("Content-Type"); ct != rec.Mime {
		writeJSON(w, 415, map[string]any{"ok": false, "error": "content_type_mismatch"})
		return
	}
	if r.ContentLength <= 0 || r.ContentLength > spec.max {
		writeJSON(w, 413, map[string]any{"ok": false, "error": "too_large"})
		return
	}
	if err := s.st.Put(r.Context(), rec.ObjectKey, rec.Mime, http.MaxBytesReader(w, r.Body, spec.max), r.ContentLength); err != nil {
		writeJSON(w, 503, map[string]any{"ok": false, "error": "storage_unavailable"})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) handleEvidenceCommit(w http.ResponseWriter, r *http.Request) {
	c, ok := s.claims(w, r)
	if !ok {
		return
	}
	rec, err := s.db.Get(r.Context(), r.PathValue("id"))
	if err != nil || rec.Kind != KindEvidence || rec.AttemptID != c.AttemptID || c.Role != auth.RoleCandidate {
		writeJSON(w, 404, map[string]any{"ok": false, "error": "not_found"})
		return
	}
	size, err := s.st.Stat(r.Context(), rec.ObjectKey)
	if err != nil {
		writeJSON(w, 409, map[string]any{"ok": false, "error": "not_uploaded"})
		return
	}
	if max := evidenceTypes[rec.Mime].max; max > 0 && size > max {
		_ = s.st.Delete(r.Context(), rec.ObjectKey)
		_ = s.db.Finish(r.Context(), rec.ID, StatusFailed, "too_large", "", size, 0, s.cfg.Now().UnixMilli())
		writeJSON(w, 413, map[string]any{"ok": false, "error": "too_large"})
		return
	}
	_ = s.db.SetSize(r.Context(), rec.ID, size)
	rec.Status, rec.SizeBytes = StatusReady, size
	writeJSON(w, 200, map[string]any{"ok": true, "recording": rec})
}

// ---------------------------------------------------------------- reads for proctors

func (s *Server) withURLs(ctx context.Context, list []Recording, want bool) []Recording {
	if !want {
		return list
	}
	for i := range list {
		if list[i].Status == StatusReady && list[i].ObjectKey != "" {
			if u, err := s.st.PresignGet(ctx, list[i].ObjectKey, s.cfg.PresignTTL); err == nil {
				list[i].URL = u
			}
		}
	}
	return list
}

func (s *Server) handleListExam(w http.ResponseWriter, r *http.Request) {
	eid := pathInt(r, "eid")
	if !s.proctor(w, r, eid) {
		return
	}
	list, err := s.db.ListByExam(r.Context(), eid)
	if err != nil {
		writeJSON(w, 503, map[string]any{"ok": false})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "recordings": s.withURLs(r.Context(), nonNil(list), r.URL.Query().Get("urls") == "1")})
}

func (s *Server) handleListAttempt(w http.ResponseWriter, r *http.Request) {
	eid, aid := pathInt(r, "eid"), pathInt(r, "aid")
	if !s.proctor(w, r, eid) {
		return
	}
	list, err := s.db.ListByAttempt(r.Context(), eid, aid)
	if err != nil {
		writeJSON(w, 503, map[string]any{"ok": false})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "recordings": s.withURLs(r.Context(), nonNil(list), true)})
}

func nonNil(l []Recording) []Recording {
	if l == nil {
		return []Recording{}
	}
	return l
}

func (s *Server) handleURL(w http.ResponseWriter, r *http.Request) {
	c, ok := s.claims(w, r)
	if !ok {
		return
	}
	rec, err := s.db.Get(r.Context(), r.PathValue("id"))
	// 404 (not 403) for other exams: do not reveal that the id exists
	if err != nil || !c.CanWatch(rec.ExamID) {
		writeJSON(w, 404, map[string]any{"ok": false, "error": "not_found"})
		return
	}
	if rec.Status != StatusReady {
		writeJSON(w, 409, map[string]any{"ok": false, "error": "not_ready", "status": rec.Status})
		return
	}
	u, err := s.st.PresignGet(r.Context(), rec.ObjectKey, s.cfg.PresignTTL)
	if err != nil {
		writeJSON(w, 503, map[string]any{"ok": false})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "url": u, "expires_in": int(s.cfg.PresignTTL.Seconds()), "mime": rec.Mime})
}

// ---------------------------------------------------------------- internal control (Laravel)

func (s *Server) handleStart(w http.ResponseWriter, r *http.Request) {
	body, ok := s.internal(w, r)
	if !ok {
		return
	}
	var req struct {
		ExamID    int64  `json:"exam_id"`
		AttemptID int64  `json:"attempt_id"`
		OrgID     int64  `json:"org_id"`
		Kind      string `json:"kind"`
		Room      string `json:"room"`
		Identity  string `json:"identity"`
	}
	if json.Unmarshal(body, &req) != nil || req.ExamID == 0 || req.AttemptID == 0 || (req.Kind != KindCamera && req.Kind != KindScreen && req.Kind != KindCamera2) {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "bad_request"})
		return
	}
	if req.Kind == KindCamera2 && (!strings.HasPrefix(req.Room, "cam2-") || req.Identity != "phone") {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "camera2_needs_its_room"})
		return
	}
	rec, err := s.startRecordingIn(r.Context(), req.ExamID, req.AttemptID, req.OrgID, req.Kind, req.Room, req.Identity)
	if err != nil {
		writeJSON(w, 502, map[string]any{"ok": false, "error": err.Error(), "recording": rec})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "recording": rec})
}

func (s *Server) handleStop(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.internal(w, r); !ok {
		return
	}
	rec, err := s.db.Get(r.Context(), r.PathValue("id"))
	if err != nil || rec.Status != StatusRecording {
		writeJSON(w, 404, map[string]any{"ok": false, "error": "not_recording"})
		return
	}
	if err := s.eg.Stop(r.Context(), rec.EgressID); err != nil {
		writeJSON(w, 502, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true}) // the egress_ended webhook finalizes the row
}

func (s *Server) deleteOne(ctx context.Context, rec Recording) error {
	if rec.ObjectKey != "" {
		_ = s.st.Delete(ctx, rec.ObjectKey) // best effort: a missing object is fine
	}
	return s.db.SetStatus(ctx, rec.ID, StatusDeleted)
}

func (s *Server) handleDelete(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.internal(w, r); !ok {
		return
	}
	rec, err := s.db.Get(r.Context(), r.PathValue("id"))
	if err != nil {
		writeJSON(w, 404, map[string]any{"ok": false})
		return
	}
	if err := s.deleteOne(r.Context(), rec); err != nil {
		writeJSON(w, 503, map[string]any{"ok": false})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) handlePurge(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.internal(w, r); !ok {
		return
	}
	list, err := s.db.ListByExam(r.Context(), pathInt(r, "eid"))
	if err != nil {
		writeJSON(w, 503, map[string]any{"ok": false})
		return
	}
	n := 0
	for _, rec := range list {
		if s.deleteOne(r.Context(), rec) == nil {
			n++
		}
	}
	writeJSON(w, 200, map[string]any{"ok": true, "deleted": n})
}

// Sweep deletes recordings older than the retention period. Run it periodically.
func (s *Server) Sweep(ctx context.Context) (int, error) {
	if s.cfg.Retention <= 0 {
		return 0, nil
	}
	old, err := s.db.Expired(ctx, s.cfg.Now().Add(-s.cfg.Retention), 500)
	if err != nil {
		return 0, err
	}
	n := 0
	for _, rec := range old {
		if s.deleteOne(ctx, rec) == nil {
			n++
		}
	}
	s.m.Add("record_swept_total", int64(n))
	return n, nil
}
