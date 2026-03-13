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
		CREATE INDEX IF NOT EXISTS idx_balance_logs_user_type_id
			ON balance_logs(user_id, type, id DESC)
	`)
	if err != nil {
		log.Fatalf("Migration failed: %v", err)
	}
	log.Println("Migration applied: idx_balance_logs_user_type_id")
}
