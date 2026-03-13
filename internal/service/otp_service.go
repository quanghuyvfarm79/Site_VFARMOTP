package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/hibiken/asynq"
	"github.com/quanghuyvfarm79/vframotp/internal/model"
	"github.com/quanghuyvfarm79/vframotp/internal/queue"
	"github.com/quanghuyvfarm79/vframotp/internal/repository"
	providerPkg "github.com/quanghuyvfarm79/vframotp/pkg/provider"
	"gorm.io/gorm"
)

var ErrInsufficientBalance = errors.New("insufficient balance")

type OTPService struct {
	txRepo        *repository.TransactionRepo
	providerRepo  *repository.ProviderRepo
	userRepo      *repository.UserRepo
	phoneListRepo *repository.PhoneListRepo
	asynqClient   *asynq.Client
}

func NewOTPService(
	txRepo *repository.TransactionRepo,
	providerRepo *repository.ProviderRepo,
	userRepo *repository.UserRepo,
	phoneListRepo *repository.PhoneListRepo,
	asynqClient *asynq.Client,
) *OTPService {
	return &OTPService{
		txRepo:        txRepo,
		providerRepo:  providerRepo,
		userRepo:      userRepo,
		phoneListRepo: phoneListRepo,
		asynqClient:   asynqClient,
	}
}

type PhoneResult struct {
	Transaction *model.Transaction
	Phone       string
	RequestID   string
}

// InitiateOTPSync deducts balance, creates transaction, calls GetPhone synchronously,
// then enqueues PollOTP. Used by the public API (caller needs phone immediately).
func (s *OTPService) InitiateOTPSync(userID, providerID uint) (*PhoneResult, error) {
	provider, err := s.providerRepo.FindByID(providerID)
	if err != nil {
		return nil, fmt.Errorf("provider not found")
	}
	if !provider.Active {
		return nil, fmt.Errorf("provider is not active")
	}

	if err := s.userRepo.DeductBalance(userID, provider.Fee); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInsufficientBalance
		}
		return nil, err
	}

	tx := &model.Transaction{
		UserID:     userID,
		ProviderID: providerID,
		Amount:     provider.Fee,
		Status:     model.StatusPending,
	}
	if err := s.txRepo.Create(tx); err != nil {
		s.refundWithLog(userID, provider.Fee, 0, "db error: create tx")
		return nil, err
	}
	s.deductLog(userID, provider.Fee, tx.ID, provider.Name)

	// Sync: call provider directly to get phone
	phone, requestID, err := s.fetchPhone(provider, tx.ID)
	if err != nil {
		s.refundWithLog(userID, provider.Fee, tx.ID, err.Error())
		_, _ = s.txRepo.SetFailed(tx.ID, err.Error())
		return nil, err
	}

	if err := s.txRepo.SetPhone(tx.ID, phone, requestID, model.StatusWaitingOTP); err != nil {
		s.refundWithLog(userID, provider.Fee, tx.ID, "db error: set phone")
		_, _ = s.txRepo.SetFailed(tx.ID, "db error: set phone")
		return nil, err
	}
	tx.Phone = phone
	tx.RequestID = requestID
	tx.Status = model.StatusWaitingOTP

	// Async: enqueue PollOTP
	pollPayload, _ := json.Marshal(queue.PollOTPPayload{TransactionID: tx.ID, Attempt: 0})
	pollTask := asynq.NewTask(queue.TypePollOTP, pollPayload)
	if _, err := s.asynqClient.Enqueue(pollTask,
		asynq.Queue("otp"),
		asynq.ProcessIn(time.Duration(provider.TimeDelay)*time.Second),
	); err != nil {
		s.refundWithLog(userID, provider.Fee, tx.ID, "failed to enqueue poll job")
		_, _ = s.txRepo.SetFailed(tx.ID, "failed to enqueue poll job")
		return nil, fmt.Errorf("failed to enqueue poll job: %w", err)
	}

	return &PhoneResult{Transaction: tx, Phone: phone, RequestID: requestID}, nil
}

