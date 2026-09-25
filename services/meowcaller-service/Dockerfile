# Stage 1: Build do binário Go puro sem CGO
FROM golang:1.24-alpine AS builder

WORKDIR /build

# Instalar git e certificados
RUN apk add --no-cache git ca-certificates

# Copiar go.mod e go.sum
COPY go.mod go.sum ./
RUN go mod download

# Copiar código-fonte
COPY cmd/ cmd/
COPY internal/ internal/

# Compilação estática sem CGO
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /build/meowcaller-server ./cmd/server

# Stage 2: Runtime enxuto e seguro
FROM alpine:3.21

RUN apk add --no-cache ca-certificates curl tzdata

# Criar usuário não-root e diretório de sessão segura
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    mkdir -p /data && chown -R appuser:appgroup /data

WORKDIR /app
COPY --from=builder /build/meowcaller-server /app/meowcaller-server

USER appuser
EXPOSE 8002

ENV PORT=8002 \
    WHATSAPP_SESSION_PATH=/data/whatsapp.db

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8002}/health || exit 1

ENTRYPOINT ["/app/meowcaller-server"]
