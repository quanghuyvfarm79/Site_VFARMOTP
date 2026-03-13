package repository

import (
	"log"

	"github.com/quanghuyvfarm79/vframotp/internal/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func NewDB(cfg *config.Config) *gorm.DB {
	gormCfg := &gorm.Config{}
	if cfg.AppEnv == "production" {
		gormCfg.Logger = logger.Default.LogMode(logger.Warn)
	}

	db, err := gorm.Open(postgres.Open(cfg.DSN()), gormCfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	return db
}
