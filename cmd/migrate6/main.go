package main

import (
	"log"

	"github.com/quanghuyvfarm79/vframotp/internal/config"
	"github.com/quanghuyvfarm79/vframotp/internal/repository"
)

func main() {
	cfg := config.Load()
	db := repository.NewDB(cfg)
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal(err)
	}
	defer sqlDB.Close()

	if _, err := sqlDB.Exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ua TEXT NOT NULL DEFAULT ''`); err != nil {
		log.Fatal("migrate failed:", err)
	}
	log.Println("migrate6: added last_login_ua to users ✅")
}
