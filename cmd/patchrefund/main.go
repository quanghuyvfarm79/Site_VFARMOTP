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

	result, err := sqlDB.Exec(`
		INSERT INTO balance_logs (user_id, type, amount, ref_id, note, created_at)
		SELECT t.user_id, 'refund', t.amount, t.id, 'refund: manual patch', NOW()
		FROM transactions t
		WHERE t.status IN ('failed', 'cancelled')
		  AND NOT EXISTS (
		    SELECT 1 FROM balance_logs bl
		    WHERE bl.ref_id = t.id AND bl.type = 'refund'
		  )
	`)
	if err != nil {
		log.Fatalf("patch failed: %v", err)
	}
	n, _ := result.RowsAffected()
	log.Printf("Patched %d transactions with refund log.", n)
}
