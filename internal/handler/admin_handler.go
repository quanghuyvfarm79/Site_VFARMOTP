package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/quanghuyvfarm79/vframotp/internal/model"
	"github.com/quanghuyvfarm79/vframotp/internal/repository"
	"github.com/quanghuyvfarm79/vframotp/internal/service"
)

type AdminHandler struct {
	userRepo      *repository.UserRepo
	txRepo        *repository.TransactionRepo
	providerRepo  *repository.ProviderRepo
	phoneListRepo *repository.PhoneListRepo
	otpSvc        *service.OTPService
}

func NewAdminHandler(
	userRepo *repository.UserRepo,
	txRepo *repository.TransactionRepo,
	providerRepo *repository.ProviderRepo,
	phoneListRepo *repository.PhoneListRepo,
	otpSvc *service.OTPService,
) *AdminHandler {
	return &AdminHandler{userRepo: userRepo, txRepo: txRepo, providerRepo: providerRepo, phoneListRepo: phoneListRepo, otpSvc: otpSvc}
}

// GET /admin/stats
func (h *AdminHandler) GetStats(c *gin.Context) {
	totalUsers, totalBalance := h.userRepo.CountAndBalance()
	totalTx, revenue, active, successRate := h.txRepo.Stats()
	todayTx, todayRevenue, todayUsers, totalTopup := h.txRepo.TodayStats()
	c.JSON(http.StatusOK, gin.H{
		"total_users":        totalUsers,
		"total_balance":      totalBalance,
		"total_transactions": totalTx,
		"total_revenue":      revenue,
		"active_sessions":    active,
		"today_transactions": todayTx,
		"today_revenue":      todayRevenue,
		"today_new_users":    todayUsers,
		"total_topup":        totalTopup,
		"success_rate":       successRate,
	})
}

// GET /admin/stats/chart?range=7d|30d|365d
func (h *AdminHandler) GetChartStats(c *gin.Context) {
	days := 30
	switch c.DefaultQuery("range", "30d") {
	case "7d":
		days = 7
	case "365d":
		days = 365
	}
	points, err := h.txRepo.ChartStats(days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, points)
}

// GET /admin/stats/otp-hourly
func (h *AdminHandler) GetOTPHourly(c *gin.Context) {
	points, err := h.txRepo.OTPHourly()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, points)
}

// GET /admin/stats/top-users
func (h *AdminHandler) GetTopUsers(c *gin.Context) {
	users, err := h.txRepo.TopUsers(10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, users)
}

// GET /admin/stats/recent
func (h *AdminHandler) GetRecentTransactions(c *gin.Context) {
	txs, err := h.txRepo.RecentTransactions(10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, txs)
}

