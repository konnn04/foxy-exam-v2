// foxy-hub: WebSocket fan-out of live exam-room state to proctors (see internal/hub).
package main

import (
	"os"
	"strings"
	"time"

	"github.com/foxyexam/realtime/internal/config"
	"github.com/foxyexam/realtime/internal/hub"
	"github.com/foxyexam/realtime/internal/obs"
	"github.com/foxyexam/realtime/internal/serve"
	"github.com/foxyexam/realtime/internal/store"
)

func main() {
	log := obs.Logger("hub")
	ctx, stop := serve.Context()
	defer stop()

	rdb, err := serve.Redis(ctx, config.Str("REDIS_URL", "redis://localhost:6379/0"))
	if err != nil {
		log.Error("redis", "err", err)
		os.Exit(1)
	}
	var origins []string
	for _, o := range strings.Split(config.Str("ALLOWED_ORIGINS", "*"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			origins = append(origins, o)
		}
	}
	h := hub.New(hub.Config{
		JWTSecret:      []byte(config.Must("RT_JWT_SECRET")),
		Tick:           config.Dur("HUB_TICK", time.Second),
		OfflineAfter:   config.Dur("HUB_OFFLINE_AFTER", 20*time.Second),
		OriginPatterns: origins,
	}, store.New(rdb), log, obs.NewMetrics())

	if err := serve.Run(ctx, ":"+config.Str("PORT", "8082"), serve.CORS(h.Handler(), serve.Origins("CORS_ORIGINS")), log, 0); err != nil {
		log.Error("server", "err", err)
		os.Exit(1)
	}
}
