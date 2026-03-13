package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/quanghuyvfarm79/vframotp/internal/model"
	"github.com/quanghuyvfarm79/vframotp/internal/repository"
	pkgjwt "github.com/quanghuyvfarm79/vframotp/pkg/jwt"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	ErrEmailTaken      = errors.New("email already taken")
	ErrUserNotFound    = errors.New("email not registered")
	ErrInvalidCreds    = errors.New("wrong password")
	ErrAccountDisabled = errors.New("account is disabled")
)

type AuthService struct {
	userRepo  *repository.UserRepo
	jwtSecret string
}

func NewAuthService(userRepo *repository.UserRepo, jwtSecret string) *AuthService {
	return &AuthService{userRepo: userRepo, jwtSecret: jwtSecret}
}

func (s *AuthService) Register(email, password string) (*model.User, error) {
	_, err := s.userRepo.FindByEmail(email)
	if err == nil {
		return nil, ErrEmailTaken
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, err
	}

	user := &model.User{
		Email:    email,
		Password: string(hash),
		Role:     "user",
		Balance:  0,
		Active:   true,
	}
	if err := s.userRepo.Create(user); err != nil {
		return nil, err
	}
	return user, nil
}

type LoginResult struct {
	Token string
	User  *model.User
}

func (s *AuthService) Login(email, password, ua string) (*LoginResult, error) {
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	if !user.Active {
		return nil, ErrAccountDisabled
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return nil, ErrInvalidCreds
	}

	token, err := pkgjwt.Sign(s.jwtSecret, user.ID, user.Role, 24*time.Hour)
	if err != nil {
		return nil, err
	}
	go s.userRepo.UpdateLastLogin(user.ID, ua)
	return &LoginResult{Token: token, User: user}, nil
}

// GenerateAPIKey creates a new random API key, stores sha256 hash + raw key, returns raw key
func (s *AuthService) GenerateAPIKey(userID uint) (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	rawHex := hex.EncodeToString(raw) // 64-char hex string

	hash := sha256.Sum256([]byte(rawHex))
	hashedHex := hex.EncodeToString(hash[:])

	if err := s.userRepo.UpdateAPIKey(userID, hashedHex, rawHex); err != nil {
		return "", err
	}
	return rawHex, nil
}

// GetCurrentAPIKey returns the raw API key stored for the user (empty if none)
func (s *AuthService) GetCurrentAPIKey(userID uint) string {
	return s.userRepo.GetRawAPIKey(userID)
}

// HashAPIKey hashes a raw API key for lookup
func HashAPIKey(raw string) string {
	hash := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(hash[:])
}
