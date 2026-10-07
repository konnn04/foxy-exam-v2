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
export LIVEKIT_HOST="${LIVEKIT_HOST:-livekit:7880}"
export SSL_CERT_PATH="${SSL_CERT_PATH:-/etc/nginx/certs/fullchain.pem}"
export SSL_KEY_PATH="${SSL_KEY_PATH:-/etc/nginx/certs/privkey.pem}"
export CLIENT_MAX_BODY_SIZE="${CLIENT_MAX_BODY_SIZE:-100M}"

echo ">> Configuration Parameters:"
echo "   - APP_DOMAIN:          ${APP_DOMAIN}"
echo "   - SERVER_NAME:         ${SERVER_NAME}"
echo "   - CORE_HOST (Laravel): ${CORE_HOST}"
echo "   - REVERB_HOST (WS):    ${REVERB_HOST}"
echo "   - AI_HOST:             ${AI_HOST}"
echo "   - LIVEKIT_HOST:        ${LIVEKIT_HOST}"
echo "   - SSL Cert:            ${SSL_CERT_PATH}"
echo "   - SSL Key:             ${SSL_KEY_PATH}"

# Ensure SSL directories exist
mkdir -p "$(dirname "${SSL_CERT_PATH}")"
mkdir -p "$(dirname "${SSL_KEY_PATH}")"
mkdir -p /var/www/certbot

# Auto-generate self-signed SSL if certificates do not exist
if [ ! -f "${SSL_CERT_PATH}" ] || [ ! -f "${SSL_KEY_PATH}" ]; then
    echo ">> [WARNING] SSL certificate or key not found. Generating self-signed fallback certificate..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "${SSL_KEY_PATH}" \
        -out "${SSL_CERT_PATH}" \
        -subj "/C=VN/ST=HCM/L=HoChiMinh/O=FoxyExam/OU=Gateway/CN=${APP_DOMAIN}" \
        -addext "subjectAltName=DNS:${APP_DOMAIN},DNS:*.${APP_DOMAIN},DNS:localhost,IP:127.0.0.1" \
        2>/dev/null
    echo ">> Self-signed certificate generated successfully at ${SSL_CERT_PATH}"
else
    echo ">> Using mounted SSL certificate from ${SSL_CERT_PATH}"
fi

# Render Nginx configuration template with envsubst
# Notice: Explicitly restrict variable list to prevent wiping Nginx runtime variables ($host, $remote_addr, etc.)
echo ">> Rendering /etc/nginx/conf.d/default.conf from template..."
envsubst '${SERVER_NAME} ${CORE_HOST} ${REVERB_HOST} ${AI_HOST} ${LIVEKIT_HOST} ${SSL_CERT_PATH} ${SSL_KEY_PATH} ${CLIENT_MAX_BODY_SIZE}' \
    < /etc/nginx/templates/foxy-gateway.conf.template \
    > /etc/nginx/conf.d/default.conf

# Test Nginx configuration
echo ">> Testing Nginx configuration..."
nginx -t

echo ">> Gateway initialization complete! Starting Nginx reverse proxy..."
exec "$@"
