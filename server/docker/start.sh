#!/bin/sh
# Container entrypoint: prepare Laravel, migrate, then hand over to FrankenPHP (Caddy).
set -e
cd /app

mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true

# the public disk (question media uploads)
php artisan storage:link --force >/dev/null 2>&1 || true

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo ">> migrating database"
  php artisan migrate --force
fi

# production caches (config reads env at runtime in the container, so this is safe here)
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo ">> starting FrankenPHP on ${SERVER_NAME}"
exec frankenphp run --config /etc/frankenphp/Caddyfile --adapter caddyfile
