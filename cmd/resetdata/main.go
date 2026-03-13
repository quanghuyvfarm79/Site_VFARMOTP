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

	tx, err := sqlDB.Begin()
	if err != nil {
		log.Fatalf("begin tx: %v", err)
	}

	steps := []struct {
		sql  string
		desc string
	}{
		{"TRUNCATE TABLE transactions RESTART IDENTITY CASCADE", "truncate transactions"},
		{"TRUNCATE TABLE balance_logs RESTART IDENTITY CASCADE", "truncate balance_logs"},
		{"UPDATE users SET balance = 0", "reset all user balances"},
	}

	for _, s := range steps {
		if _, err := tx.Exec(s.sql); err != nil {
			tx.Rollback()
			log.Fatalf("failed to %s: %v", s.desc, err)
		}
		log.Printf("OK: %s", s.desc)
	}

	if err := tx.Commit(); err != nil {
		log.Fatalf("commit: %v", err)
	}
	log.Println("Reset complete.")
}
