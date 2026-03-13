package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	pkgjwt "github.com/quanghuyvfarm79/vframotp/pkg/jwt"
)

func JWTAuth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing or invalid Authorization header"})
			return
		}
		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

		claims, err := pkgjwt.Verify(secret, tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("role", claims.Role)
		c.Next()
	}
}
