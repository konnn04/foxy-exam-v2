// foxy-record: recordings + evidence service (see internal/record).
package main

import (
	"context"
	"os"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	_ "modernc.org/sqlite"

	"github.com/foxyexam/realtime/internal/config"
	"github.com/foxyexam/realtime/internal/obs"
	"github.com/foxyexam/realtime/internal/record"
	"github.com/foxyexam/realtime/internal/serve"
)

func main() {
	log := obs.Logger("record")
	ctx, stop := serve.Context()
	defer stop()

	driver := config.Str("RECORD_DB_DRIVER", "sqlite") // sqlite | pgx
	db, err := record.Open(driver, config.Str("RECORD_DB_DSN", "file:record.db?_pragma=busy_timeout(5000)"))
	if err != nil {
		log.Error("db", "err", err)
		os.Exit(1)
	}

	region := config.Str("S3_REGION", "us-east-1")
	bucket := config.Str("S3_BUCKET", "foxy-records")
	store, err := record.NewS3Storage(config.Must("S3_ENDPOINT"), config.Str("S3_PUBLIC_ENDPOINT", ""), config.Must("S3_ACCESS_KEY"), config.Must("S3_SECRET_KEY"),
		bucket, region, config.Bool("S3_SSL", false), config.Bool("S3_PUBLIC_SSL", true))
	if err != nil {
		log.Error("s3", "err", err)
		os.Exit(1)
	}
	if err := store.EnsureBucket(ctx); err != nil {
		log.Warn("s3 bucket check failed", "err", err)
	}

	lkKey, lkSecret := config.Must("LIVEKIT_API_KEY"), config.Must("LIVEKIT_API_SECRET")
	eg := record.NewHTTPEgress(config.Str("LIVEKIT_URL", "http://livekit:7880"), lkKey, lkSecret, record.S3Output{
		AccessKey: config.Must("S3_ACCESS_KEY"), Secret: config.Must("S3_SECRET_KEY"), Region: region,
		Endpoint:       config.Str("EGRESS_S3_ENDPOINT", "http://"+config.Must("S3_ENDPOINT")), // as seen from the egress container
		Bucket:         bucket,
		ForcePathStyle: true,
	})

	m := obs.NewMetrics()
	s := record.New(record.Config{
		JWTSecret:      []byte(config.Must("RT_JWT_SECRET")),
		InternalSecret: []byte(config.Must("RT_INTERNAL_SECRET")),
		LiveKitKey:     lkKey, LiveKitSecret: lkSecret,
		Retention: time.Duration(config.Int("RECORD_RETENTION_DAYS", 0)) * 24 * time.Hour,
	}, db, store, eg, log, m)

	go func() {
		t := time.NewTicker(time.Hour)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				if n, err := s.Sweep(context.Background()); err != nil {
					log.Warn("sweep failed", "err", err)
				} else if n > 0 {
					log.Info("retention sweep", "deleted", n)
				}
			}
		}
	}()

	if err := serve.Run(ctx, ":"+config.Str("PORT", "8083"), serve.CORS(s.Handler(), serve.Origins("CORS_ORIGINS")), log, 30*time.Second); err != nil {
		log.Error("server", "err", err)
		os.Exit(1)
	}
}
