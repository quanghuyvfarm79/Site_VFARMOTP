package model

import "time"

// Transaction statuses
const (
	StatusPending     = "pending"
	StatusWaitingPhone = "waiting_phone"
	StatusWaitingOTP  = "waiting_otp"
	StatusSuccess     = "success"
	StatusFailed      = "failed"
	StatusCancelled   = "cancelled"
)

type Transaction struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	UserID     uint      `gorm:"not null" json:"user_id"`
	ProviderID uint      `gorm:"not null" json:"provider_id"`
	Phone      string    `json:"phone"`
	RequestID  string    `gorm:"column:request_id" json:"request_id"`
	OTP        string    `json:"otp"`
	Status     string    `gorm:"default:pending" json:"status"`
	Amount     int64     `gorm:"default:0" json:"amount"`
	Message    string    `json:"message"`
	CreatedAt  time.Time `json:"created_at"`

	User     User     `gorm:"foreignKey:UserID" json:"-"`
	Provider Provider `gorm:"foreignKey:ProviderID" json:"-"`
}
