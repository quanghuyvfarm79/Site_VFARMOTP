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

	_, err := sqlDB.Exec(`
		ALTER TABLE providers
			ADD COLUMN IF NOT EXISTS key_otp_done    VARCHAR(255) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS allow_renew     BOOLEAN      NOT NULL DEFAULT true,
			ADD COLUMN IF NOT EXISTS auto_reset_used BOOLEAN      NOT NULL DEFAULT false
	`)
	if err != nil {
		log.Fatalf("Migration failed: %v", err)
	}
	log.Println("Migration applied: key_otp_done, allow_renew, auto_reset_used added to providers")
}
