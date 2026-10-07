// Package serve runs an http.Handler with sane timeouts and graceful shutdown.
package serve

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
)

// Context is cancelled on SIGINT/SIGTERM.
func Context() (context.Context, context.CancelFunc) {
	return signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
}

// Redis connects from a redis:// URL and fails fast when unreachable.
func Redis(ctx context.Context, url string) (*redis.Client, error) {
	opt, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	opt.PoolSize = 64
	c := redis.NewClient(opt)
	pctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return c, c.Ping(pctx).Err()
}

// Run blocks until ctx is cancelled, then drains in-flight requests.
func Run(ctx context.Context, addr string, h http.Handler, log *slog.Logger, writeTimeout time.Duration) error {
	srv := &http.Server{
		Addr: addr, Handler: h,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      writeTimeout, // 0 for WebSocket services
		IdleTimeout:       90 * time.Second,
	}
	errc := make(chan error, 1)
	go func() { errc <- srv.ListenAndServe() }()
	log.Info("listening", "addr", addr)
	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	sctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(sctx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// CORS lets FoxyClient (Tauri WebView, origin tauri://localhost or http://tauri.localhost) and the admin UI call
// the services directly. Authentication is a bearer token in a header - never a cookie - so allowing any origin
// does not enable CSRF; restrict with CORS_ORIGINS (comma separated) if you prefer.
func CORS(next http.Handler, allowed []string) http.Handler {
	allowAll := len(allowed) == 0
	for _, a := range allowed {
		if a == "*" {
			allowAll = true
		}
	}
	ok := func(origin string) bool {
		if allowAll {
			return true
		}
		for _, a := range allowed {
			if a == origin {
				return true
			}
		}
		return false
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); origin != "" && ok(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
			w.Header().Set("Access-Control-Expose-Headers", "Retry-After")
			if r.Method == http.MethodOptions {
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Content-Encoding")
				w.Header().Set("Access-Control-Max-Age", "600")
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// Origins reads a comma separated list from the environment (empty = any origin).
func Origins(env string) []string {
	var out []string
	for _, o := range strings.Split(os.Getenv(env), ",") {
		if o = strings.TrimSpace(o); o != "" {
			out = append(out, o)
		}
	}
	return out
}

// Until retries fn with backoff (1s..15s) until it succeeds or ctx ends; used for dependencies that may boot later.
func Until(ctx context.Context, log *slog.Logger, what string, fn func(context.Context) error) {
	for wait := time.Second; ; wait = min(wait*2, 15*time.Second) {
		err := fn(ctx)
		if err == nil {
			return
		}
		log.Warn("not ready, retrying", "what", what, "err", err, "in", wait.String())
		select {
		case <-ctx.Done():
			return
		case <-time.After(wait):
		}
	}
}
