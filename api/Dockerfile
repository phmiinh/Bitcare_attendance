## Backend Dockerfile - Go (multi-stage, distroless)
## Build static binary for linux/amd64 and run on distroless.

FROM golang:1.22-alpine AS builder

WORKDIR /src

# Install build tools (if ever needed for CGO; we still build with CGO_DISABLED=0)
RUN apk add --no-cache ca-certificates git

# Cache Go modules first
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source
COPY . .

# Build static binary for linux/amd64
ENV CGO_ENABLED=0 GOOS=linux GOARCH=amd64
RUN go build -o /app/server ./main.go


# Minimal runtime image
FROM gcr.io/distroless/static-debian12 AS runtime

WORKDIR /app

COPY --from=builder /app/server /app/server

ENV PORT=8080
EXPOSE 8080

# NOTE: Kubernetes health probes will call HTTP GET /healthz on port 8080.
# TODO: Ensure backend actually exposes /healthz endpoint, or adjust probes accordingly.

ENTRYPOINT ["/app/server"]

