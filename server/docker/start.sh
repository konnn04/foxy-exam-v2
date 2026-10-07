#!/bin/sh
# Container entrypoint: prepare Laravel, migrate, then hand over to FrankenPHP (Caddy).
set -e
cd /app

key_ok() {
  php -r '$k = getenv("APP_KEY") ?: ""; if (strpos($k, "base64:") === 0) { $k = base64_decode(substr($k, 7), true) ?: ""; } exit(strlen($k) === 32 ? 0 : 1);'
}

# no usable key supplied: keep one generated key on the storage volume so sessions survive restarts
if ! key_ok; then
  KEYFILE=storage/app/.app_key
  mkdir -p storage/app
  [ -s "$KEYFILE" ] || echo "base64:$(head -c 32 /dev/urandom | base64)" > "$KEYFILE"
  export APP_KEY="$(cat "$KEYFILE")"
  echo ">> APP_KEY missing or not 32 bytes: using the generated key in $KEYFILE" >&2
fi

mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true

# the public disk (question media uploads)
php artisan storage:link --force >/dev/null 2>&1 || true

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo ">> migrating database"
  php artisan migrate --force
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  php artisan foxy:seed-if-empty
fi

php artisan view:cache

echo ">> starting FrankenPHP on ${SERVER_NAME}"
exec frankenphp run --config /etc/frankenphp/Caddyfile --adapter caddyfile
