package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/quanghuyvfarm79/vframotp/internal/service"
)

type AuthHandler struct {
	authSvc *service.AuthService
}

func NewAuthHandler(authSvc *service.AuthService) *AuthHandler {
	return &AuthHandler{authSvc: authSvc}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.authSvc.Register(req.Email, req.Password)
	if err != nil {
		if errors.Is(err, service.ErrEmailTaken) {
			c.JSON(http.StatusConflict, gin.H{"error": "Email already taken"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Registration failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Registration successful",
		"user": gin.H{
			"id":    user.ID,
			"email": user.Email,
			"role":  user.Role,
		},
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ua := c.GetHeader("User-Agent")
	result, err := h.authSvc.Login(req.Email, req.Password, ua)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrUserNotFound):
			c.JSON(http.StatusUnauthorized, gin.H{"error": "email_not_found"})
		case errors.Is(err, service.ErrInvalidCreds):
			c.JSON(http.StatusUnauthorized, gin.H{"error": "wrong_password"})
		case errors.Is(err, service.ErrAccountDisabled):
			c.JSON(http.StatusUnauthorized, gin.H{"error": "account_disabled"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Login failed"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": result.Token,
		"user": gin.H{
			"id":      result.User.ID,
			"email":   result.User.Email,
			"role":    result.User.Role,
			"balance": result.User.Balance,
		},
	})
}

// GET /auth/apikey — returns current key (empty if none)
func (h *AuthHandler) GetAPIKey(c *gin.Context) {
	userID := c.GetUint("user_id")
	rawKey := h.authSvc.GetCurrentAPIKey(userID)
	c.JSON(http.StatusOK, gin.H{"api_key": rawKey})
}

// POST /auth/apikey — regenerate key
func (h *AuthHandler) RegenerateAPIKey(c *gin.Context) {
	userID := c.GetUint("user_id")
	rawKey, err := h.authSvc.GenerateAPIKey(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate API key"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"api_key": rawKey})
}
