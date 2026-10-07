# syntax=docker/dockerfile:1
# One image per service, one build: docker build --target ingest|hub|worker|record .

FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ENV CGO_ENABLED=0
RUN go build -trimpath -ldflags="-s -w" -o /out/foxy-ingest ./cmd/ingest \
 && go build -trimpath -ldflags="-s -w" -o /out/foxy-hub    ./cmd/hub \
 && go build -trimpath -ldflags="-s -w" -o /out/foxy-worker ./cmd/worker \
 && go build -trimpath -ldflags="-s -w" -o /out/foxy-record ./cmd/record

FROM alpine:3.20 AS base
RUN apk add --no-cache ca-certificates tzdata wget && adduser -D -u 10001 foxy
USER foxy

FROM base AS ingest
COPY --from=build /out/foxy-ingest /usr/local/bin/foxy
ENV PORT=8081
EXPOSE 8081
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8081/healthz || exit 1
ENTRYPOINT ["foxy"]

FROM base AS hub
COPY --from=build /out/foxy-hub /usr/local/bin/foxy
ENV PORT=8082
EXPOSE 8082
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8082/healthz || exit 1
ENTRYPOINT ["foxy"]

FROM base AS worker
COPY --from=build /out/foxy-worker /usr/local/bin/foxy
ENV PORT=8084
EXPOSE 8084
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8084/healthz || exit 1
ENTRYPOINT ["foxy"]

FROM base AS record
COPY --from=build /out/foxy-record /usr/local/bin/foxy
ENV PORT=8083
EXPOSE 8083
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8083/healthz || exit 1
ENTRYPOINT ["foxy"]
