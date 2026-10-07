// foxy-ingest: batch telemetry gateway for FoxyClient (see internal/ingest).
package main

import (
	"os"
	"time"

	"github.com/foxyexam/realtime/internal/config"
	"github.com/foxyexam/realtime/internal/ingest"
	"github.com/foxyexam/realtime/internal/obs"
	"github.com/foxyexam/realtime/internal/serve"
	"github.com/foxyexam/realtime/internal/store"
)

func main() {
	log := obs.Logger("ingest")
	ctx, stop := serve.Context()
	defer stop()

	rdb, err := serve.Redis(ctx, config.Str("REDIS_URL", "redis://localhost:6379/0"))
	if err != nil {
		log.Error("redis", "err", err)
		os.Exit(1)
	}
	s := ingest.New(ingest.Config{
		JWTSecret:      []byte(config.Must("RT_JWT_SECRET")),
		InternalSecret: []byte(config.Must("RT_INTERNAL_SECRET")),
		RatePerSec:     float64(config.Int("INGEST_RATE_PER_SEC", 5)),
		Burst:          config.Int("INGEST_BURST", 20),
		FlushInterval:  config.Dur("INGEST_FLUSH_INTERVAL", time.Second),
		ShedInflight:   config.Int("INGEST_SHED_INFLIGHT", 2000),
	}, store.New(rdb), log, obs.NewMetrics())

	if err := serve.Run(ctx, ":"+config.Str("PORT", "8081"), serve.CORS(s.Handler(), serve.Origins("CORS_ORIGINS")), log, 20*time.Second); err != nil {
		log.Error("server", "err", err)
		os.Exit(1)
	}
}
