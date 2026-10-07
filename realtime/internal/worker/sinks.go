package worker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"github.com/foxyexam/realtime/internal/auth"
)

// LaravelSink posts batches to the core's signed internal endpoint.
type LaravelSink struct {
	URL    string // e.g. http://app:8000/api/internal/v1/events/bulk
	Secret []byte
	HTTP   *http.Client
}

func NewLaravelSink(url string, secret []byte) *LaravelSink {
	return &LaravelSink{URL: url, Secret: secret, HTTP: &http.Client{Timeout: 15 * time.Second}}
}

func (s *LaravelSink) Deliver(ctx context.Context, b Batch) error {
	body, _ := json.Marshal(b)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.URL, bytes.NewReader(body))
	if err != nil {
		return PermanentError{Msg: err.Error()}
	}
	ts, sig := auth.SignBody(s.Secret, body, time.Now())
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set(auth.HeaderTimestamp, ts)
	req.Header.Set(auth.HeaderSignature, sig)
	resp, err := s.HTTP.Do(req)
	if err != nil {
		return err // network: retry
	}
	defer resp.Body.Close()
	msg, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
	switch {
	case resp.StatusCode < 300:
		return nil
	case resp.StatusCode == 408 || resp.StatusCode == 429 || resp.StatusCode >= 500:
		return fmt.Errorf("core answered %d: %s", resp.StatusCode, msg) // retry
	default:
		return PermanentError{Msg: fmt.Sprintf("core answered %d: %s", resp.StatusCode, msg)}
	}
}

// S3Archiver stores chunks in MinIO / any S3 compatible bucket.
type S3Archiver struct {
	c      *minio.Client
	bucket string
}

func NewS3Archiver(endpoint, accessKey, secretKey, bucket string, useSSL bool) (*S3Archiver, error) {
	c, err := minio.New(endpoint, &minio.Options{Creds: credentials.NewStaticV4(accessKey, secretKey, ""), Secure: useSSL})
	if err != nil {
		return nil, err
	}
	return &S3Archiver{c: c, bucket: bucket}, nil
}

// EnsureBucket creates the bucket when missing.
func (a *S3Archiver) EnsureBucket(ctx context.Context) error {
	ok, err := a.c.BucketExists(ctx, a.bucket)
	if err != nil || ok {
		return err
	}
	return a.c.MakeBucket(ctx, a.bucket, minio.MakeBucketOptions{})
}

func (a *S3Archiver) Put(ctx context.Context, key string, gz []byte) error {
	_, err := a.c.PutObject(ctx, a.bucket, key, bytes.NewReader(gz), int64(len(gz)), minio.PutObjectOptions{ContentType: "application/gzip"})
	return err
}
