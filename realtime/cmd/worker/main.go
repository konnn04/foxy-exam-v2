// foxy-worker: drains the event stream in bulk into the Laravel core (see internal/worker).
package main

import (
	"net/http"
	"os"
	"time"

	"github.com/foxyexam/realtime/internal/config"
	"github.com/foxyexam/realtime/internal/obs"
	"github.com/foxyexam/realtime/internal/serve"
	"github.com/foxyexam/realtime/internal/store"
	"github.com/foxyexam/realtime/internal/worker"
)

func main() {
	log := obs.Logger("worker")
	ctx, stop := serve.Context()
	defer stop()

	rdb, err := serve.Redis(ctx, config.Str("REDIS_URL", "redis://localhost:6379/0"))
	if err != nil {
		log.Error("redis", "err", err)
		os.Exit(1)
	}
	m := obs.NewMetrics()

	var arch worker.Archiver
	if ep := config.Str("S3_ENDPOINT", ""); ep != "" {
		a, err := worker.NewS3Archiver(ep, config.Must("S3_ACCESS_KEY"), config.Must("S3_SECRET_KEY"), config.Str("S3_BUCKET", "foxy-records"), config.Bool("S3_SSL", false))
		if err != nil {
			log.Error("s3", "err", err)
			os.Exit(1)
		}
		go serve.Until(ctx, log, "s3 bucket", a.EnsureBucket)
		arch = a
	} else {
		log.Warn("S3_ENDPOINT not set: raw keystroke streams are NOT archived")
	}

	host, _ := os.Hostname()
	w := worker.New(worker.Config{
		Consumer:  config.Str("WORKER_NAME", "worker-"+host),
		BatchSize: int64(config.Int("WORKER_BATCH", 500)),
	}, store.New(rdb), worker.NewLaravelSink(config.Must("LARAVEL_BULK_URL"), []byte(config.Must("RT_INTERNAL_SECRET"))), arch, log, m)

	go func() { // metrics + health only
		mux := http.NewServeMux()
		mux.Handle("GET /metrics", m.Handler())
		mux.HandleFunc("GET /healthz", func(rw http.ResponseWriter, _ *http.Request) { _, _ = rw.Write([]byte(`{"ok":true}`)) })
		_ = serve.Run(ctx, ":"+config.Str("PORT", "8084"), mux, log, 5*time.Second)
	}()

	if err := w.Run(ctx); err != nil {
		log.Error("worker", "err", err)
		os.Exit(1)
	}
}
