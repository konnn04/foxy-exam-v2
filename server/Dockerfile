# syntax=docker/dockerfile:1
# FoxyExam core (Laravel 12 + Inertia) on FrankenPHP. Built for Linux / Coolify.

# ---- 1. frontend assets -------------------------------------------------------------------------
FROM node:22-alpine AS assets
WORKDIR /build
RUN corepack enable
COPY package.json pnpm-lock.yaml .npmrc* ./
RUN pnpm install --frozen-lockfile
COPY resources ./resources
COPY public ./public
COPY vite.config.ts tsconfig.json components.json ./
RUN pnpm exec vite build

# ---- 2. php dependencies ------------------------------------------------------------------------
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --ignore-platform-reqs

# ---- 3. runtime ---------------------------------------------------------------------------------
FROM dunglas/frankenphp:1-php8.3-alpine

RUN install-php-extensions pdo_pgsql pgsql redis bcmath pcntl zip opcache intl \
    && apk add --no-cache curl

WORKDIR /app
COPY --from=vendor /app/vendor ./vendor
COPY . .
COPY --from=assets /build/public/build ./public/build
COPY --from=vendor /usr/bin/composer /usr/bin/composer
RUN composer dump-autoload --optimize --no-dev --no-interaction \
    && mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache \
    && chmod +x docker/start.sh

# Caddy inside FrankenPHP serves plain HTTP on :8000; TLS is terminated by Coolify's proxy / the gateway.
ENV SERVER_NAME=":8000" \
    APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    INERTIA_SSR_ENABLED=false

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD curl -fsS http://127.0.0.1:8000/api/v1/health || exit 1
ENTRYPOINT ["/app/docker/start.sh"]
