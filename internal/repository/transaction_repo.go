package repository

import (
	"fmt"
	"strings"
	"time"

	"github.com/quanghuyvfarm79/vframotp/internal/model"
	"gorm.io/gorm"
)

// ChartPoint holds aggregated stats for a single day.
type ChartPoint struct {
	Date         string `json:"date"`
	Revenue      int64  `json:"revenue"`
	Topup        int64  `json:"topup"`
	OTPSuccess   int64  `json:"otp_success"`
	OTPFailed    int64  `json:"otp_failed"`
	OTPTimeout   int64  `json:"otp_timeout"`
	OTPBadPhone  int64  `json:"otp_bad_phone"`
}

// TopUser holds per-user OTP purchase summary.
type TopUser struct {
	ID         uint   `json:"id"`
	Email      string `json:"email"`
	OTPCount   int64  `json:"otp_count"`
	TotalSpent int64  `json:"total_spent"`
	Balance    int64  `json:"balance"`
}

// RecentTx is a lightweight recent transaction for the activity feed.
type RecentTx struct {
	ID           uint   `json:"id"`
	UserEmail    string `json:"user_email"`
	ProviderName string `json:"provider_name"`
	Phone        string `json:"phone"`
	OTP          string `json:"otp"`
	Status       string `json:"status"`
	Amount       int64  `json:"amount"`
	CreatedAt    string `json:"created_at"`
}

type TransactionRepo struct {
	db *gorm.DB
}

func NewTransactionRepo(db *gorm.DB) *TransactionRepo {
	return &TransactionRepo{db: db}
}

func (r *TransactionRepo) Create(tx *model.Transaction) error {
	return r.db.Create(tx).Error
}

func (r *TransactionRepo) FindByID(id uint) (*model.Transaction, error) {
	var tx model.Transaction
	if err := r.db.Preload("Provider").First(&tx, id).Error; err != nil {
		return nil, err
	}
	return &tx, nil
}

func (r *TransactionRepo) UpdateStatus(id uint, status string) error {
	return r.db.Model(&model.Transaction{}).Where("id = ?", id).
		Update("status", status).Error
}

func (r *TransactionRepo) SetPhone(id uint, phone, requestID, status string) error {
	return r.db.Model(&model.Transaction{}).Where("id = ?", id).Updates(map[string]interface{}{
		"phone":      phone,
		"request_id": requestID,
		"status":     status,
	}).Error
}

func (r *TransactionRepo) SetOTP(id uint, otp, status string) error {
	return r.db.Model(&model.Transaction{}).Where("id = ?", id).Updates(map[string]interface{}{
		"otp":    otp,
		"status": status,
	}).Error
}

