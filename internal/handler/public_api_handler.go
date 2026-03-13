package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/quanghuyvfarm79/vframotp/internal/model"
	"github.com/quanghuyvfarm79/vframotp/internal/repository"
	"github.com/quanghuyvfarm79/vframotp/internal/service"
	"gorm.io/gorm"
)

type PublicAPIHandler struct {
	otpSvc       *service.OTPService
	providerRepo *repository.ProviderRepo
	txRepo       *repository.TransactionRepo
}

func NewPublicAPIHandler(
	otpSvc *service.OTPService,
	providerRepo *repository.ProviderRepo,
	txRepo *repository.TransactionRepo,
) *PublicAPIHandler {
	return &PublicAPIHandler{
		otpSvc:       otpSvc,
		providerRepo: providerRepo,
		txRepo:       txRepo,
	}
}

func (h *PublicAPIHandler) Handle(c *gin.Context) {
	action := c.Query("action")
	switch action {
	case "get_all_services":
		h.getServices(c)
	case "get_number":
		h.getNumber(c)
	case "get_code":
		h.getCode(c)
	case "renew":
		h.renew(c)
	case "renew_phone":
		h.renewPhone(c)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown action"})
	}
}

func (h *PublicAPIHandler) getServices(c *gin.Context) {
	providers, err := h.providerRepo.ListActive()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	type serviceItem struct {
		ID      uint   `json:"id"`
		Name    string `json:"name"`
		Price   int64  `json:"price"`
		Timeout int    `json:"timeout"`
	}
	result := make([]serviceItem, 0, len(providers))
	for _, p := range providers {
		result = append(result, serviceItem{
			ID:      p.ID,
			Name:    p.Name,
			Price:   p.Fee,
			Timeout: p.Timeout,
		})
	}
	c.JSON(http.StatusOK, result)
}

func (h *PublicAPIHandler) getNumber(c *gin.Context) {
	userID := c.GetUint("user_id")
	providerID, err := strconv.ParseUint(c.Query("id"), 10, 64)
	if err != nil || providerID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid provider id"})
		return
	}

	result, err := h.otpSvc.InitiateOTPSync(userID, uint(providerID))
	if err != nil {
		if errors.Is(err, service.ErrInsufficientBalance) {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "Your balance is not enough!"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"number":     result.Phone,
		"request_id": result.RequestID,
	})
}

func (h *PublicAPIHandler) getCode(c *gin.Context) {
	userID := c.GetUint("user_id")
	requestID := c.Query("id")
	if requestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "missing id"})
		return
	}

	tx, err := h.txRepo.FindByRequestID(userID, requestID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusOK, gin.H{"success": true, "otp_code": "timeout"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	switch tx.Status {
	case model.StatusSuccess:
		c.JSON(http.StatusOK, gin.H{"success": true, "otp_code": tx.OTP})
	case model.StatusFailed, model.StatusCancelled:
		c.JSON(http.StatusOK, gin.H{"success": true, "otp_code": "timeout"})
	default:
		// pending, waiting_phone, waiting_otp
		c.JSON(http.StatusOK, gin.H{"success": true, "otp_code": "is_comming"})
	}
}

func (h *PublicAPIHandler) renewPhone(c *gin.Context) {
	userID := c.GetUint("user_id")
	providerID, err := strconv.ParseUint(c.Query("id"), 10, 64)
	if err != nil || providerID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid provider id"})
		return
	}
	phone := c.Query("phone")
	if phone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "missing phone"})
		return
	}

	result, err := h.otpSvc.RenewPhone(userID, uint(providerID), phone)
	if err != nil {
		if errors.Is(err, service.ErrInsufficientBalance) {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "Your balance is not enough!"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"message":    "Successfully!",
		"number":     result.Phone,
		"request_id": result.RequestID,
	})
}

func (h *PublicAPIHandler) renew(c *gin.Context) {
	userID := c.GetUint("user_id")
	requestID := c.Query("id")
	if requestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "missing id"})
		return
	}

	tx, err := h.txRepo.FindByRequestID(userID, requestID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "transaction not found"})
		return
	}

	// Only renew if still waiting
	if tx.Status != model.StatusWaitingOTP && tx.Status != model.StatusWaitingPhone && tx.Status != model.StatusPending {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "transaction already finalized"})
		return
	}

	// Cancel current + refund
	updated, err := h.txRepo.SetFailed(tx.ID, "timeout: cancelled by user renew")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	if !updated {
		// Another concurrent request already finalized this transaction
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "transaction already finalized"})
		return
	}
	if tx.Amount > 0 {
		_ = h.otpSvc.RefundForRenew(tx.UserID, tx.Amount, tx.ID, tx.Provider.UsePhoneList, tx.ProviderID, tx.Phone)
	}

	// Get new number from same provider
	result, err := h.otpSvc.InitiateOTPSync(userID, tx.ProviderID)
	if err != nil {
		if errors.Is(err, service.ErrInsufficientBalance) {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "Your balance is not enough!"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"message":    "Successfully!",
		"number":     result.Phone,
		"request_id": result.RequestID,
	})
}
