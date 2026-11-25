package record

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// Sealing after the exam: the core asks for it when an attempt ends (exam option "seal after exam"); SealSweep then
// encrypts every ready file of that attempt (recordings, evidence), replaces the plain object with the sealed one and
// drops cached plain clips. Files still being finalized are picked up on a later pass, within SealGrace.

var errSealDisabled = errors.New("sealing is not configured (RECORD_SEAL_KEY)")

func (s *Server) handleSealRequest(w http.ResponseWriter, r *http.Request) {
	body, ok := s.internal(w, r)
	if !ok {
		return
	}
	var req struct {
		ExamID int64 `json:"exam_id"`
	}
	aid := pathInt(r, "aid")
	if json.Unmarshal(body, &req) != nil || req.ExamID == 0 || aid == 0 {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "bad_request"})
		return
	}
	if len(s.cfg.SealKey) == 0 {
		writeJSON(w, 503, map[string]any{"ok": false, "error": "seal_disabled"})
		return
	}
	if err := s.db.RequestSeal(r.Context(), aid, req.ExamID, s.cfg.Now().UnixMilli()); err != nil {
		writeJSON(w, 503, map[string]any{"ok": false})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

// SealSweep encrypts the ready files of attempts whose seal was requested. Returns how many files it sealed.
func (s *Server) SealSweep(ctx context.Context) (int, error) {
	if len(s.cfg.SealKey) == 0 {
		return 0, nil
	}
	reqs, err := s.db.SealRequests(ctx, 50)
	if err != nil {
		return 0, err
	}
	sealed := 0
	for _, q := range reqs {
		list, err := s.db.ListByAttempt(ctx, q.ExamID, q.AttemptID)
		if err != nil {
			return sealed, err
		}
		pending := false
		for _, rec := range list {
			switch {
			case rec.Status == StatusRecording || rec.Status == StatusPendingUpload:
				pending = true
			case rec.Status == StatusReady && !rec.Sealed && rec.ObjectKey != "":
				if err := s.sealOne(ctx, rec); err != nil {
					s.log.Warn("seal failed", "recording", rec.ID, "err", err)
					pending = true // retried next pass
					continue
				}
				sealed++
			}
		}
		if !pending && s.cfg.Now().UnixMilli()-q.RequestedAt > s.cfg.SealGrace.Milliseconds() {
			_ = s.db.DoneSeal(ctx, q.AttemptID)
		}
	}
	s.m.Add("record_sealed_total", int64(sealed))
	return sealed, nil
}

func (s *Server) sealOne(ctx context.Context, rec Recording) error {
	body, err := s.st.Get(ctx, rec.ObjectKey)
	if err != nil {
		return err
	}
	defer body.Close()
	key := rec.ObjectKey + sealedSuffix
	plain, size, err := s.writeSealed(ctx, rec.ExamID, key, body)
	if err != nil {
		return err
	}
	if err := s.db.MarkSealed(ctx, rec.ID, key, size, plain); err != nil {
		_ = s.st.Delete(ctx, key)
		return err
	}
	// the plain bytes go only once the row points at the sealed copy
	_ = s.st.Delete(ctx, rec.ObjectKey)
	_ = s.st.DeletePrefix(ctx, "clips/"+rec.ID+"/")
	return nil
}

// putSealed stores src encrypted with the exam's key under key.
func (s *Server) putSealed(ctx context.Context, examID int64, key string, src io.Reader) error {
	_, _, err := s.writeSealed(ctx, examID, key, src)
	return err
}

func (s *Server) writeSealed(ctx context.Context, examID int64, key string, src io.Reader) (plain, size int64, err error) {
	dk, err := s.examKey(ctx, examID, true)
	if err != nil {
		return 0, 0, err
	}
	tmp, err := os.CreateTemp("", "seal-")
	if err != nil {
		return 0, 0, err
	}
	defer os.Remove(tmp.Name())
	defer tmp.Close()
	if plain, err = sealStream(tmp, src, dk); err != nil {
		return 0, 0, err
	}
	if size, err = tmp.Seek(0, io.SeekCurrent); err != nil {
		return 0, 0, err
	}
	if _, err := tmp.Seek(0, io.SeekStart); err != nil {
		return 0, 0, err
	}
	return plain, size, s.st.Put(ctx, key, "application/octet-stream", tmp, size)
}

// examKey returns the exam's data key, creating (and storing wrapped) a random one when asked to.
func (s *Server) examKey(ctx context.Context, examID int64, create bool) ([]byte, error) {
	if len(s.cfg.SealKey) == 0 {
		return nil, errSealDisabled
	}
	w, err := s.db.SealKey(ctx, examID)
	if err != nil {
		return nil, err
	}
	if w == "" {
		if !create {
			return nil, errors.New("seal: this exam has no key")
		}
		dk := make([]byte, 32)
		if _, err := rand.Read(dk); err != nil {
			return nil, err
		}
		wrapped, err := wrapKey(s.cfg.SealKey, dk)
		if err != nil {
			return nil, err
		}
		if err := s.db.PutSealKey(ctx, examID, wrapped, s.cfg.Now().UnixMilli()); err != nil {
			return nil, err
		}
		if w, err = s.db.SealKey(ctx, examID); err != nil { // another writer may have won: use the stored one
			return nil, err
		}
	}
	return unwrapKey(s.cfg.SealKey, w)
}

type readCloser struct {
	io.Reader
	io.Closer
}

// plainObject reads a recording's bytes, decrypting a sealed one.
func (s *Server) plainObject(ctx context.Context, rec Recording) (io.ReadCloser, error) {
	if !rec.Sealed {
		return s.st.Get(ctx, rec.ObjectKey)
	}
	ra, size, closer, err := s.st.OpenAt(ctx, rec.ObjectKey)
	if err != nil {
		return nil, err
	}
	dk, err := s.examKey(ctx, rec.ExamID, false)
	if err != nil {
		closer.Close()
		return nil, err
	}
	sr, err := openSealed(ra, size, dk)
	if err != nil {
		closer.Close()
		return nil, err
	}
	return readCloser{io.NewSectionReader(sr, 0, sr.Size()), closer}, nil
}

// playURL: a presigned storage URL for plain files; for sealed ones a short-lived signed URL of this service.
func (s *Server) playURL(ctx context.Context, key string, examID int64, mime string, sealed bool) (string, error) {
	if !sealed {
		return s.st.PresignGet(ctx, key, s.cfg.PresignTTL)
	}
	exp := strconv.FormatInt(s.cfg.Now().Add(s.cfg.PresignTTL).Unix(), 10)
	e := strconv.FormatInt(examID, 10)
	v := url.Values{"k": {key}, "e": {e}, "m": {mime}, "x": {exp}, "s": {s.sealedSig(key, e, mime, exp)}}
	return strings.TrimRight(s.cfg.PublicURL, "/") + "/v1/sealed?" + v.Encode(), nil
}

func (s *Server) sealedSig(key, exam, mime, exp string) string {
	k := sha256.Sum256(append([]byte("sealed-url|"), s.cfg.InternalSecret...))
	m := hmac.New(sha256.New, k[:])
	m.Write([]byte(key + "\n" + exam + "\n" + mime + "\n" + exp))
	return hex.EncodeToString(m.Sum(nil))
}

// handleSealed streams a sealed object decrypted, with HTTP Range support (a <video> seeks through it).
func (s *Server) handleSealed(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	key, exam, mime, exp := q.Get("k"), q.Get("e"), q.Get("m"), q.Get("x")
	if !hmac.Equal([]byte(q.Get("s")), []byte(s.sealedSig(key, exam, mime, exp))) || !strings.HasSuffix(key, sealedSuffix) {
		writeJSON(w, 403, map[string]any{"ok": false, "error": "bad_signature"})
		return
	}
	if until, err := strconv.ParseInt(exp, 10, 64); err != nil || s.cfg.Now().Unix() > until {
		writeJSON(w, 403, map[string]any{"ok": false, "error": "expired"})
		return
	}
	examID, _ := strconv.ParseInt(exam, 10, 64)
	dk, err := s.examKey(r.Context(), examID, false)
	if err != nil {
		writeJSON(w, 404, map[string]any{"ok": false, "error": "not_found"})
		return
	}
	ra, size, closer, err := s.st.OpenAt(r.Context(), key)
	if err != nil {
		writeJSON(w, 404, map[string]any{"ok": false, "error": "not_found"})
		return
	}
	defer closer.Close()
	sr, err := openSealed(ra, size, dk)
	if err != nil {
		writeJSON(w, 500, map[string]any{"ok": false, "error": "corrupt"})
		return
	}
	if mime == "" {
		mime = "application/octet-stream"
	}
	w.Header().Set("Content-Type", mime)
	w.Header().Set("Cache-Control", "private, no-store")
	http.ServeContent(w, r, "", time.Time{}, io.NewSectionReader(sr, 0, sr.Size()))
}
