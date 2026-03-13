package model

import "time"

// BalanceLog types
const (
	BalanceDeduct = "deduct"
	BalanceRefund = "refund"
	BalanceTopup  = "topup"
)

type BalanceLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null" json:"user_id"`
	Type      string    `gorm:"not null" json:"type"`
	Amount    int64     `gorm:"not null" json:"amount"`
	RefID     *uint     `gorm:"column:ref_id" json:"ref_id"`
	Note      string    `json:"note"`
	CreatedAt time.Time `json:"created_at"`
}
