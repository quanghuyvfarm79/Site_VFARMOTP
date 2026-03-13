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

	_, err := sqlDB.Exec(`ALTER TABLE providers ADD COLUMN IF NOT EXISTS key_otp_done TEXT NOT NULL DEFAULT ''`)
	if err != nil {
		log.Fatalf("Migration failed: %v", err)
	}
	log.Println("Migration applied: providers.key_otp_done")
}
