package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/hibiken/asynq"
	"github.com/quanghuyvfarm79/vframotp/internal/model"
	"github.com/quanghuyvfarm79/vframotp/internal/queue"
	"github.com/quanghuyvfarm79/vframotp/internal/repository"
	"github.com/quanghuyvfarm79/vframotp/pkg/provider"
)

// normalizeCode strips leading zeros and trailing ".0" so "06", "6", "6.0" all equal "6".
func normalizeCode(s string) string {
	s = strings.TrimSpace(s)
	// If it parses as a float, format as integer string
	if f, err := strconv.ParseFloat(s, 64); err == nil {
		return strconv.FormatInt(int64(f), 10)
	}
	return strings.TrimLeft(s, "0")
}

var otpRegex = regexp.MustCompile(`\d{4,8}`)

type PollOTPHandler struct {
	txRepo         *repository.TransactionRepo
	phoneListRepo  *repository.PhoneListRepo
	providerClient *provider.Client
	asynqClient    *asynq.Client
}

func NewPollOTPHandler(
	txRepo *repository.TransactionRepo,
	phoneListRepo *repository.PhoneListRepo,
	asynqClient *asynq.Client,
) *PollOTPHandler {
	return &PollOTPHandler{
		txRepo:         txRepo,
		phoneListRepo:  phoneListRepo,
		providerClient: provider.NewClient(),
		asynqClient:    asynqClient,
	}
}

func (h *PollOTPHandler) Handle(ctx context.Context, t *asynq.Task) error {
	var payload queue.PollOTPPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	tx, err := h.txRepo.FindByID(payload.TransactionID)
	if err != nil {
		return fmt.Errorf("find transaction %d: %w", payload.TransactionID, err)
	}

	// Only poll if still waiting
	if tx.Status != model.StatusWaitingOTP {
		log.Printf("[PollOTP] tx %d status=%s, skipping", tx.ID, tx.Status)
		return nil
	}

	p := tx.Provider
	deadline := tx.CreatedAt.Add(time.Duration(p.Timeout) * time.Second)

	// Timeout check
	if time.Now().After(deadline) {
		log.Printf("[PollOTP] tx %d timed out after %ds", tx.ID, p.Timeout)
		return h.enqueueRefund(tx.ID, "timeout")
	}

	url := p.URLOtp + tx.RequestID
	resp, err := h.providerClient.GetJSON(url)
	if err != nil {
		log.Printf("[PollOTP] tx %d provider error: %v", tx.ID, err)
		// Transient error → retry after delay
		return h.scheduleNextPoll(tx.ID, payload.Attempt+1, time.Duration(p.TimeDelay)*time.Second)
	}

	log.Printf("[PollOTP] tx %d raw response: %v", tx.ID, resp)

	// Fatal error check: e.g. "Isdn is not pick" (Error_Code=6)
	// Admin-configurable per provider via key_error_code + error_code_fatal
	if p.ErrorCodeFatal != "" {
		keyEC := p.KeyErrorCode
		if keyEC == "" {
			keyEC = "Error_Code" // default key nếu admin không nhập
		}
		errCode := provider.ExtractPath(resp, keyEC)
		// Normalize both sides: "06" == "6" == "6.0"
		if errCode != "" && normalizeCode(errCode) == normalizeCode(p.ErrorCodeFatal) {
			log.Printf("[PollOTP] tx %d FATAL error: %s=%s phone=%s → mark bad + refund",
				tx.ID, p.KeyErrorCode, errCode, tx.Phone)

			// Mark phone as 'bad' so admin can see and clean up.
			// InsertOrMarkBad handles both UsePhoneList=true (UPDATE existing row)
			// and UsePhoneList=false (INSERT new row with status='bad').
			if tx.Phone != "" {
				if markErr := h.phoneListRepo.InsertOrMarkBad(p.ID, tx.Phone); markErr != nil {
					log.Printf("[PollOTP] tx %d failed to mark phone %s bad: %v", tx.ID, tx.Phone, markErr)
				} else {
					log.Printf("[PollOTP] phone %s marked BAD in provider %d", tx.Phone, p.ID)
				}
			}

			return h.enqueueRefund(tx.ID, fmt.Sprintf("phone unavailable (%s=%s)", p.KeyErrorCode, errCode))
		}
	}

	// Extract OTP
	otpRaw := provider.ExtractPath(resp, p.KeyOtp)
	if otpRaw != "" {
		// Upstream "done" signal (e.g. "timeout" from otptextnow) → refund immediately
		if p.KeyOtpDone != "" && otpRaw == p.KeyOtpDone {
			log.Printf("[PollOTP] tx %d upstream done signal (%s=%s) → refund", tx.ID, p.KeyOtp, otpRaw)
			return h.enqueueRefund(tx.ID, "upstream provider: "+otpRaw)
		}

		match := otpRegex.FindString(otpRaw)
		if match != "" {
			log.Printf("[PollOTP] tx %d got OTP=%s", tx.ID, match)
			return h.txRepo.SetOTP(tx.ID, match, model.StatusSuccess)
		}
	}

	// No OTP yet, schedule next poll
	return h.scheduleNextPoll(tx.ID, payload.Attempt+1, time.Duration(p.TimeDelay)*time.Second)
}

func (h *PollOTPHandler) scheduleNextPoll(txID uint, attempt int, delay time.Duration) error {
	payload, _ := json.Marshal(queue.PollOTPPayload{TransactionID: txID, Attempt: attempt})
	task := asynq.NewTask(queue.TypePollOTP, payload)
	_, err := h.asynqClient.Enqueue(task,
		asynq.Queue("otp"),
		asynq.ProcessIn(delay),
	)
	return err
}

func (h *PollOTPHandler) enqueueRefund(txID uint, reason string) error {
	payload, _ := json.Marshal(queue.RefundPayload{TransactionID: txID, Reason: reason})
	task := asynq.NewTask(queue.TypeRefund, payload)
	_, err := h.asynqClient.Enqueue(task, asynq.Queue("refund"))
	return err
}
