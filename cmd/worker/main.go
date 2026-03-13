package main

import (
	"log"
	"net/http"
	"strconv"

	"github.com/hibiken/asynq"
	"github.com/quanghuyvfarm79/vframotp/internal/config"
	"github.com/quanghuyvfarm79/vframotp/internal/queue"
	"github.com/quanghuyvfarm79/vframotp/internal/queue/handlers"
	"github.com/quanghuyvfarm79/vframotp/internal/repository"
)

func main() {
	cfg := config.Load()

	concurrency, err := strconv.Atoi(cfg.WorkerConcurrency)
	if err != nil {
		concurrency = 10
	}

	redisOpt := asynq.RedisClientOpt{Addr: cfg.RedisAddr}

	srv := asynq.NewServer(
		redisOpt,
		asynq.Config{
			Concurrency: concurrency,
			Queues: map[string]int{
				"otp":    10,
				"refund": 5,
			},
		},
	)

	// DB + repos
	db := repository.NewDB(cfg)
	txRepo := repository.NewTransactionRepo(db)
	userRepo := repository.NewUserRepo(db)
	phoneListRepo := repository.NewPhoneListRepo(db)

	// Asynq client (for handlers that enqueue follow-up tasks)
	asynqClient := asynq.NewClient(redisOpt)
	defer asynqClient.Close()

	// Handlers
	getPhoneH := handlers.NewGetPhoneHandler(txRepo, phoneListRepo, asynqClient)
	pollOTPH := handlers.NewPollOTPHandler(txRepo, phoneListRepo, asynqClient)
	refundH := handlers.NewRefundHandler(txRepo, userRepo, phoneListRepo)

	mux := asynq.NewServeMux()
	mux.HandleFunc(queue.TypeGetPhone, getPhoneH.Handle)
	mux.HandleFunc(queue.TypePollOTP, pollOTPH.Handle)
	mux.HandleFunc(queue.TypeRefund, refundH.Handle)

	// Asynq web dashboard on :8081
	inspector := asynq.NewInspector(redisOpt)
	_ = inspector
	go func() {
		// asynqmon dashboard (separate binary) - just expose health here
		http.HandleFunc("/worker/health", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"ok"}`))
		})
		log.Println("Worker health endpoint on :8081/worker/health")
		if err := http.ListenAndServe(":8081", nil); err != nil {
			log.Printf("Worker health server error: %v", err)
		}
	}()

	log.Printf("Worker starting with concurrency=%d", concurrency)
	if err := srv.Run(mux); err != nil {
		log.Fatalf("Failed to start worker: %v", err)
	}
}
