package record

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"
)

const (
	maxClipSeconds = 120
	clipTimeout    = 90 * time.Second
)

// Cutter writes src[from,to] (seconds) to dst as a small mp4.
type Cutter func(ctx context.Context, src, dst string, from, to float64) error

// FFmpegCutter re-encodes the slice: cutting on key frames only would shift the start by seconds.
func FFmpegCutter(bin string) Cutter {
	if bin == "" {
		bin = "ffmpeg"
	}
	return func(ctx context.Context, src, dst string, from, to float64) error {
		args := []string{"-y", "-v", "error", "-ss", fmt.Sprintf("%.3f", from), "-i", src, "-t", fmt.Sprintf("%.3f", to-from),
			"-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", dst}
		if out, err := exec.CommandContext(ctx, bin, args...).CombinedOutput(); err != nil {
			return fmt.Errorf("ffmpeg: %w: %s", err, out)
		}
		return nil
	}
}

func clipKey(id string, from, to int) string {
	return fmt.Sprintf("clips/%s/%d-%d.mp4", id, from, to)
}

// handleClip cuts [from,to] seconds of a recording (a violation and its surroundings) once and serves the cached cut afterwards.
func (s *Server) handleClip(w http.ResponseWriter, r *http.Request) {
	c, ok := s.claims(w, r)
	if !ok {
		return
	}
	rec, err := s.db.Get(r.Context(), r.PathValue("id"))
	if err != nil || !c.CanWatch(rec.ExamID) {
		writeJSON(w, 404, map[string]any{"ok": false, "error": "not_found"})
		return
	}
	if rec.Status != StatusReady || rec.Kind == KindEvidence {
		writeJSON(w, 409, map[string]any{"ok": false, "error": "not_ready"})
		return
	}
	from, e1 := strconv.Atoi(r.URL.Query().Get("from"))
	to, e2 := strconv.Atoi(r.URL.Query().Get("to"))
	if e1 != nil || e2 != nil || from < 0 || to <= from || to-from > maxClipSeconds {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "bad_range"})
		return
	}
	if rec.DurationMS > 0 && int64(from)*1000 >= rec.DurationMS {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "out_of_range"})
		return
	}
	key := clipKey(rec.ID, from, to)
	cached := true
	if _, err := s.st.Stat(r.Context(), key); err != nil {
		cached = false
		if s.cut == nil {
			writeJSON(w, 501, map[string]any{"ok": false, "error": "clips_disabled"})
			return
		}
		select {
		case s.clipSlots <- struct{}{}:
			defer func() { <-s.clipSlots }()
		case <-r.Context().Done():
			return
		}
		if err := s.makeClip(r.Context(), rec, key, from, to); err != nil {
			s.log.Error("clip", "id", rec.ID, "err", err)
			writeJSON(w, 502, map[string]any{"ok": false, "error": "clip_failed"})
			return
		}
	}
	u, err := s.st.PresignGet(r.Context(), key, s.cfg.PresignTTL)
	if err != nil {
		writeJSON(w, 503, map[string]any{"ok": false})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "url": u, "mime": "video/mp4", "cached": cached, "expires_in": int(s.cfg.PresignTTL.Seconds())})
}

func (s *Server) makeClip(ctx context.Context, rec Recording, key string, from, to int) error {
	ctx, cancel := context.WithTimeout(ctx, clipTimeout)
	defer cancel()
	dir, err := os.MkdirTemp("", "clip-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)

	src := filepath.Join(dir, "src")
	body, err := s.st.Get(ctx, rec.ObjectKey)
	if err != nil {
		return err
	}
	f, err := os.Create(src)
	if err != nil {
		body.Close()
		return err
	}
	_, err = io.Copy(f, body)
	body.Close()
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return err
	}

	dst := filepath.Join(dir, "clip.mp4")
	if err := s.cut(ctx, src, dst, float64(from), float64(to)); err != nil {
		return err
	}
	out, err := os.Open(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	st, err := out.Stat()
	if err != nil {
		return err
	}
	return s.st.Put(ctx, key, "video/mp4", out, st.Size())
}
