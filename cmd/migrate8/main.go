package main

import (
	"log"

	"github.com/quanghuyvfarm79/vframotp/internal/config"
	"github.com/quanghuyvfarm79/vframotp/internal/repository"
)

func main() {
	cfg := config.Load()
	db := repository.NewDB(cfg)
	sqlDB, _ := db.DB()
	defer sqlDB.Close()

	_, err := sqlDB.Exec(`ALTER TABLE providers ADD COLUMN IF NOT EXISTS allow_renew BOOLEAN NOT NULL DEFAULT true`)
	if err != nil {
		log.Fatalf("Migration failed: %v", err)
	}
	log.Println("Migration applied: providers.allow_renew")
}
