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

	// Set default key_error_code for providers that have it empty
	r1, err := sqlDB.Exec(`
		UPDATE providers
		SET key_error_code = 'Error_Code'
		WHERE (key_error_code IS NULL OR key_error_code = '')
	`)
	if err != nil {
		log.Fatalf("patch key_error_code failed: %v", err)
	}
	n1, _ := r1.RowsAffected()
	log.Printf("Set key_error_code='Error_Code' for %d providers", n1)

	// Set default error_code_fatal for providers that have it empty
	r2, err := sqlDB.Exec(`
		UPDATE providers
		SET error_code_fatal = '6'
		WHERE (error_code_fatal IS NULL OR error_code_fatal = '')
	`)
	if err != nil {
		log.Fatalf("patch error_code_fatal failed: %v", err)
	}
	n2, _ := r2.RowsAffected()
	log.Printf("Set error_code_fatal='6' for %d providers", n2)

	log.Println("Provider patch complete.")
}
