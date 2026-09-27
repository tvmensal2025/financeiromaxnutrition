# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build do binário Go com meowcaller + hypermeow (100% Pure Go)
# ─────────────────────────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder

WORKDIR /build

# Ferramentas de compilação
RUN apk add --no-cache git python3 ca-certificates tzdata

# Copiar os manifests
COPY go.mod ./

# Copiar código-fonte completo
COPY cmd/ cmd/
COPY internal/ internal/
COPY tools/ tools/
COPY patches/ patches/

# Resolve dependências
ENV GOSUMDB=off
ENV GONOSUMDB=*
ENV GOFLAGS=-mod=mod
RUN python3 tools/prepare_meowcaller.py && go mod tidy && go mod download

# Compilação estática sem CGO — meowcaller é 100% Pure Go
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s -extldflags=-static" \
    -o /build/meowcaller-server ./cmd/server

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime ultra-enxuto
# ─────────────────────────────────────────────────────────────────────────────
FROM alpine:3.21

RUN apk add --no-cache ca-certificates curl tzdata

# Usuário não-root e diretório de sessão persistente
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    mkdir -p /data && chown -R appuser:appgroup /data

WORKDIR /app
COPY --from=builder /build/meowcaller-server /app/meowcaller-server

USER appuser
EXPOSE 8002

ENV PORT=8002 \
    WHATSAPP_SESSION_PATH=/data/whatsapp.db \
    LOG_LEVEL=info \
    CALL_MAX_DURATION_SECONDS=300

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8002}/health || exit 1

ENTRYPOINT ["/app/meowcaller-server"]
