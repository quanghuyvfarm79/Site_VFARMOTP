package model

import "time"

type Provider struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"not null" json:"name"`
	URL          string    `gorm:"not null" json:"url"`
	URLOtp       string    `gorm:"column:url_otp;not null" json:"url_otp"`
	KeyPhone     string    `gorm:"column:key_phone" json:"key_phone"`
	KeyReqID     string    `gorm:"column:key_req_id" json:"key_req_id"`
	KeyOtp       string    `gorm:"column:key_otp" json:"key_otp"`
	Fee          int64     `gorm:"default:0" json:"fee"`
	Timeout      int       `gorm:"default:300" json:"timeout"`
	TimeDelay    int       `gorm:"column:time_delay;default:10" json:"time_delay"`
	UsePhoneList   bool   `gorm:"column:use_phone_list;default:false" json:"use_phone_list"`
	KeyErrorCode   string `gorm:"column:key_error_code;default:'Error_Code'" json:"key_error_code"`
	ErrorCodeFatal string `gorm:"column:error_code_fatal;default:'6'" json:"error_code_fatal"`
	KeyOtpDone     string `gorm:"column:key_otp_done;default:''" json:"key_otp_done"`
	AllowRenew      bool   `gorm:"column:allow_renew;default:true" json:"allow_renew"`
	AutoResetUsed   bool   `gorm:"column:auto_reset_used;default:false" json:"auto_reset_used"`
	Active          bool   `gorm:"default:true" json:"active"`
	CreatedAt    time.Time `json:"created_at"`
}
