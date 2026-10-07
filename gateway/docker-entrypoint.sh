#!/usr/bin/env bash
set -e

echo "🦊 ========================================================="
echo "🦊 Starting Foxy Exam API Gateway..."
echo "🦊 ========================================================="

# Default values if not set
export APP_DOMAIN="${APP_DOMAIN:-foxyexam.com}"
export SERVER_NAME="${SERVER_NAME:-foxyexam.com *.foxyexam.com localhost 127.0.0.1}"
export CORE_HOST="${CORE_HOST:-app:8000}"
export REVERB_HOST="${REVERB_HOST:-app:8080}"
export AI_HOST="${AI_HOST:-ai-worker:8000}"
export INGEST_HOST="${INGEST_HOST:-ingest:8081}"
export HUB_HOST="${HUB_HOST:-hub:8082}"
export RECORD_HOST="${RECORD_HOST:-record:8083}"
# GATEWAY_TLS=off -> plain HTTP on :80 (Coolify / Traefik terminates TLS); anything else -> HTTPS on :443
export GATEWAY_TLS="${GATEWAY_TLS:-on}"
export SSL_CERT_PATH="${SSL_CERT_PATH:-/etc/nginx/certs/fullchain.pem}"
export SSL_KEY_PATH="${SSL_KEY_PATH:-/etc/nginx/certs/privkey.pem}"
export CLIENT_MAX_BODY_SIZE="${CLIENT_MAX_BODY_SIZE:-100M}"

echo ">> Configuration Parameters:"
echo "   - APP_DOMAIN:          ${APP_DOMAIN}"
echo "   - SERVER_NAME:         ${SERVER_NAME}"
echo "   - CORE_HOST (Laravel): ${CORE_HOST}"
echo "   - REVERB_HOST (WS):    ${REVERB_HOST}"
echo "   - AI_HOST:             ${AI_HOST}"
echo "   - INGEST/HUB/RECORD:   ${INGEST_HOST} ${HUB_HOST} ${RECORD_HOST}"
echo "   - GATEWAY_TLS:         ${GATEWAY_TLS}"
echo "   - SSL Cert:            ${SSL_CERT_PATH}"
echo "   - SSL Key:             ${SSL_KEY_PATH}"

VARS='${SERVER_NAME} ${CORE_HOST} ${REVERB_HOST} ${AI_HOST} ${INGEST_HOST} ${HUB_HOST} ${RECORD_HOST} ${SSL_CERT_PATH} ${SSL_KEY_PATH} ${CLIENT_MAX_BODY_SIZE}'

# shared routes (core, realtime, ai) used by both server blocks
envsubst "$VARS" < /etc/nginx/templates/foxy-locations.inc.template > /etc/nginx/foxy-locations.inc

if [ "${GATEWAY_TLS}" = "off" ]; then
    echo ">> TLS is terminated upstream: rendering the plain-HTTP gateway"
    envsubst "$VARS" < /etc/nginx/templates/foxy-gateway.http.conf.template > /etc/nginx/conf.d/default.conf
else
    mkdir -p "$(dirname "${SSL_CERT_PATH}")" "$(dirname "${SSL_KEY_PATH}")" /var/www/certbot
    if [ ! -f "${SSL_CERT_PATH}" ] || [ ! -f "${SSL_KEY_PATH}" ]; then
        echo ">> [WARNING] SSL certificate or key not found. Generating self-signed fallback certificate..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048             -keyout "${SSL_KEY_PATH}" -out "${SSL_CERT_PATH}"             -subj "/C=VN/ST=HCM/L=HoChiMinh/O=FoxyExam/OU=Gateway/CN=${APP_DOMAIN}"             -addext "subjectAltName=DNS:${APP_DOMAIN},DNS:*.${APP_DOMAIN},DNS:localhost,IP:127.0.0.1" 2>/dev/null
    else
        echo ">> Using mounted SSL certificate from ${SSL_CERT_PATH}"
    fi
    envsubst "$VARS" < /etc/nginx/templates/foxy-gateway.conf.template > /etc/nginx/conf.d/default.conf
fi

# Test Nginx configuration
echo ">> Testing Nginx configuration..."
nginx -t

echo ">> Gateway initialization complete! Starting Nginx reverse proxy..."
exec "$@"
