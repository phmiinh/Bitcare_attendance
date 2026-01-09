package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"time-attendance-be/internal/app/bootstrap"
	"time-attendance-be/internal/config"
)
import _ "github.com/joho/godotenv/autoload"

func main() {
	cfg := config.Load()

	container := bootstrap.NewContainer(cfg)

	app := bootstrap.NewServer(container)
	bootstrap.RegisterRoutes(app, container)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Start leave scheduler in background
	go container.Leave.Service().StartScheduler(ctx)

	go func() {
		_ = app.Listen(cfg.HTTPAddr)
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = app.ShutdownWithContext(shutdownCtx)

	os.Exit(0)
}
