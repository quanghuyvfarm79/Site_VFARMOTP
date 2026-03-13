package repository

import (
	"github.com/quanghuyvfarm79/vframotp/internal/model"
	"gorm.io/gorm"
)

type ProviderRepo struct {
	db *gorm.DB
}

func NewProviderRepo(db *gorm.DB) *ProviderRepo {
	return &ProviderRepo{db: db}
}

func (r *ProviderRepo) FindByID(id uint) (*model.Provider, error) {
	var p model.Provider
	if err := r.db.First(&p, id).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *ProviderRepo) ListActive() ([]model.Provider, error) {
	var providers []model.Provider
	err := r.db.Where("active = true").Order("id ASC").Find(&providers).Error
	return providers, err
}

func (r *ProviderRepo) ListAll() ([]model.Provider, error) {
	var providers []model.Provider
	err := r.db.Order("id ASC").Find(&providers).Error
	return providers, err
}

func (r *ProviderRepo) Create(p *model.Provider) error {
	return r.db.Create(p).Error
}

func (r *ProviderRepo) Update(p *model.Provider) error {
	return r.db.Save(p).Error
}

func (r *ProviderRepo) SetActive(id uint, active bool) error {
	return r.db.Model(&model.Provider{}).Where("id = ?", id).Update("active", active).Error
}

func (r *ProviderRepo) Delete(id uint) error {
	return r.db.Delete(&model.Provider{}, id).Error
}

func (r *ProviderRepo) ChangeID(oldID, newID uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 1. Insert new row by copying all fields from old row
		if err := tx.Exec(`
			INSERT INTO providers (id, name, url, url_otp, key_phone, key_req_id, key_otp,
				fee, timeout, time_delay, use_phone_list, key_error_code, error_code_fatal,
				key_otp_done, allow_renew, auto_reset_used, active, created_at)
			SELECT ?, name, url, url_otp, key_phone, key_req_id, key_otp,
				fee, timeout, time_delay, use_phone_list, key_error_code, error_code_fatal,
				key_otp_done, allow_renew, auto_reset_used, active, created_at
			FROM providers WHERE id = ?
		`, newID, oldID).Error; err != nil {
			return err
		}
		// 2. Re-point phone_list FK to new ID
		if err := tx.Exec("UPDATE phone_list SET provider_id = ? WHERE provider_id = ?", newID, oldID).Error; err != nil {
			return err
		}
		// 3. Re-point transactions FK to new ID
		if err := tx.Exec("UPDATE transactions SET provider_id = ? WHERE provider_id = ?", newID, oldID).Error; err != nil {
			return err
		}
		// 4. Delete old row (no FKs left referencing it)
		return tx.Exec("DELETE FROM providers WHERE id = ?", oldID).Error
	})
}

func (r *ProviderRepo) ExistsByID(id uint) bool {
	var count int64
	r.db.Model(&model.Provider{}).Where("id = ?", id).Count(&count)
	return count > 0
}
