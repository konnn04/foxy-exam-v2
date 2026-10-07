# ==============================================================================
# 🦊 FOXY EXAM — API GATEWAY DOCKERFILE
# ==============================================================================

FROM nginx:1.27-alpine

# Install bash and openssl for auto SSL certificate generation & envsubst
RUN apk add --no-cache bash openssl

# ------------------------------------------------------------------------------
# Pre-configured Default Domain & Service Upstreams
# (Convenient out-of-the-box defaults; can be overridden at runtime via -e)
# ------------------------------------------------------------------------------
ENV APP_DOMAIN=foxyexam.com \
    SERVER_NAME="foxyexam.com *.foxyexam.com localhost 127.0.0.1" \
    CORE_HOST=app:8000 \
    REVERB_HOST=app:8080 \
    AI_HOST=ai-worker:8000 \
    LIVEKIT_HOST=livekit:7880 \
    INGEST_HOST=ingest:8081 \
    HUB_HOST=hub:8082 \
    RECORD_HOST=record:8083 \
    GATEWAY_TLS=on \
    SSL_CERT_PATH=/etc/nginx/certs/fullchain.pem \
    SSL_KEY_PATH=/etc/nginx/certs/privkey.pem \
    CLIENT_MAX_BODY_SIZE=100M

# Create directories
RUN mkdir -p /etc/nginx/templates /etc/nginx/certs /var/www/certbot

# Copy core Nginx config and service routing templates
COPY nginx.conf /etc/nginx/nginx.conf
COPY templates/ /etc/nginx/templates/

# Copy custom entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Ingress ports: HTTP and HTTPS
EXPOSE 80 443

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:80/gateway-health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
