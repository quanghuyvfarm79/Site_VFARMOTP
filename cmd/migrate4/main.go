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

	_, err := sqlDB.Exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS raw_api_key TEXT NOT NULL DEFAULT ''`)
	if err != nil {
		log.Fatalf("Migration failed: %v", err)
	}
	log.Println("Migration done: users.raw_api_key added")
}
