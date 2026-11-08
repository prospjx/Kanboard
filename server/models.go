package main

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Profile struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	FullName  string    `json:"full_name"`
	AvatarURL string    `json:"avatar_url"`
	Color     string    `json:"color,omitempty"`
}

type Column struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Title     string    `json:"title"`
	Position  float64   `json:"position"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Tasks     []Task    `json:"tasks"`
}

type Subtask struct {
	ID          uuid.UUID `json:"id"`
	TaskID      uuid.UUID `json:"task_id"`
	Title       string    `json:"title"`
	IsCompleted bool      `json:"is_completed"`
	Position    int       `json:"position"`
	CreatedAt   time.Time `json:"created_at"`
}

type Comment struct {
	ID        uuid.UUID `json:"id"`
	TaskID    uuid.UUID `json:"task_id"`
	UserID    uuid.UUID `json:"user_id"`
	User      *Profile  `json:"user,omitempty"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

type ActivityLog struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	TaskID    *uuid.UUID `json:"task_id,omitempty"`
	TaskTitle string     `json:"task_title"`
	Action    string     `json:"action"` // created, moved, updated, commented
	Details   string     `json:"details"`
	CreatedAt time.Time  `json:"created_at"`
}

type Task struct {
	ID          uuid.UUID       `json:"id"`
	ColumnID    uuid.UUID       `json:"column_id"`
	Status      string          `json:"status"` // todo, in_progress, in_review, done
	UserID      uuid.UUID       `json:"user_id"`
	AssigneeID  *uuid.UUID      `json:"assignee_id,omitempty"`
	Assignee    *Profile        `json:"assignee,omitempty"`
	Assignees   []Profile       `json:"assignees,omitempty"`
	AssigneeIDs []uuid.UUID     `json:"assignee_ids,omitempty"`
	Title       string          `json:"title"`
	Description string          `json:"description"`
	Priority    string          `json:"priority"` // low, medium, high, urgent
	DueDate     *time.Time      `json:"due_date,omitempty"`
	Position    float64         `json:"position"`
	Labels      json.RawMessage `json:"labels"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
	Subtasks    []Subtask       `json:"subtasks"`
	Comments    []Comment       `json:"comments"`
}

// Request & Payload DTOs
type CreateColumnRequest struct {
	Title    string  `json:"title"`
	Position float64 `json:"position"`
}

type UpdateColumnRequest struct {
	Title    *string  `json:"title,omitempty"`
	Position *float64 `json:"position,omitempty"`
}

type CreateTaskRequest struct {
	ColumnID    uuid.UUID  `json:"column_id,omitempty"`
	Status      string     `json:"status,omitempty"` // todo, in_progress, in_review, done
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Priority    string     `json:"priority"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	AssigneeID  *uuid.UUID `json:"assignee_id,omitempty"`
	Labels      []string   `json:"labels"`
}

type UpdateTaskRequest struct {
	ColumnID    *uuid.UUID `json:"column_id,omitempty"`
	Status      *string    `json:"status,omitempty"`
	Title       *string    `json:"title,omitempty"`
	Description *string    `json:"description,omitempty"`
	Priority    *string    `json:"priority,omitempty"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	Position    *float64   `json:"position,omitempty"`
	AssigneeID  *uuid.UUID `json:"assignee_id,omitempty"`
	Labels      []string   `json:"labels,omitempty"`
}

type ReorderTaskRequest struct {
	TaskID      uuid.UUID `json:"task_id"`
	NewColumnID uuid.UUID `json:"new_column_id"`
	NewPosition float64   `json:"new_position"`
}

type CreateSubtaskRequest struct {
	Title string `json:"title"`
}

type UpdateSubtaskRequest struct {
	Title       *string `json:"title,omitempty"`
	IsCompleted *bool   `json:"is_completed,omitempty"`
}

type CreateCommentRequest struct {
	Content string `json:"content"`
}

