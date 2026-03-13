package repository

import (
	"time"

	"github.com/quanghuyvfarm79/vframotp/internal/model"
	"gorm.io/gorm"
)

type UserStats struct {
	TotalTopup  int64
	TotalSpent  int64
	TotalOTP    int64
	LastLoginAt *time.Time
	LastLoginUA string
}

type UserRepo struct {
	db *gorm.DB
}

func NewUserRepo(db *gorm.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) FindByEmail(email string) (*model.User, error) {
	var user model.User
	if err := r.db.Where("email = ? AND active = true", email).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepo) FindByAPIKey(hashedKey string) (*model.User, error) {
	var user model.User
	if err := r.db.Where("api_key = ? AND active = true", hashedKey).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepo) FindByID(id uint) (*model.User, error) {
	var user model.User
	if err := r.db.First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepo) Create(user *model.User) error {
	return r.db.Create(user).Error
}

func (r *UserRepo) UpdateAPIKey(userID uint, hashedKey, rawKey string) error {
	return r.db.Model(&model.User{}).Where("id = ?", userID).
		Updates(map[string]any{"api_key": hashedKey, "raw_api_key": rawKey}).Error
}

func (r *UserRepo) GetRawAPIKey(userID uint) string {
	var user model.User
	r.db.Select("raw_api_key").First(&user, userID)
	return user.RawAPIKey
}

// DeductBalance atomically deducts amount; returns error if insufficient balance
func (r *UserRepo) DeductBalance(userID uint, amount int64) error {
	result := r.db.Model(&model.User{}).
		Where("id = ? AND balance >= ?", userID, amount).
		UpdateColumn("balance", gorm.Expr("balance - ?", amount))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *UserRepo) RefundBalance(userID uint, amount int64) error {
	return r.db.Model(&model.User{}).
		Where("id = ?", userID).
		UpdateColumn("balance", gorm.Expr("balance + ?", amount)).Error
}

func (r *UserRepo) AdminAddBalance(userID uint, amount int64, note string, db *gorm.DB) error {
	if db == nil {
		db = r.db
	}
	if err := db.Model(&model.User{}).Where("id = ?", userID).
		UpdateColumn("balance", gorm.Expr("balance + ?", amount)).Error; err != nil {
		return err
	}
	log := &model.BalanceLog{
		UserID: userID,
		Type:   model.BalanceTopup,
		Amount: amount,
		Note:   note,
	}
	return db.Create(log).Error
}

func (r *UserRepo) LogBalance(entry *model.BalanceLog) error {
	return r.db.Create(entry).Error
}

func (r *UserRepo) UpdatePassword(userID uint, hashedPassword string) error {
	return r.db.Model(&model.User{}).Where("id = ?", userID).Update("password", hashedPassword).Error
}

func (r *UserRepo) List(offset, limit int) ([]model.User, int64, error) {
	var users []model.User
	var total int64
	r.db.Model(&model.User{}).Count(&total)
	err := r.db.Offset(offset).Limit(limit).Order("id DESC").Find(&users).Error
	return users, total, err
}

func (r *UserRepo) SetActive(userID uint, active bool) error {
	return r.db.Model(&model.User{}).Where("id = ?", userID).Update("active", active).Error
}

func (r *UserRepo) UpdateLastLogin(userID uint, ua string) {
	now := time.Now()
	r.db.Model(&model.User{}).Where("id = ?", userID).
		Updates(map[string]any{"last_login_at": now, "last_login_ua": ua})
}

func (r *UserRepo) GetUserStats(userID uint) UserStats {
	var stats UserStats
	r.db.Model(&model.BalanceLog{}).
		Where("user_id = ? AND type = 'topup'", userID).
		Select("COALESCE(SUM(amount),0)").Scan(&stats.TotalTopup)
	r.db.Model(&model.Transaction{}).
		Where("user_id = ? AND status = 'success'", userID).
		Select("COALESCE(SUM(amount),0)").Scan(&stats.TotalSpent)
	r.db.Model(&model.Transaction{}).
		Where("user_id = ? AND status = 'success'", userID).
		Count(&stats.TotalOTP)
	var user model.User
	r.db.Select("last_login_at", "last_login_ua").First(&user, userID)
	stats.LastLoginAt = user.LastLoginAt
	stats.LastLoginUA = user.LastLoginUA
	return stats
}

func (r *UserRepo) EditUser(userID uint, balance int64, role string) error {
	return r.db.Model(&model.User{}).Where("id = ?", userID).
		Updates(map[string]any{"balance": balance, "role": role}).Error
}

func (r *UserRepo) DeleteUser(userID uint) error {
	return r.db.Unscoped().Delete(&model.User{}, userID).Error
}

func (r *UserRepo) ListBalanceLogs(userID uint, offset, limit int, typeFilter string) ([]model.BalanceLog, int64, error) {
	var logs []model.BalanceLog
	var total int64
	q := r.db.Model(&model.BalanceLog{}).Where("user_id = ?", userID)
	if typeFilter != "" {
		q = q.Where("type = ?", typeFilter)
	}
	q.Count(&total)
	err := q.Order("id DESC").Offset(offset).Limit(limit).Find(&logs).Error
	return logs, total, err
}

func (r *UserRepo) CountAndBalance() (int64, int64) {
	var count int64
	var balance int64
	r.db.Model(&model.User{}).Count(&count)
	r.db.Model(&model.User{}).Select("COALESCE(SUM(balance),0)").Scan(&balance)
	return count, balance
}
