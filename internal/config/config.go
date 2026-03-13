package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv  string
	APIPort string

	DBHost string
	DBPort string
	DBUser string
	DBPass string
	DBName string

	RedisAddr string

	JWTSecret string

	WorkerConcurrency string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, reading from environment")
	}

	return &Config{
		AppEnv:  getEnv("APP_ENV", "development"),
		APIPort: getEnv("API_PORT", "8080"),

		DBHost: getEnv("DB_HOST", "localhost"),
		DBPort: getEnv("DB_PORT", "5432"),
		DBUser: getEnv("DB_USER", "vframotp"),
		DBPass: getEnv("DB_PASS", "secret"),
		DBName: getEnv("DB_NAME", "vframotp"),

		RedisAddr: getEnv("REDIS_ADDR", "localhost:6379"),

		JWTSecret: getEnv("JWT_SECRET", "change_me"),

		WorkerConcurrency: getEnv("WORKER_CONCURRENCY", "50"),
	}
}

func (c *Config) DSN() string {
	return "host=" + c.DBHost +
		" user=" + c.DBUser +
		" password=" + c.DBPass +
		" dbname=" + c.DBName +
		" port=" + c.DBPort +
		" sslmode=disable TimeZone=Asia/Ho_Chi_Minh"
}

func getEnv(key, defaultValue string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultValue
}