// GET /admin/users
func (h *AdminHandler) ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 { page = 1 }
	if limit < 1 || limit > 100 { limit = 20 }
	offset := (page - 1) * limit

	users, total, err := h.userRepo.List(offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	type userItem struct {
		ID        uint   `json:"id"`
		Email     string `json:"email"`
		Role      string `json:"role"`
		Balance   int64  `json:"balance"`
		Active    bool   `json:"active"`
		CreatedAt string `json:"created_at"`
	}
	items := make([]userItem, 0, len(users))
	for _, u := range users {
		items = append(items, userItem{
			ID: u.ID, Email: u.Email, Role: u.Role,
			Balance: u.Balance, Active: u.Active,
			CreatedAt: u.CreatedAt.Format("2006-01-02 15:04"),
		})
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": total, "page": page, "limit": limit})
}

// POST /admin/users/:id/topup
func (h *AdminHandler) TopupUser(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var body struct {
		Amount int64  `json:"amount" binding:"required,min=1"`
		Note   string `json:"note"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.userRepo.AdminAddBalance(uint(id), body.Amount, body.Note, nil); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Nạp tiền thành công"})
}

// PUT /admin/users/:id/toggle
func (h *AdminHandler) ToggleUser(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	user, err := h.userRepo.FindByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if user.Role == "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Không thể khoá tài khoản admin"})
		return
	}
	if err := h.userRepo.SetActive(uint(id), !user.Active); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "active": !user.Active})
}

// GET /admin/users/:id/stats
func (h *AdminHandler) GetUserStats(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	stats := h.userRepo.GetUserStats(uint(id))
	resp := gin.H{
		"total_topup":   stats.TotalTopup,
		"total_spent":   stats.TotalSpent,
		"total_otp":     stats.TotalOTP,
		"last_login_ua": stats.LastLoginUA,
	}
	if stats.LastLoginAt != nil {
		resp["last_login_at"] = stats.LastLoginAt.Format("2006-01-02 15:04:05")
	} else {
		resp["last_login_at"] = nil
	}
	c.JSON(http.StatusOK, resp)
}

// PUT /admin/users/:id
func (h *AdminHandler) EditUser(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var body struct {
		Balance int64  `json:"balance"`
		Role    string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Role != "user" && body.Role != "admin" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role phải là user hoặc admin"})
		return
	}
	// Get current balance for audit log
	oldUser, _ := h.userRepo.FindByID(uint(id))
	if err := h.userRepo.EditUser(uint(id), body.Balance, body.Role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Write balance_log if balance changed
	if oldUser != nil && body.Balance != oldUser.Balance {
		delta := body.Balance - oldUser.Balance
		logType := model.BalanceTopup
		if delta < 0 {
			logType = model.BalanceDeduct
			delta = -delta
		}
		_ = h.userRepo.LogBalance(&model.BalanceLog{
			UserID: uint(id),
			Type:   logType,
			Amount: delta,
			Note:   "chỉnh sửa bởi admin",
		})
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// DELETE /admin/users/:id
func (h *AdminHandler) DeleteUser(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	user, err := h.userRepo.FindByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if user.Role == "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Không thể xoá tài khoản admin"})
		return
	}
	if err := h.userRepo.DeleteUser(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// PUT /admin/providers/:id/toggle
func (h *AdminHandler) ToggleProvider(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	provider, err := h.providerRepo.FindByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "provider not found"})
		return
	}
	newActive := !provider.Active
	if err := h.providerRepo.SetActive(uint(id), newActive); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "active": newActive})
}

// GET /admin/providers
func (h *AdminHandler) ListProviders(c *gin.Context) {
	providers, err := h.providerRepo.ListAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	type providerItem struct {
		ID             uint   `json:"id"`
		Name           string `json:"name"`
		Fee            int64  `json:"fee"`
		Price          int64  `json:"price"`
		Timeout        int    `json:"timeout"`
		TimeDelay      int    `json:"time_delay"`
		URL            string `json:"url"`
		URLOtp         string `json:"url_otp"`
		KeyPhone       string `json:"key_phone"`
		KeyReqID       string `json:"key_req_id"`
		KeyOtp         string `json:"key_otp"`
		UsePhoneList   bool   `json:"use_phone_list"`
		KeyErrorCode   string `json:"key_error_code"`
		ErrorCodeFatal string `json:"error_code_fatal"`
		KeyOtpDone     string `json:"key_otp_done"`
		AllowRenew     bool   `json:"allow_renew"`
		AutoResetUsed  bool   `json:"auto_reset_used"`
		Active         bool   `json:"active"`
		PhoneAvailable int64  `json:"phone_available"`
		PhoneUsed      int64  `json:"phone_used"`
		PhoneBad       int64  `json:"phone_bad"`
		PhoneTotal     int64  `json:"phone_total"`
	}
	items := make([]providerItem, 0, len(providers))
	for _, p := range providers {
		var avail, used, bad int64
		if p.UsePhoneList {
			avail, used, bad = h.phoneListRepo.CountsByProvider(p.ID)
		}
		items = append(items, providerItem{
			ID: p.ID, Name: p.Name, Fee: p.Fee, Price: p.Fee,
			Timeout: p.Timeout, TimeDelay: p.TimeDelay,
			URL: p.URL, URLOtp: p.URLOtp,
			KeyPhone: p.KeyPhone, KeyReqID: p.KeyReqID, KeyOtp: p.KeyOtp,
			UsePhoneList: p.UsePhoneList, KeyErrorCode: p.KeyErrorCode, ErrorCodeFatal: p.ErrorCodeFatal, KeyOtpDone: p.KeyOtpDone,
			AllowRenew: p.AllowRenew, AutoResetUsed: p.AutoResetUsed, Active: p.Active,
			PhoneAvailable: avail, PhoneUsed: used, PhoneBad: bad,
			PhoneTotal: avail + used + bad,
		})
	}
	c.JSON(http.StatusOK, items)
}

// POST /admin/providers
func (h *AdminHandler) CreateProvider(c *gin.Context) {
	var p model.Provider
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.providerRepo.Create(&p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p)
}

// PUT /admin/providers/:id
func (h *AdminHandler) UpdateProvider(c *gin.Context) {
	oldID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	existing, err := h.providerRepo.FindByID(uint(oldID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "provider not found"})
		return
	}
	if err := c.ShouldBindJSON(existing); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	newID := existing.ID
	if newID != uint(oldID) {
		if newID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID không hợp lệ"})
			return
		}
		if h.providerRepo.ExistsByID(newID) {
			c.JSON(http.StatusConflict, gin.H{"error": "ID " + strconv.FormatUint(uint64(newID), 10) + " đã tồn tại"})
			return
		}
		if err := h.providerRepo.ChangeID(uint(oldID), newID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Lỗi đổi ID: " + err.Error()})
			return
		}
	}
	if err := h.providerRepo.Update(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, existing)
}

// DELETE /admin/providers/:id
func (h *AdminHandler) DeleteProvider(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	// Delete phone_list entries first (FK constraint)
	if err := h.phoneListRepo.DeleteAllByProvider(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Lỗi xoá danh sách SIM: " + err.Error()})
		return
	}
	if err := h.providerRepo.Delete(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Không thể xoá Product (còn giao dịch liên quan): " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GET /admin/providers/:id/phones?page=1&limit=100
func (h *AdminHandler) ListPhones(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	if page < 1 { page = 1 }
	if limit < 1 || limit > 500 { limit = 100 }
	offset := (page - 1) * limit

	phones, total, err := h.phoneListRepo.ListByProvider(uint(id), offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": phones, "total": total, "page": page, "limit": limit})
}

// POST /admin/providers/:id/phones — body: {"phones": "...\n..."} (newline-separated)
func (h *AdminHandler) AddPhones(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var body struct {
		Phones string `json:"phones" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	lines := strings.Split(strings.ReplaceAll(body.Phones, "\r\n", "\n"), "\n")
	var entries []model.PhoneList
	for _, line := range lines {
		phone := strings.TrimSpace(line)
		if phone != "" {
			entries = append(entries, model.PhoneList{ProviderID: uint(id), Phone: phone, Status: "available"})
		}
	}
	if len(entries) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no valid phones"})
		return
	}
	added, err := h.phoneListRepo.BulkInsert(entries)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "added": added})
}

