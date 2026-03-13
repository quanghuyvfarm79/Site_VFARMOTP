package model

import "time"

type User struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	Email       string     `gorm:"uniqueIndex;not null" json:"email"`
	Password    string     `gorm:"not null" json:"-"`
	Role        string     `gorm:"default:user" json:"role"`
	Balance     int64      `gorm:"default:0" json:"balance"`
	APIKey      *string    `gorm:"uniqueIndex" json:"-"`
	RawAPIKey   string     `gorm:"column:raw_api_key" json:"-"`
	Active      bool       `gorm:"default:true" json:"active"`
	LastLoginAt *time.Time `gorm:"column:last_login_at" json:"last_login_at"`
	LastLoginUA string     `gorm:"column:last_login_ua" json:"-"`
	CreatedAt   time.Time  `json:"created_at"`
}
