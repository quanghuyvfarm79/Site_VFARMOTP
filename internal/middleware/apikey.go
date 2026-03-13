package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/quanghuyvfarm79/vframotp/internal/repository"
	"github.com/quanghuyvfarm79/vframotp/internal/service"
)

func APIKeyAuth(userRepo *repository.UserRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		rawKey := c.Query("key")
		if rawKey == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "API key required"})
			return
		}

		hashedKey := service.HashAPIKey(rawKey)
		user, err := userRepo.FindByAPIKey(hashedKey)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid API key"})
			return
		}

		c.Set("user_id", user.ID)
		c.Set("role", user.Role)
		c.Next()
	}
}