func (s *OTPService) fetchPhone(p *model.Provider, txID uint) (phone, requestID string, err error) {
	// Phone-list providers: phone is pre-assigned by admin, no get-number URL needed.
	// Use the claimed phone directly as both phone and requestID.
	if p.UsePhoneList {
		claimedPhone, claimErr := s.phoneListRepo.ClaimPhone(p.ID)
		if claimErr != nil {
			if p.AutoResetUsed {
				// Auto-reset used phones and retry claim
				claimedPhone, claimErr = s.phoneListRepo.ResetAndClaim(p.ID)
				if claimErr != nil {
					return "", "", fmt.Errorf("Hết số! Vui lòng liên hệ admin để bổ sung.")
				}
				return claimedPhone, claimedPhone, nil
			}
			return "", "", fmt.Errorf("Hết số! Vui lòng liên hệ admin để bổ sung.")
		}
		return claimedPhone, claimedPhone, nil
	}

	provClient := s.getProviderClient()
	resp, err := provClient.GetJSON(p.URL)
	if err != nil {
		return "", "", fmt.Errorf("provider error: %w", err)
	}

	phone = providerPkg.ExtractPath(resp, p.KeyPhone)
	if phone == "" {
		return "", "", fmt.Errorf("provider returned no phone")
	}
	requestID = providerPkg.ExtractPath(resp, p.KeyReqID)
	if requestID == "" {
		requestID = phone // legacy fallback
	}
	return phone, requestID, nil
}

func (s *OTPService) getProviderClient() *providerPkg.Client {
	return providerPkg.NewClient()
}

// deductLog writes a balance_log entry for a successful deduction.
func (s *OTPService) deductLog(userID uint, amount int64, txID uint, providerName string) {
	if amount <= 0 {
		return
	}
	entry := &model.BalanceLog{
		UserID: userID,
		Type:   model.BalanceDeduct,
		Amount: amount,
		RefID:  &txID,
		Note:   "thanh toán: " + providerName,
	}
	_ = s.userRepo.LogBalance(entry)
}

// refundWithLog refunds balance AND writes a balance_log with ref_id so the UI
// can detect the refund. txID=0 is allowed (e.g. when tx was never persisted).
func (s *OTPService) refundWithLog(userID uint, amount int64, txID uint, reason string) {
	if amount <= 0 {
		return
	}
	_ = s.userRepo.RefundBalance(userID, amount)
	entry := &model.BalanceLog{
		UserID: userID,
		Type:   model.BalanceRefund,
		Amount: amount,
		Note:   "refund: " + reason,
	}
	if txID > 0 {
		entry.RefID = &txID
	}
	_ = s.userRepo.LogBalance(entry)
}

// RefundForRenew refunds balance for a cancelled transaction. Phone stays "used".
func (s *OTPService) RefundForRenew(userID uint, amount int64, txID uint, usePhoneList bool, providerID uint, phone string) error {
	if err := s.userRepo.RefundBalance(userID, amount); err != nil {
		return err
	}
	log := &model.BalanceLog{
		UserID: userID,
		Type:   model.BalanceRefund,
		Amount: amount,
		RefID:  &txID,
		Note:   "refund: renew",
	}
	_ = s.userRepo.LogBalance(log)
	// Phone stays "used" — admin resets manually.
	return nil
}

