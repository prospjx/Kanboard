package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

type Server struct {
	store Store
}

func main() {
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	supabaseURL := os.Getenv("SUPABASE_URL")
	jwtSecret := os.Getenv("SUPABASE_JWT_SECRET")

	ctx := context.Background()
	store := InitStore(ctx)
	server := &Server{store: store}

	r := chi.NewRouter()

	// Global Middlewares
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// CORS configuration for local React Vite frontend
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status": "ok"}`))
	})

	// Protected API Routes
	r.Route("/api", func(api chi.Router) {
		api.Use(AuthMiddleware(supabaseURL, jwtSecret))

		// Profiles / Team
		api.Get("/profiles", server.handleGetProfiles)
		api.Post("/profiles", server.handleCreateProfile)
		api.Delete("/profiles/{profileID}", server.handleDeleteProfile)

		// Board (Columns & Nested Tasks)
		api.Get("/board", server.handleGetBoard)

		// Column operations
		api.Post("/columns", server.handleCreateColumn)
		api.Patch("/columns/{columnID}", server.handleUpdateColumn)
		api.Delete("/columns/{columnID}", server.handleDeleteColumn)

		// Task operations
		api.Post("/tasks", server.handleCreateTask)
		api.Patch("/tasks/{taskID}", server.handleUpdateTask)
		api.Post("/tasks/reorder", server.handleReorderTask)
		api.Delete("/tasks/{taskID}", server.handleDeleteTask)

		// Subtask operations
		api.Post("/tasks/{taskID}/subtasks", server.handleCreateSubtask)
		api.Patch("/subtasks/{subtaskID}", server.handleUpdateSubtask)
		api.Delete("/subtasks/{subtaskID}", server.handleDeleteSubtask)

		// Comment operations
		api.Post("/tasks/{taskID}/comments", server.handleCreateComment)

		// Activity logs
		api.Get("/activity", server.handleGetActivityLogs)
	})

	fmt.Printf("🚀 Kanban Go Backend running on http://localhost:%s\n", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Server stopped: %v", err)
	}
}

// Helpers
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// Handlers
func (s *Server) handleGetProfiles(w http.ResponseWriter, r *http.Request) {
	profiles, err := s.store.GetProfiles(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, profiles)
}

func (s *Server) handleCreateProfile(w http.ResponseWriter, r *http.Request) {
	var req CreateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.FullName == "" {
		writeError(w, http.StatusBadRequest, "Name is required")
		return
	}
	profile, err := s.store.CreateProfile(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, profile)
}

func (s *Server) handleDeleteProfile(w http.ResponseWriter, r *http.Request) {
	profileIDStr := chi.URLParam(r, "profileID")
	profileID, err := uuid.Parse(profileIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid profile ID")
		return
	}
	if err := s.store.DeleteProfile(r.Context(), profileID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Profile removed"})
}

func (s *Server) handleGetBoard(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	columns, err := s.store.GetBoard(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, columns)
}

func (s *Server) handleCreateColumn(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	var req CreateColumnRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	col, err := s.store.CreateColumn(r.Context(), userID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, col)
}

func (s *Server) handleUpdateColumn(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	columnIDStr := chi.URLParam(r, "columnID")
	columnID, err := uuid.Parse(columnIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid column ID")
		return
	}

	var req UpdateColumnRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	col, err := s.store.UpdateColumn(r.Context(), userID, columnID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, col)
}

func (s *Server) handleDeleteColumn(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	columnIDStr := chi.URLParam(r, "columnID")
	columnID, err := uuid.Parse(columnIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid column ID")
		return
	}

	if err := s.store.DeleteColumn(r.Context(), userID, columnID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Column deleted"})
}

func (s *Server) handleCreateTask(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	var req CreateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	task, err := s.store.CreateTask(r.Context(), userID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, task)
}

func (s *Server) handleUpdateTask(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	taskIDStr := chi.URLParam(r, "taskID")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid task ID")
		return
	}

	var req UpdateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	task, err := s.store.UpdateTask(r.Context(), userID, taskID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (s *Server) handleReorderTask(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	var req ReorderTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := s.store.ReorderTask(r.Context(), userID, req); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Task reordered"})
}

func (s *Server) handleDeleteTask(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	taskIDStr := chi.URLParam(r, "taskID")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid task ID")
		return
	}

	if err := s.store.DeleteTask(r.Context(), userID, taskID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Task deleted"})
}

func (s *Server) handleCreateSubtask(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	taskIDStr := chi.URLParam(r, "taskID")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid task ID")
		return
	}

	var req CreateSubtaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	st, err := s.store.CreateSubtask(r.Context(), userID, taskID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, st)
}

func (s *Server) handleUpdateSubtask(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	subtaskIDStr := chi.URLParam(r, "subtaskID")
	subtaskID, err := uuid.Parse(subtaskIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid subtask ID")
		return
	}

	var req UpdateSubtaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	st, err := s.store.UpdateSubtask(r.Context(), userID, subtaskID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (s *Server) handleDeleteSubtask(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	subtaskIDStr := chi.URLParam(r, "subtaskID")
	subtaskID, err := uuid.Parse(subtaskIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid subtask ID")
		return
	}

	if err := s.store.DeleteSubtask(r.Context(), userID, subtaskID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Subtask deleted"})
}

func (s *Server) handleCreateComment(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	taskIDStr := chi.URLParam(r, "taskID")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid task ID")
		return
	}

	var req CreateCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	cm, err := s.store.CreateComment(r.Context(), userID, taskID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, cm)
}

func (s *Server) handleGetActivityLogs(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	logs, err := s.store.GetActivityLogs(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, logs)
}

