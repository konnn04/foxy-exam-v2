// Package obs: structured logging and a dependency-free Prometheus text endpoint.
package obs

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"sort"
	"sync"
	"sync/atomic"
)

func Logger(service string) *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: levelFromEnv()})).With("svc", service)
}

func levelFromEnv() slog.Level {
	switch os.Getenv("LOG_LEVEL") {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	}
	return slog.LevelInfo
}

// Metrics is a set of named monotonic counters and gauges.
type Metrics struct {
	mu       sync.RWMutex
	counters map[string]*atomic.Int64
}

func NewMetrics() *Metrics { return &Metrics{counters: map[string]*atomic.Int64{}} }

func (m *Metrics) get(name string) *atomic.Int64 {
	m.mu.RLock()
	c, ok := m.counters[name]
	m.mu.RUnlock()
	if ok {
		return c
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if c, ok = m.counters[name]; !ok {
		c = &atomic.Int64{}
		m.counters[name] = c
	}
	return c
}

func (m *Metrics) Add(name string, n int64) { m.get(name).Add(n) }
func (m *Metrics) Inc(name string)          { m.get(name).Add(1) }
func (m *Metrics) Set(name string, n int64) { m.get(name).Store(n) }
func (m *Metrics) Value(name string) int64  { return m.get(name).Load() }

// Handler serves the metrics in Prometheus text format.
func (m *Metrics) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		m.mu.RLock()
		names := make([]string, 0, len(m.counters))
		for n := range m.counters {
			names = append(names, n)
		}
		m.mu.RUnlock()
		sort.Strings(names)
		w.Header().Set("Content-Type", "text/plain; version=0.0.4")
		for _, n := range names {
			fmt.Fprintf(w, "%s %d\n", n, m.get(n).Load())
		}
	})
}
