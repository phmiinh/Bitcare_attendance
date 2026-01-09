package logger

import (
	"time-attendance-be/internal/config"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func New(cfg *config.Config) *zap.Logger {
	var log *zap.Logger
	if cfg.IsDevelopment() {
		logCfg := zap.NewDevelopmentConfig()
		logCfg.EncoderConfig.TimeKey = "timestamp"
		logCfg.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
		log, _ = logCfg.Build()
	} else {
		logCfg := zap.NewProductionConfig()
		logCfg.EncoderConfig.TimeKey = "timestamp"
		logCfg.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
		log, _ = logCfg.Build()
	}
	return log.With(zap.String("app", "time-attendance-be"))
}

















