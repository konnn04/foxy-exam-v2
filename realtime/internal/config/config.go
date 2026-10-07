// Package config reads the environment shared by every realtime service.
package config

import (
	"os"
	"strconv"
	"time"
)

func Str(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func Int(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func Dur(key string, def time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return def
}

func Bool(key string, def bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return def
}

// Must returns the variable or panics at start-up: a service must not boot with a missing secret.
func Must(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic("missing required environment variable " + key)
	}
	return v
}