// SetFailed marks a transaction as failed only if it is not already finalized.
// Returns (true, nil) if the row was updated, (false, nil) if already finalized, (false, err) on DB error.
func (r *TransactionRepo) SetFailed(id uint, message string) (bool, error) {
	result := r.db.Model(&model.Transaction{}).
		Where("id = ? AND status NOT IN ?", id, []string{model.StatusSuccess, model.StatusFailed}).
		Updates(map[string]interface{}{
			"status":  model.StatusFailed,
			"message": message,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}

func (r *TransactionRepo) FindByRequestID(userID uint, requestID string) (*model.Transaction, error) {
	var tx model.Transaction
	if err := r.db.Preload("Provider").
		Where("user_id = ? AND request_id = ?", userID, requestID).
		Order("id DESC").First(&tx).Error; err != nil {
		return nil, err
	}
	return &tx, nil
}

func (r *TransactionRepo) FindLatestByPhone(userID, providerID uint, phone string) (*model.Transaction, error) {
	var tx model.Transaction
	if err := r.db.Preload("Provider").
		Where("user_id = ? AND provider_id = ? AND phone = ?", userID, providerID, phone).
		Order("id DESC").First(&tx).Error; err != nil {
		return nil, err
	}
	return &tx, nil
}

// FindStuck returns transactions still in a non-final status whose deadline
// (created_at + provider timeout) has passed by more than 5 minutes.
func (r *TransactionRepo) FindStuck() ([]model.Transaction, error) {
	var txs []model.Transaction
	err := r.db.Preload("Provider").
		Joins("JOIN providers ON providers.id = transactions.provider_id").
		Where("transactions.status IN ?", []string{model.StatusPending, model.StatusWaitingPhone, model.StatusWaitingOTP}).
		Where("transactions.created_at + (providers.timeout * INTERVAL '1 second') + INTERVAL '5 minutes' < NOW()").
		Find(&txs).Error
	return txs, err
}

// TxWithRefund wraps a Transaction with a refund flag.
type TxWithRefund struct {
	model.Transaction
	Refunded bool `gorm:"column:refunded" json:"refunded"`
}

func (r *TransactionRepo) ListByUser(userID uint, offset, limit int) ([]TxWithRefund, int64, error) {
	var total int64
	r.db.Model(&model.Transaction{}).Where("user_id = ?", userID).Count(&total)

	type flatRow struct {
		ID         uint      `gorm:"column:id"`
		UserID     uint      `gorm:"column:user_id"`
		ProviderID uint      `gorm:"column:provider_id"`
		Phone      string    `gorm:"column:phone"`
		RequestID  string    `gorm:"column:request_id"`
		OTP        string    `gorm:"column:otp"`
		Status     string    `gorm:"column:status"`
		Amount     int64     `gorm:"column:amount"`
		Message    string    `gorm:"column:message"`
		CreatedAt  time.Time `gorm:"column:created_at"`
		Refunded   bool      `gorm:"column:refunded"`
	}
	var rows []flatRow
	err := r.db.Raw(`
		SELECT t.id, t.user_id, t.provider_id, t.phone, t.request_id, t.otp,
		       t.status, t.amount, t.message, t.created_at,
		       (EXISTS(SELECT 1 FROM balance_logs WHERE ref_id = t.id AND type = 'refund')) AS refunded
		FROM transactions t
		WHERE t.user_id = ?
		ORDER BY t.id DESC
		LIMIT ? OFFSET ?
	`, userID, limit, offset).Scan(&rows).Error
	if err != nil {
		return nil, 0, err
	}

	providerIDs := make([]uint, 0, len(rows))
	for _, r := range rows {
		providerIDs = append(providerIDs, r.ProviderID)
	}
	var providers []model.Provider
	if len(providerIDs) > 0 {
		r.db.Where("id IN ?", providerIDs).Find(&providers)
	}
	provMap := make(map[uint]model.Provider, len(providers))
	for _, p := range providers {
		provMap[p.ID] = p
	}

	result := make([]TxWithRefund, len(rows))
	for i, row := range rows {
		result[i] = TxWithRefund{
			Transaction: model.Transaction{
				ID:         row.ID,
				UserID:     row.UserID,
				ProviderID: row.ProviderID,
				Phone:      row.Phone,
				RequestID:  row.RequestID,
				OTP:        row.OTP,
				Status:     row.Status,
				Amount:     row.Amount,
				Message:    row.Message,
				CreatedAt:  row.CreatedAt,
				Provider:   provMap[row.ProviderID],
			},
			Refunded: row.Refunded,
		}
	}
	return result, total, nil
}

func (r *TransactionRepo) Stats() (total int64, revenue int64, active int64, successRate float64) {
	r.db.Model(&model.Transaction{}).Count(&total)
	r.db.Model(&model.Transaction{}).Where("status = ?", model.StatusSuccess).
		Select("COALESCE(SUM(amount),0)").Scan(&revenue)
	r.db.Model(&model.Transaction{}).
		Where("status IN ?", []string{model.StatusPending, model.StatusWaitingPhone, model.StatusWaitingOTP}).
		Count(&active)
	// success rate = success / (success + failed) * 100, ignore pending
	var successCount, failedCount int64
	r.db.Model(&model.Transaction{}).Where("status = ?", model.StatusSuccess).Count(&successCount)
	r.db.Model(&model.Transaction{}).Where("status = ?", model.StatusFailed).Count(&failedCount)
	if done := successCount + failedCount; done > 0 {
		successRate = float64(successCount) / float64(done) * 100
	}
	return
}

// AdminTxWithRefund wraps a Transaction with refund flag for admin list.
type AdminTxWithRefund struct {
	model.Transaction
	Refunded bool `gorm:"column:refunded" json:"refunded"`
}

// ListAllFilter holds optional filters for admin transaction list.
type ListAllFilter struct {
	Status string // e.g. "success", "failed", ""
	Search string // partial match on user email or phone
}

func (r *TransactionRepo) ListAll(offset, limit int, f ListAllFilter) ([]AdminTxWithRefund, int64, error) {
	var total int64

	// Build WHERE clause
	var whereClauses []string
	var args []interface{}
	if f.Status != "" {
		whereClauses = append(whereClauses, "t.status = ?")
		args = append(args, f.Status)
	}
	if f.Search != "" {
		like := "%" + f.Search + "%"
		whereClauses = append(whereClauses, "(u.email ILIKE ? OR t.phone ILIKE ?)")
		args = append(args, like, like)
	}

	joinClause := "FROM transactions t"
	if f.Search != "" {
		joinClause += " JOIN users u ON u.id = t.user_id"
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	// Count with filters
	countSQL := fmt.Sprintf("SELECT COUNT(*) %s %s", joinClause, whereSQL)
	r.db.Raw(countSQL, args...).Scan(&total)

	type flatRow struct {
		ID         uint      `gorm:"column:id"`
		UserID     uint      `gorm:"column:user_id"`
		ProviderID uint      `gorm:"column:provider_id"`
		Phone      string    `gorm:"column:phone"`
		RequestID  string    `gorm:"column:request_id"`
		OTP        string    `gorm:"column:otp"`
		Status     string    `gorm:"column:status"`
		Amount     int64     `gorm:"column:amount"`
		Message    string    `gorm:"column:message"`
		CreatedAt  time.Time `gorm:"column:created_at"`
		Refunded   bool      `gorm:"column:refunded"`
	}
	var rows []flatRow
	queryArgs := append(args, limit, offset)
	err := r.db.Raw(fmt.Sprintf(`
		SELECT t.id, t.user_id, t.provider_id, t.phone, t.request_id, t.otp,
		       t.status, t.amount, t.message, t.created_at,
		       (EXISTS(SELECT 1 FROM balance_logs WHERE ref_id = t.id AND type = 'refund')) AS refunded
		%s %s
		ORDER BY t.id DESC
		LIMIT ? OFFSET ?
	`, joinClause, whereSQL), queryArgs...).Scan(&rows).Error
	if err != nil {
		return nil, 0, err
	}

	userIDs := make([]uint, 0, len(rows))
	providerIDs := make([]uint, 0, len(rows))
	for _, r := range rows {
		userIDs = append(userIDs, r.UserID)
		providerIDs = append(providerIDs, r.ProviderID)
	}
	var users []model.User
	var providers []model.Provider
	if len(userIDs) > 0 {
		r.db.Where("id IN ?", userIDs).Find(&users)
	}
	if len(providerIDs) > 0 {
		r.db.Where("id IN ?", providerIDs).Find(&providers)
	}
	userMap := make(map[uint]model.User, len(users))
	for _, u := range users {
		userMap[u.ID] = u
	}
	provMap := make(map[uint]model.Provider, len(providers))
	for _, p := range providers {
		provMap[p.ID] = p
	}

	result := make([]AdminTxWithRefund, len(rows))
	for i, row := range rows {
		result[i] = AdminTxWithRefund{
			Transaction: model.Transaction{
				ID:         row.ID,
				UserID:     row.UserID,
				ProviderID: row.ProviderID,
				Phone:      row.Phone,
				RequestID:  row.RequestID,
				OTP:        row.OTP,
				Status:     row.Status,
				Amount:     row.Amount,
				Message:    row.Message,
				CreatedAt:  row.CreatedAt,
				User:       userMap[row.UserID],
				Provider:   provMap[row.ProviderID],
			},
			Refunded: row.Refunded,
		}
	}
	return result, total, nil
}

// HourlyPoint holds OTP counts per hour for today.
type HourlyPoint struct {
	Hour        int   `json:"hour"`
	OTPSuccess  int64 `json:"otp_success"`
	OTPFailed   int64 `json:"otp_failed"`
	OTPTimeout  int64 `json:"otp_timeout"`
	OTPBadPhone int64 `json:"otp_bad_phone"`
}

// OTPHourly returns per-hour OTP counts for today (all 24 hours, zero-filled).
func (r *TransactionRepo) OTPHourly() ([]HourlyPoint, error) {
	today := time.Now().Format("2006-01-02")
	type row struct {
		Hour        int
		OTPSuccess  int64
		OTPFailed   int64
		OTPTimeout  int64
		OTPBadPhone int64
	}
	var rows []row
	err := r.db.Raw(`
		SELECT
			EXTRACT(HOUR FROM created_at)::int AS hour,
			COUNT(*) FILTER (WHERE status = 'success') AS otp_success,
			COUNT(*) FILTER (WHERE status = 'failed' AND message LIKE '%phone unavailable%') AS otp_bad_phone,
			COUNT(*) FILTER (WHERE status = 'failed' AND message LIKE '%timeout%') AS otp_timeout,
			COUNT(*) FILTER (WHERE status = 'failed' AND message NOT LIKE '%timeout%' AND message NOT LIKE '%phone unavailable%') AS otp_failed
		FROM transactions
		WHERE DATE(created_at) = ?
		GROUP BY hour
		ORDER BY hour
	`, today).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	// Fill all 24 hours
	m := make(map[int]row, len(rows))
	for _, r := range rows {
		m[r.Hour] = r
	}
	result := make([]HourlyPoint, 24)
	for h := 0; h < 24; h++ {
		r := m[h]
		result[h] = HourlyPoint{Hour: h, OTPSuccess: r.OTPSuccess, OTPFailed: r.OTPFailed, OTPTimeout: r.OTPTimeout, OTPBadPhone: r.OTPBadPhone}
	}
	return result, nil
}

// TodayStats returns counts/sums for today only.
func (r *TransactionRepo) TodayStats() (todayTx, todayRevenue, todayUsers, totalTopup int64) {
	today := time.Now().Format("2006-01-02")
	r.db.Raw(`SELECT COUNT(*) FROM transactions WHERE DATE(created_at) = ?`, today).Scan(&todayTx)
	r.db.Raw(`SELECT COALESCE(SUM(amount),0) FROM transactions WHERE status='success' AND DATE(created_at) = ?`, today).Scan(&todayRevenue)
	r.db.Raw(`SELECT COUNT(*) FROM users WHERE DATE(created_at) = ?`, today).Scan(&todayUsers)
	r.db.Raw(`SELECT COALESCE(SUM(amount),0) FROM balance_logs WHERE type='topup'`).Scan(&totalTopup)
	return
}

// ChartStats returns per-day aggregated revenue+OTP counts for the given number of days.
func (r *TransactionRepo) ChartStats(days int) ([]ChartPoint, error) {
	since := time.Now().AddDate(0, 0, -days).Format("2006-01-02")
	type txRow struct {
		Date        string
		Revenue     int64
		OTPSuccess  int64
		OTPFailed   int64
		OTPTimeout  int64
		OTPBadPhone int64
	}
	var rows []txRow
	err := r.db.Raw(`
		SELECT
			TO_CHAR(created_at, 'YYYY-MM-DD') AS date,
			COALESCE(SUM(amount) FILTER (WHERE status = 'success'), 0) AS revenue,
			COUNT(*) FILTER (WHERE status = 'success') AS otp_success,
			COUNT(*) FILTER (WHERE status = 'failed' AND message LIKE '%phone unavailable%') AS otp_bad_phone,
			COUNT(*) FILTER (WHERE status = 'failed' AND message LIKE '%timeout%') AS otp_timeout,
			COUNT(*) FILTER (WHERE status = 'failed' AND message NOT LIKE '%timeout%' AND message NOT LIKE '%phone unavailable%') AS otp_failed
		FROM transactions
		WHERE created_at >= ?
		GROUP BY date
		ORDER BY date
	`, since).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	type topupRow struct {
		Date   string
		Amount int64
	}
	var topups []topupRow
	err = r.db.Raw(`
		SELECT
			TO_CHAR(created_at, 'YYYY-MM-DD') AS date,
			COALESCE(SUM(amount), 0) AS amount
		FROM balance_logs
		WHERE type = 'topup' AND created_at >= ?
		GROUP BY date
		ORDER BY date
	`, since).Scan(&topups).Error
	if err != nil {
		return nil, err
	}

	topupMap := make(map[string]int64, len(topups))
	for _, t := range topups {
		topupMap[t.Date] = t.Amount
	}

	points := make([]ChartPoint, len(rows))
	for i, row := range rows {
		points[i] = ChartPoint{
			Date:        row.Date,
			Revenue:     row.Revenue,
			Topup:       topupMap[row.Date],
			OTPSuccess:  row.OTPSuccess,
			OTPFailed:   row.OTPFailed,
			OTPTimeout:  row.OTPTimeout,
			OTPBadPhone: row.OTPBadPhone,
		}
	}
	return points, nil
}

// TopUsers returns the top N users by OTP count (success transactions).
func (r *TransactionRepo) TopUsers(limit int) ([]TopUser, error) {
	var rows []TopUser
	err := r.db.Raw(`
		SELECT
			u.id,
			u.email,
			COUNT(t.id) AS otp_count,
			COALESCE(SUM(t.amount), 0) AS total_spent,
			u.balance
		FROM users u
		JOIN transactions t ON t.user_id = u.id AND t.status = 'success'
		GROUP BY u.id, u.email, u.balance
		ORDER BY otp_count DESC
		LIMIT ?
	`, limit).Scan(&rows).Error
	return rows, err
}

// RecentTransactions returns the N most recent transactions.
func (r *TransactionRepo) RecentTransactions(limit int) ([]RecentTx, error) {
	var txs []model.Transaction
	err := r.db.Order("id DESC").Limit(limit).
		Preload("User").Preload("Provider").Find(&txs).Error
	if err != nil {
		return nil, err
	}
	result := make([]RecentTx, len(txs))
	for i, tx := range txs {
		result[i] = RecentTx{
			ID:           tx.ID,
			UserEmail:    tx.User.Email,
			ProviderName: tx.Provider.Name,
			Phone:        tx.Phone,
			OTP:          tx.OTP,
			Status:       tx.Status,
			Amount:       tx.Amount,
			CreatedAt:    tx.CreatedAt.Format("2006-01-02 15:04"),
		}
	}
	return result, nil
}
