package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hibiken/asynq"
	"github.com/quanghuyvfarm79/vframotp/internal/config"
	"github.com/quanghuyvfarm79/vframotp/internal/handler"
	"github.com/quanghuyvfarm79/vframotp/internal/middleware"
	"github.com/quanghuyvfarm79/vframotp/internal/repository"
	"github.com/quanghuyvfarm79/vframotp/internal/service"
)

func main() {
	cfg := config.Load()

	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Dependencies
	db := repository.NewDB(cfg)
	userRepo := repository.NewUserRepo(db)
	providerRepo := repository.NewProviderRepo(db)
	txRepo := repository.NewTransactionRepo(db)
	phoneListRepo := repository.NewPhoneListRepo(db)

	asynqClient := asynq.NewClient(asynq.RedisClientOpt{Addr: cfg.RedisAddr})
	defer asynqClient.Close()

	authSvc := service.NewAuthService(userRepo, cfg.JWTSecret)
	otpSvc := service.NewOTPService(txRepo, providerRepo, userRepo, phoneListRepo, asynqClient)

	authHandler := handler.NewAuthHandler(authSvc)
	publicAPIHandler := handler.NewPublicAPIHandler(otpSvc, providerRepo, txRepo)
	userHandler := handler.NewUserHandler(userRepo, txRepo)
	adminHandler := handler.NewAdminHandler(userRepo, txRepo, providerRepo, phoneListRepo, otpSvc)

	r := gin.Default()

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Auth routes (public)
	auth := r.Group("/auth")
	{
		auth.POST("/register", authHandler.Register)
		auth.POST("/login", authHandler.Login)
	}

	// Protected auth routes (JWT required)
	authProtected := r.Group("/auth")
	authProtected.Use(middleware.JWTAuth(cfg.JWTSecret))
	{
		authProtected.GET("/apikey", authHandler.GetAPIKey)
		authProtected.POST("/apikey", authHandler.RegenerateAPIKey)
	}

	// Public API (API Key auth)
	api := r.Group("/api")
	api.Use(middleware.APIKeyAuth(userRepo))
	{
		api.GET("/", publicAPIHandler.Handle)
	}

	// User routes (JWT required)
	userGroup := r.Group("/user")
	userGroup.Use(middleware.JWTAuth(cfg.JWTSecret))
	{
		userGroup.GET("/profile", userHandler.GetProfile)
		userGroup.GET("/transactions", userHandler.GetTransactions)
		userGroup.GET("/balance-logs", userHandler.GetBalanceLogs)
		userGroup.POST("/change-password", userHandler.ChangePassword)
	}

	// Admin routes (JWT + admin role required)
	admin := r.Group("/admin")
	admin.Use(middleware.JWTAuth(cfg.JWTSecret))
	admin.Use(middleware.RequireRole("admin"))
	{
		admin.GET("/stats", adminHandler.GetStats)
		admin.GET("/stats/chart", adminHandler.GetChartStats)
		admin.GET("/stats/otp-hourly", adminHandler.GetOTPHourly)
		admin.GET("/stats/top-users", adminHandler.GetTopUsers)
		admin.GET("/stats/recent", adminHandler.GetRecentTransactions)
		admin.GET("/users", adminHandler.ListUsers)
		admin.POST("/users/:id/topup", adminHandler.TopupUser)
		admin.PUT("/users/:id/toggle", adminHandler.ToggleUser)
		admin.GET("/users/:id/stats", adminHandler.GetUserStats)
		admin.PUT("/users/:id", adminHandler.EditUser)
		admin.DELETE("/users/:id", adminHandler.DeleteUser)
		admin.GET("/providers", adminHandler.ListProviders)
		admin.POST("/providers", adminHandler.CreateProvider)
		admin.PUT("/providers/:id", adminHandler.UpdateProvider)
		admin.PUT("/providers/:id/toggle", adminHandler.ToggleProvider)
		admin.DELETE("/providers/:id", adminHandler.DeleteProvider)
		admin.GET("/transactions", adminHandler.ListTransactions)
		admin.GET("/providers/:id/phones", adminHandler.ListPhones)
		admin.POST("/providers/:id/phones", adminHandler.AddPhones)
		admin.POST("/providers/:id/phones/reset-used", adminHandler.ResetUsedPhones)
		admin.DELETE("/providers/:id/phones/used", adminHandler.DeleteUsedPhones)
		admin.DELETE("/providers/:id/phones/bad", adminHandler.DeleteBadPhones)
		admin.DELETE("/providers/:id/phones/:phone", adminHandler.DeletePhone)
		admin.POST("/cleanup-stuck", adminHandler.CleanupStuck)
	}

	addr := ":" + cfg.APIPort
	log.Printf("API server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
