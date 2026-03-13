package model

import "time"

func (PhoneList) TableName() string { return "phone_list" }

type PhoneList struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	ProviderID uint      `gorm:"not null" json:"provider_id"`
	Phone      string    `gorm:"not null" json:"phone"`
	Status     string    `gorm:"default:available" json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}
