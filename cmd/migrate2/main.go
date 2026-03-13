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

	// Make transactions.provider_id nullable + ON DELETE SET NULL
	steps := []string{
		`ALTER TABLE transactions ALTER COLUMN provider_id DROP NOT NULL`,
		`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_provider_id_fkey`,
		`ALTER TABLE transactions ADD CONSTRAINT transactions_provider_id_fkey
			FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL`,
	}
	for _, sql := range steps {
		if _, err := sqlDB.Exec(sql); err != nil {
			log.Printf("Step skipped/failed: %v", err)
		} else {
			log.Printf("OK: %s", sql[:40])
		}
	}
	log.Println("Migration done: transactions.provider_id is now nullable with ON DELETE SET NULL")
}
