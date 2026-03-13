package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/hibiken/asynq"
	"github.com/quanghuyvfarm79/vframotp/internal/model"
	"github.com/quanghuyvfarm79/vframotp/internal/queue"
	"github.com/quanghuyvfarm79/vframotp/internal/repository"
	"github.com/quanghuyvfarm79/vframotp/pkg/provider"
)

type GetPhoneHandler struct {
	txRepo        *repository.TransactionRepo
	phoneListRepo *repository.PhoneListRepo
	providerClient *provider.Client
	asynqClient   *asynq.Client
}

func NewGetPhoneHandler(
	txRepo *repository.TransactionRepo,
	phoneListRepo *repository.PhoneListRepo,
	asynqClient *asynq.Client,
) *GetPhoneHandler {
	return &GetPhoneHandler{
		txRepo:        txRepo,
		phoneListRepo: phoneListRepo,
		providerClient: provider.NewClient(),
		asynqClient:   asynqClient,
	}
}

func (h *GetPhoneHandler) Handle(ctx context.Context, t *asynq.Task) error {
	var payload queue.GetPhonePayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	tx, err := h.txRepo.FindByID(payload.TransactionID)
	if err != nil {
		return fmt.Errorf("find transaction %d: %w", payload.TransactionID, err)
	}

	// Guard: skip if already processed (retry safety)
	if tx.Status != model.StatusPending {
		log.Printf("[GetPhone] tx %d already in status %s, skipping", tx.ID, tx.Status)
		return nil
	}

	p := tx.Provider
	url := p.URL
	var claimedPhone string

	// Phone list mode: claim a phone and append to URL
	if p.UsePhoneList {
		phone, err := h.phoneListRepo.ClaimPhone(p.ID)
		if err != nil {
			return h.enqueueRefund(tx.ID, "no available phone: "+err.Error())
		}
		claimedPhone = phone
		url = url + phone
	}

	if err := h.txRepo.UpdateStatus(tx.ID, model.StatusWaitingPhone); err != nil {
		if claimedPhone != "" {
			_ = h.phoneListRepo.ReleasePhone(p.ID, claimedPhone)
		}
		return err
	}

	resp, err := h.providerClient.GetJSON(url)
	if err != nil {
		if claimedPhone != "" {
			_ = h.phoneListRepo.ReleasePhone(p.ID, claimedPhone)
		}
		return h.enqueueRefund(tx.ID, "provider error: "+err.Error())
	}

	phone := provider.ExtractPath(resp, p.KeyPhone)
	requestID := provider.ExtractPath(resp, p.KeyReqID)

	if phone == "" {
		return h.enqueueRefund(tx.ID, "provider returned no phone")
	}
	// Legacy fallback: if no request_id, use phone
	if requestID == "" {
		requestID = phone
	}

	if err := h.txRepo.SetPhone(tx.ID, phone, requestID, model.StatusWaitingOTP); err != nil {
		return err
	}

	pollPayload, _ := json.Marshal(queue.PollOTPPayload{TransactionID: tx.ID, Attempt: 0})
	pollTask := asynq.NewTask(queue.TypePollOTP, pollPayload)
	_, err = h.asynqClient.Enqueue(pollTask, asynq.Queue("otp"))
	return err
}

func (h *GetPhoneHandler) enqueueRefund(txID uint, reason string) error {
	payload, _ := json.Marshal(queue.RefundPayload{TransactionID: txID, Reason: reason})
	task := asynq.NewTask(queue.TypeRefund, payload)
	_, err := h.asynqClient.Enqueue(task, asynq.Queue("refund"))
	return err
}
