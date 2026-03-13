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

	_, err := sqlDB.Exec(`CREATE INDEX IF NOT EXISTS idx_transactions_status_created ON transactions(status, created_at)`)
	if err != nil {
		log.Fatalf("Migration failed: %v", err)
	}
	log.Println("Migration applied: idx_transactions_status_created")
}