// RenewPhone re-rents a specific phone the user previously held.
// For UsePhoneList providers: phone is re-used from pool (must exist and not be bad).
// For external providers: reuses the requestID from the user's last transaction for that phone.
// Charges full fee again and enqueues a new PollOTP job.
func (s *OTPService) RenewPhone(userID, providerID uint, phone string) (*PhoneResult, error) {
	provider, err := s.providerRepo.FindByID(providerID)
	if err != nil {
		return nil, fmt.Errorf("provider not found")
	}
	if !provider.Active {
		return nil, fmt.Errorf("provider is not active")
	}
	if !provider.AllowRenew {
		return nil, fmt.Errorf("provider does not allow renew")
	}

	// Determine requestID
	var requestID string
	if provider.UsePhoneList {
		// For pool providers, requestID == phone. Verify not blacklisted.
		var pl model.PhoneList
		if err := s.phoneListRepo.FindByProviderPhone(providerID, phone, &pl); err != nil {
			return nil, fmt.Errorf("phone not in pool")
		}
		if pl.Status == "bad" {
			return nil, fmt.Errorf("phone is blacklisted")
		}
		requestID = phone
	} else {
		// For external providers, reuse requestID from last transaction
		lastTx, err := s.txRepo.FindLatestByPhone(userID, providerID, phone)
		if err != nil {
			return nil, fmt.Errorf("phone not found in your transactions")
		}
		requestID = lastTx.RequestID
	}

	if err := s.userRepo.DeductBalance(userID, provider.Fee); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInsufficientBalance
		}
		return nil, err
	}

	tx := &model.Transaction{
		UserID:     userID,
		ProviderID: providerID,
		Amount:     provider.Fee,
		Status:     model.StatusWaitingOTP,
		Phone:      phone,
		RequestID:  requestID,
	}
	if err := s.txRepo.Create(tx); err != nil {
		s.refundWithLog(userID, provider.Fee, 0, "db error: create renew tx")
		return nil, err
	}
	s.deductLog(userID, provider.Fee, tx.ID, provider.Name)

	pollPayload, _ := json.Marshal(queue.PollOTPPayload{TransactionID: tx.ID, Attempt: 0})
	pollTask := asynq.NewTask(queue.TypePollOTP, pollPayload)
	if _, err := s.asynqClient.Enqueue(pollTask,
		asynq.Queue("otp"),
		asynq.ProcessIn(time.Duration(provider.TimeDelay)*time.Second),
	); err != nil {
		s.refundWithLog(userID, provider.Fee, tx.ID, "failed to enqueue poll job")
		_, _ = s.txRepo.SetFailed(tx.ID, "failed to enqueue poll job")
		return nil, fmt.Errorf("failed to enqueue poll job: %w", err)
	}

	return &PhoneResult{Transaction: tx, Phone: phone, RequestID: requestID}, nil
}

// CleanupStuck finds all transactions past their deadline and enqueues refunds for them.
// Returns the number of transactions refunded.
func (s *OTPService) CleanupStuck() (int, error) {
	txs, err := s.txRepo.FindStuck()
	if err != nil {
		return 0, err
	}
	count := 0
	for _, tx := range txs {
		payload, _ := json.Marshal(queue.RefundPayload{TransactionID: tx.ID, Reason: "admin cleanup: stuck transaction"})
		task := asynq.NewTask(queue.TypeRefund, payload)
		if _, enqErr := s.asynqClient.Enqueue(task, asynq.Queue("refund")); enqErr != nil {
			continue
		}
		count++
	}
	return count, nil
}

// InitiateOTP deducts balance, creates transaction, enqueues GetPhone job.
func (s *OTPService) InitiateOTP(userID, providerID uint) (*model.Transaction, error) {
	provider, err := s.providerRepo.FindByID(providerID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("provider not found")
		}
		return nil, err
	}
	if !provider.Active {
		return nil, fmt.Errorf("provider is not active")
	}

	// Atomic deduct balance
	if err := s.userRepo.DeductBalance(userID, provider.Fee); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInsufficientBalance
		}
		return nil, err
	}

	tx := &model.Transaction{
		UserID:     userID,
		ProviderID: providerID,
		Amount:     provider.Fee,
		Status:     model.StatusPending,
	}
	if err := s.txRepo.Create(tx); err != nil {
		s.refundWithLog(userID, provider.Fee, 0, "db error: create tx")
		return nil, err
	}
	s.deductLog(userID, provider.Fee, tx.ID, provider.Name)

	payload, _ := json.Marshal(queue.GetPhonePayload{TransactionID: tx.ID})
	task := asynq.NewTask(queue.TypeGetPhone, payload)
	if _, err := s.asynqClient.Enqueue(task, asynq.Queue("otp")); err != nil {
		s.refundWithLog(userID, provider.Fee, tx.ID, "failed to enqueue job")
		_, _ = s.txRepo.SetFailed(tx.ID, "failed to enqueue job")
		return nil, err
	}

	return tx, nil
}