// POST /admin/providers/:id/phones/reset-used
func (h *AdminHandler) ResetUsedPhones(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	n, err := h.phoneListRepo.ResetUsedPhones(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "reset": n})
}

// DELETE /admin/providers/:id/phones/used
func (h *AdminHandler) DeleteUsedPhones(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	n, err := h.phoneListRepo.DeleteUsedPhones(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "deleted": n})
}

// DELETE /admin/providers/:id/phones/bad
func (h *AdminHandler) DeleteBadPhones(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	n, err := h.phoneListRepo.DeleteBadPhones(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "deleted": n})
}

// DELETE /admin/providers/:id/phones/:phone
func (h *AdminHandler) DeletePhone(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	phone := c.Param("phone")
	if err := h.phoneListRepo.DeletePhone(uint(id), phone); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GET /admin/transactions
func (h *AdminHandler) ListTransactions(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 { page = 1 }
	if limit < 1 || limit > 100 { limit = 20 }
	offset := (page - 1) * limit

	status := c.Query("status")
	validStatuses := map[string]bool{"success": true, "failed": true, "cancelled": true, "waiting_otp": true, "pending": true}
	if !validStatuses[status] {
		status = ""
	}
	search := strings.TrimSpace(c.Query("search"))
	if len(search) > 100 {
		search = search[:100]
	}

	txs, total, err := h.txRepo.ListAll(offset, limit, repository.ListAllFilter{Status: status, Search: search})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	type txItem struct {
		ID           uint   `json:"id"`
		UserEmail    string `json:"user_email"`
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
			ID: tx.ID, UserEmail: tx.User.Email, ProviderName: tx.Provider.Name,
			Phone: tx.Phone, OTP: tx.OTP, Status: tx.Status,
			Amount: tx.Amount, Refunded: tx.Refunded,
			CreatedAt: tx.CreatedAt.Format("2006-01-02 15:04"),
		})
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": total, "page": page, "limit": limit})
}

// POST /admin/cleanup-stuck — refund all transactions stuck past their deadline
func (h *AdminHandler) CleanupStuck(c *gin.Context) {
	count, err := h.otpSvc.CleanupStuck()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "refunded": count})
}
