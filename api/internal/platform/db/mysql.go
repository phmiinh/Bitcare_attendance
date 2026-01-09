package db

import (
	"context"
	"fmt"
	"time"

	"time-attendance-be/internal/config"

	"go.uber.org/zap"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// NewMySQL initializes a new MySQL database connection using GORM.
func NewMySQL(cfg *config.Config, log *zap.Logger) *gorm.DB {
	// Log DSN without leaking password
	log.Info("db connecting", zap.String("dsn", cfg.DSNRedacted()))
	fmt.Println(cfg.DSN())
	db, err := gorm.Open(mysql.Open(cfg.DSN()), &gorm.Config{
		//Logger: logger.New(
		//	zap.NewStdLog(log.Named("gorm")),
		//	logger.Config{
		//		SlowThreshold:             200 * time.Millisecond,
		//		LogLevel:                  logger.Warn,
		//		IgnoreRecordNotFoundError: true,
		//		Colorful:                  cfg.IsDevelopment(),
		//	},
		//),
		//NowFunc: func() time.Time {
		//	return time.Now().In(cfg.TimeLocation())
		//},
	})
	if err != nil {
		log.Fatal("failed to connect database", zap.Error(err))
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal("failed to get sql.DB", zap.Error(err))
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	if cfg.IsDevelopment() {
		// Debug() enables detailed SQL logging
		db = db.Debug()
	}

	return db
}

// WithTx executes a function within a database transaction.
// If the function returns an error, the transaction is rolled back.
// Otherwise, it is committed.
func WithTx(ctx context.Context, db *gorm.DB, fn func(tx *gorm.DB) error) error {
	tx := db.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		}
	}()

	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit().Error
}
