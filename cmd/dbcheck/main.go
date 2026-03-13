package main

import (
	"fmt"

	"github.com/quanghuyvfarm79/vframotp/internal/config"
	"github.com/quanghuyvfarm79/vframotp/internal/repository"
)

func main() {
	cfg := config.Load()
	db := repository.NewDB(cfg)

	fmt.Println("=== users ===")
	urows, _ := db.Raw("SELECT id, email, role FROM users ORDER BY id").Rows()
	defer urows.Close()
	for urows.Next() {
		var id int; var email, role string
		urows.Scan(&id, &email, &role)
		fmt.Printf("id=%d email=%s role=%s\n", id, email, role)
	}

	fmt.Println("\n=== refunded check ===")
	rows, _ := db.Raw(`
		SELECT t.id, t.status,
		  (EXISTS(SELECT 1 FROM balance_logs WHERE ref_id = t.id AND type = 'refund')) AS refunded
		FROM transactions t ORDER BY t.id
	`).Rows()
	defer rows.Close()
	for rows.Next() {
		var id int; var status string; var refunded bool
		rows.Scan(&id, &status, &refunded)
		fmt.Printf("tx#%d status=%s refunded=%v\n", id, status, refunded)
	}

	fmt.Println("\n=== balance_logs ===")
	blrows, _ := db.Raw("SELECT id, user_id, type, amount, ref_id, note FROM balance_logs ORDER BY id").Rows()
	defer blrows.Close()
	for blrows.Next() {
		var id, userID int; var typ, note string; var amount int64; var refID interface{}
		blrows.Scan(&id, &userID, &typ, &amount, &refID, &note)
		fmt.Printf("id=%d user=%d type=%s amount=%d ref_id=%v note=%s\n", id, userID, typ, amount, refID, note)
	}
}
