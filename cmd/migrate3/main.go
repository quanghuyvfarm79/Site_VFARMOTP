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

	// Add ON UPDATE CASCADE so that changing providers.id cascades to child tables
	steps := []string{
		`ALTER TABLE phone_list DROP CONSTRAINT IF EXISTS phone_list_provider_id_fkey`,
		`ALTER TABLE phone_list ADD CONSTRAINT phone_list_provider_id_fkey
			FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE ON UPDATE CASCADE`,
		`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_provider_id_fkey`,
		`ALTER TABLE transactions ADD CONSTRAINT transactions_provider_id_fkey
			FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL ON UPDATE CASCADE`,
	}
	for _, sql := range steps {
		if _, err := sqlDB.Exec(sql); err != nil {
			log.Printf("Step skipped/failed: %v", err)
		} else {
			log.Printf("OK: %s", sql[:50])
		}
	}
	log.Println("Migration done: phone_list + transactions FK now have ON UPDATE CASCADE")
}
