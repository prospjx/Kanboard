package main

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type contextKey string

const userContextKey contextKey = "user_id"
const userEmailKey contextKey = "user_email"

type JWK struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Use string `json:"use"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type JWKSResponse struct {
	Keys []JWK `json:"keys"`
}

var (
	jwksCache     = make(map[string]*rsa.PublicKey)
	jwksCacheMu   sync.RWMutex
	jwksFetchedAt time.Time
)

// fetchJWKS fetches the public keys from Supabase JWKS endpoint
func fetchJWKS(supabaseURL string) error {
	jwksCacheMu.Lock()
	defer jwksCacheMu.Unlock()

	// Cache for 1 hour
	if time.Since(jwksFetchedAt) < time.Hour && len(jwksCache) > 0 {
		return nil
	}

	endpoint := strings.TrimRight(supabaseURL, "/") + "/auth/v1/.well-known/jwks.json"
	resp, err := http.Get(endpoint)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch JWKS: status %d", resp.StatusCode)
	}

	var jwks JWKSResponse
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return err
	}

	for _, k := range jwks.Keys {
		if k.Kty == "RSA" {
			nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
			if err != nil {
				continue
			}
			eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
			if err != nil {
				continue
			}
			var eInt int
			for _, b := range eBytes {
				eInt = (eInt << 8) | int(b)
			}
			pubKey := &rsa.PublicKey{
				N: new(big.Int).SetBytes(nBytes),
				E: eInt,
			}
			jwksCache[k.Kid] = pubKey
		}
	}
	jwksFetchedAt = time.Now()
	return nil
}

// AuthMiddleware extracts and verifies Supabase JWT token or development bearer
func AuthMiddleware(supabaseURL, jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, `{"error": "Missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				http.Error(w, `{"error": "Invalid authorization format"}`, http.StatusUnauthorized)
				return
			}

			tokenStr := parts[1]

			// Development fallback / mock token support for local testing without cloud credentials
			if strings.HasPrefix(tokenStr, "mock-user-") {
				mockID := strings.TrimPrefix(tokenStr, "mock-user-")
				if parsedUUID, err := uuid.Parse(mockID); err == nil {
					ctx := context.WithValue(r.Context(), userContextKey, parsedUUID)
					ctx = context.WithValue(ctx, userEmailKey, "demo@example.com")
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
			}

			// Validate JWT
			token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
				// Check signing method
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); ok {
					return []byte(jwtSecret), nil
				}
				if _, ok := token.Method.(*jwt.SigningMethodRSA); ok {
					if kid, ok := token.Header["kid"].(string); ok {
						if err := fetchJWKS(supabaseURL); err == nil {
							jwksCacheMu.RLock()
							defer jwksCacheMu.RUnlock()
							if pubKey, exists := jwksCache[kid]; exists {
								return pubKey, nil
							}
						}
					}
				}
				return []byte(jwtSecret), nil
			})

			if err != nil || !token.Valid {
				// Also allow mock header in dev mode if explicitly configured
				http.Error(w, fmt.Sprintf(`{"error": "Unauthorized token: %v"}`, err), http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, `{"error": "Invalid token claims"}`, http.StatusUnauthorized)
				return
			}

			subStr, _ := claims["sub"].(string)
			userID, err := uuid.Parse(subStr)
			if err != nil {
				http.Error(w, `{"error": "Invalid user ID in token"}`, http.StatusUnauthorized)
				return
			}

			email, _ := claims["email"].(string)

			ctx := context.WithValue(r.Context(), userContextKey, userID)
			ctx = context.WithValue(ctx, userEmailKey, email)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUserID(ctx context.Context) uuid.UUID {
	val, ok := ctx.Value(userContextKey).(uuid.UUID)
	if !ok {
		return uuid.Nil
	}
	return val
}

func GetUserEmail(ctx context.Context) string {
	val, ok := ctx.Value(userEmailKey).(string)
	if !ok {
		return ""
	}
	return val
}

