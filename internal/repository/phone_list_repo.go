package repository

import (
	"errors"

	"github.com/quanghuyvfarm79/vframotp/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrNoPhoneAvailable = errors.New("no available phone in pool")

type PhoneListRepo struct {
	db *gorm.DB
}

func NewPhoneListRepo(db *gorm.DB) *PhoneListRepo {
	return &PhoneListRepo{db: db}
}

// ClaimPhone atomically picks the first available phone for a provider and marks it used.
func (r *PhoneListRepo) ClaimPhone(providerID uint) (string, error) {
	var phone model.PhoneList
	err := r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).
			Where("provider_id = ? AND status = 'available'", providerID).
			First(&phone).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrNoPhoneAvailable
			}
			return err
		}
		return tx.Model(&model.PhoneList{}).Where("id = ?", phone.ID).
			Update("status", "used").Error
	})
	if err != nil {
		return "", err
	}
	return phone.Phone, nil
}

// MarkBad marks a phone as permanently bad (provider returned fatal error).
// Admin can see these and remove them from the pool.
func (r *PhoneListRepo) MarkBad(providerID uint, phone string) error {
	return r.db.Model(&model.PhoneList{}).
		Where("provider_id = ? AND phone = ?", providerID, phone).
		Update("status", "bad").Error
}

// InsertOrMarkBad upserts a phone as 'bad'. If the phone doesn't exist in the
// pool (e.g. UsePhoneList=false providers), it inserts a new row with status='bad'
// so admin can see and clean up bad numbers returned by the external provider.
func (r *PhoneListRepo) InsertOrMarkBad(providerID uint, phone string) error {
	record := model.PhoneList{
		ProviderID: providerID,
		Phone:      phone,
		Status:     "bad",
	}
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "provider_id"}, {Name: "phone"}},
		DoUpdates: clause.Assignments(map[string]interface{}{"status": "bad"}),
	}).Create(&record).Error
}

// FindByProviderPhone finds a phone record by provider and phone number.
func (r *PhoneListRepo) FindByProviderPhone(providerID uint, phone string, out *model.PhoneList) error {
	return r.db.Where("provider_id = ? AND phone = ?", providerID, phone).First(out).Error
}

// ReleasePhone marks a phone available again.
func (r *PhoneListRepo) ReleasePhone(providerID uint, phone string) error {
	return r.db.Model(&model.PhoneList{}).
		Where("provider_id = ? AND phone = ?", providerID, phone).
		Update("status", "available").Error
}

func (r *PhoneListRepo) BulkInsert(phones []model.PhoneList) (int64, error) {
	result := r.db.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(&phones, 500)
	return result.RowsAffected, result.Error
}

func (r *PhoneListRepo) ListByProvider(providerID uint, offset, limit int) ([]model.PhoneList, int64, error) {
	var phones []model.PhoneList
	var total int64
	r.db.Model(&model.PhoneList{}).Where("provider_id = ?", providerID).Count(&total)
	err := r.db.Where("provider_id = ?", providerID).Order("id ASC").Offset(offset).Limit(limit).Find(&phones).Error
	return phones, total, err
}

func (r *PhoneListRepo) DeletePhone(providerID uint, phone string) error {
	return r.db.Where("provider_id = ? AND phone = ?", providerID, phone).Delete(&model.PhoneList{}).Error
}

func (r *PhoneListRepo) DeleteAllByProvider(providerID uint) error {
	return r.db.Where("provider_id = ?", providerID).Delete(&model.PhoneList{}).Error
}

// ResetAndClaim resets all "used" phones to "available" then claims one atomically.
// Used when auto_reset_used is enabled and the pool is empty.
func (r *PhoneListRepo) ResetAndClaim(providerID uint) (string, error) {
	var phone model.PhoneList
	err := r.db.Transaction(func(tx *gorm.DB) error {
		// Reset all used (not bad) phones
		result := tx.Model(&model.PhoneList{}).
			Where("provider_id = ? AND status = 'used'", providerID).
			Update("status", "available")
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrNoPhoneAvailable
		}
		// Claim one
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).
			Where("provider_id = ? AND status = 'available'", providerID).
			First(&phone).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrNoPhoneAvailable
			}
			return err
		}
		return tx.Model(&model.PhoneList{}).Where("id = ?", phone.ID).
			Update("status", "used").Error
	})
	if err != nil {
		return "", err
	}
	return phone.Phone, nil
}

// ResetUsedPhones sets all "used" phones back to "available" for a provider.
func (r *PhoneListRepo) ResetUsedPhones(providerID uint) (int64, error) {
	result := r.db.Model(&model.PhoneList{}).
		Where("provider_id = ? AND status = 'used'", providerID).
		Update("status", "available")
	return result.RowsAffected, result.Error
}

// DeleteUsedPhones hard-deletes all "used" phones for a provider.
func (r *PhoneListRepo) DeleteUsedPhones(providerID uint) (int64, error) {
	result := r.db.Where("provider_id = ? AND status = 'used'", providerID).Delete(&model.PhoneList{})
	return result.RowsAffected, result.Error
}

// DeleteBadPhones hard-deletes all "bad" phones for a provider.
func (r *PhoneListRepo) DeleteBadPhones(providerID uint) (int64, error) {
	result := r.db.Where("provider_id = ? AND status = 'bad'", providerID).Delete(&model.PhoneList{})
	return result.RowsAffected, result.Error
}

// CountsByProvider returns (available, used, bad) counts for a provider.
func (r *PhoneListRepo) CountsByProvider(providerID uint) (available, used, bad int64) {
	type row struct {
		Status string
		Count  int64
	}
	var rows []row
	r.db.Model(&model.PhoneList{}).
		Select("status, count(*) as count").
		Where("provider_id = ?", providerID).
		Group("status").
		Scan(&rows)
	for _, row := range rows {
		switch row.Status {
		case "available":
			available = row.Count
		case "used":
			used = row.Count
		case "bad":
			bad = row.Count
		}
	}
	return
}
