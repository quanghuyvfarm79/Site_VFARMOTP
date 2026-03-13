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
)

type RefundHandler struct {
	txRepo        *repository.TransactionRepo
	userRepo      *repository.UserRepo
	phoneListRepo *repository.PhoneListRepo
}

func NewRefundHandler(
	txRepo *repository.TransactionRepo,
	userRepo *repository.UserRepo,
	phoneListRepo *repository.PhoneListRepo,
) *RefundHandler {
	return &RefundHandler{
		txRepo:        txRepo,
		userRepo:      userRepo,
		phoneListRepo: phoneListRepo,
	}
}

func (h *RefundHandler) Handle(ctx context.Context, t *asynq.Task) error {
	var payload queue.RefundPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	tx, err := h.txRepo.FindByID(payload.TransactionID)
	if err != nil {
		return fmt.Errorf("find transaction %d: %w", payload.TransactionID, err)
	}

	// Atomically mark failed; if another job already finalized it, skip entirely.
	updated, err := h.txRepo.SetFailed(tx.ID, payload.Reason)
	if err != nil {
		return err
	}
	if !updated {
		log.Printf("[Refund] tx %d already finalized, skipping", tx.ID)
		return nil
	}

	// Refund balance
	if tx.Amount > 0 {
		if err := h.userRepo.RefundBalance(tx.UserID, tx.Amount); err != nil {
			log.Printf("[Refund] tx %d failed to refund balance: %v", tx.ID, err)
			return err
		}
	}

	// Insert balance log
	if tx.Amount > 0 {
		balanceLog := &model.BalanceLog{
			UserID: tx.UserID,
			Type:   model.BalanceRefund,
			Amount: tx.Amount,
			RefID:  &tx.ID,
			Note:   "refund: " + payload.Reason,
		}
		if err := h.userRepo.LogBalance(balanceLog); err != nil {
			log.Printf("[Refund] tx %d failed to log balance: %v", tx.ID, err)
		}
	}

	// Phone-list phones stay "used" after a transaction — admin resets them manually.

	log.Printf("[Refund] tx %d refunded %d VND, reason: %s", tx.ID, tx.Amount, payload.Reason)
	return nil
}
