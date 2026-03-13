package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/quanghuyvfarm79/vframotp/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

type UserHandler struct {
	userRepo *repository.UserRepo
	txRepo   *repository.TransactionRepo
}

func NewUserHandler(userRepo *repository.UserRepo, txRepo *repository.TransactionRepo) *UserHandler {
	return &UserHandler{userRepo: userRepo, txRepo: txRepo}
}

// GET /user/profile
func (h *UserHandler) GetProfile(c *gin.Context) {
	userID := c.GetUint("user_id")
	user, err := h.userRepo.FindByID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":      user.ID,
		"email":   user.Email,
		"role":    user.Role,
		"balance": user.Balance,
	})
}

// GET /user/transactions?page=1&limit=20
func (h *UserHandler) GetTransactions(c *gin.Context) {
	userID := c.GetUint("user_id")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	txs, total, err := h.txRepo.ListByUser(userID, offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type txItem struct {
		ID           uint   `json:"id"`
		ProviderName string `json:"provider_name"`
		Phone        string `json:"phone"`
		OTP          string `json:"otp"`
		Status       string `json:"status"`
		Amount       int64  `json:"amount"`
		Refunded     bool   `json:"refunded"`
		CreatedAt    string `json:"created_at"`
	}
	items := make([]txItem, 0, len(txs))
	for _, tx := range txs {
		items = append(items, txItem{
			ID:           tx.ID,
			ProviderName: tx.Provider.Name,
			Phone:        tx.Phone,
			OTP:          tx.OTP,
			Status:       tx.Status,
			Amount:       tx.Amount,
			Refunded:     tx.Refunded,
			CreatedAt:    tx.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GET /user/balance-logs?page=1&limit=20&type=deduct
func (h *UserHandler) GetBalanceLogs(c *gin.Context) {
	userID := c.GetUint("user_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit
	typeFilter := c.Query("type")
	// only allow known types
	if typeFilter != "topup" && typeFilter != "deduct" && typeFilter != "refund" {
		typeFilter = ""
	}

	logs, total, err := h.userRepo.ListBalanceLogs(userID, offset, limit, typeFilter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type logItem struct {
		ID        uint   `json:"id"`
		Type      string `json:"type"`
		Amount    int64  `json:"amount"`
		RefID     *uint  `json:"ref_id"`
		Note      string `json:"note"`
		CreatedAt string `json:"created_at"`
	}
	items := make([]logItem, 0, len(logs))
	for _, l := range logs {
		items = append(items, logItem{
			ID:        l.ID,
			Type:      l.Type,
			Amount:    l.Amount,
			RefID:     l.RefID,
			Note:      l.Note,
			CreatedAt: l.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": total, "page": page, "limit": limit})
}

// POST /user/change-password
func (h *UserHandler) ChangePassword(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.userRepo.FindByID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "user not found"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.OldPassword)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mật khẩu cũ không đúng"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "hash error"})
		return
	}

	if err := h.userRepo.UpdatePassword(userID, string(hashed)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Đổi mật khẩu thành công"})
}
