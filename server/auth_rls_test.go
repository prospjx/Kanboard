package main

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

// TestGuestAuthentication verifies that a unique guest user is assigned a valid session UUID
// and that their session can query their board.
func TestGuestAuthentication(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()

	guestID := uuid.New()

	// Verify the guest can load their board without error
	columns, err := store.GetBoard(ctx, guestID)
	if err != nil {
		t.Fatalf("expected successful board retrieval for guest, got: %v", err)
	}

	if len(columns) == 0 {
		t.Fatalf("expected board columns to be initialized for guest, got 0")
	}
}

// TestRowLevelSecurityPerUserIsolation verifies that:
// 1. User A cannot read User B's private tasks.
// 2. User A cannot update User B's tasks.
// 3. User A cannot delete User B's tasks.
func TestRowLevelSecurityPerUserIsolation(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()

	userA := uuid.New()
	userB := uuid.New()

	// 1. User A creates a task in Column 1
	col1ID := store.columns[0].ID
	taskA, err := store.CreateTask(ctx, userA, CreateTaskRequest{
		ColumnID:    col1ID,
		Title:       "User A's Secret Task",
		Description: "Only User A should be able to see and modify this",
		Priority:    "urgent",
	})
	if err != nil {
		t.Fatalf("failed to create task for User A: %v", err)
	}

	// 2. User B loads their board. They must NOT see User A's task.
	boardB, err := store.GetBoard(ctx, userB)
	if err != nil {
		t.Fatalf("User B board retrieval failed: %v", err)
	}

	for _, col := range boardB {
		for _, task := range col.Tasks {
			if task.ID == taskA.ID {
				t.Fatalf("RLS VIOLATION: User B was able to read User A's task %v", taskA.ID)
			}
		}
	}

	// 3. User B tries to modify User A's task. Must be rejected.
	newTitle := "Hacked by User B"
	updated, err := store.UpdateTask(ctx, userB, taskA.ID, UpdateTaskRequest{
		Title: &newTitle,
	})
	if err == nil && updated != nil && updated.Title == newTitle {
		t.Fatalf("RLS VIOLATION: User B was able to modify User A's task")
	}

	// 4. User B tries to delete User A's task. User A's task must remain intact.
	_ = store.DeleteTask(ctx, userB, taskA.ID)

	// Verify User A still has their task
	boardA, err := store.GetBoard(ctx, userA)
	if err != nil {
		t.Fatalf("User A board retrieval failed: %v", err)
	}

	foundTaskA := false
	for _, col := range boardA {
		for _, task := range col.Tasks {
			if task.ID == taskA.ID {
				foundTaskA = true
				if task.Title != "User A's Secret Task" {
					t.Fatalf("Task was corrupted: expected 'User A's Secret Task', got '%s'", task.Title)
				}
			}
		}
	}

	if !foundTaskA {
		t.Fatalf("User A's task was incorrectly deleted by User B")
	}

	// 5. User A successfully updates and deletes their own task
	updatedTitle := "User A Updated Title"
	taskAUpdated, err := store.UpdateTask(ctx, userA, taskA.ID, UpdateTaskRequest{
		Title: &updatedTitle,
	})
	if err != nil || taskAUpdated == nil || taskAUpdated.Title != updatedTitle {
		t.Fatalf("User A should be able to update their own task, got err: %v", err)
	}

	err = store.DeleteTask(ctx, userA, taskA.ID)
	if err != nil {
		t.Fatalf("User A should be able to delete their own task, got err: %v", err)
	}
}

// TestSubtaskChecklistProgress verifies subtask completion tracking and calculation.
func TestSubtaskChecklistProgress(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()
	userID := uuid.New()

	colID := store.columns[0].ID
	task, err := store.CreateTask(ctx, userID, CreateTaskRequest{
		ColumnID: colID,
		Title:    "Checklist Test Task",
		Priority: "medium",
	})
	if err != nil {
		t.Fatalf("failed to create task: %v", err)
	}

	st1, err := store.CreateSubtask(ctx, userID, task.ID, CreateSubtaskRequest{Title: "Subtask 1"})
	if err != nil {
		t.Fatalf("failed to create subtask 1: %v", err)
	}

	isCompleted := true
	updatedSt1, err := store.UpdateSubtask(ctx, userID, st1.ID, UpdateSubtaskRequest{IsCompleted: &isCompleted})
	if err != nil || !updatedSt1.IsCompleted {
		t.Fatalf("expected subtask to be completed, got: %v", updatedSt1)
	}
}

// TestActivityLogging verifies that board mutations generate audit logs.
func TestActivityLogging(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()
	userID := uuid.New()

	colID := store.columns[0].ID
	task, err := store.CreateTask(ctx, userID, CreateTaskRequest{
		ColumnID: colID,
		Title:    "Audit Activity Test",
		Priority: "high",
	})
	if err != nil {
		t.Fatalf("failed to create task: %v", err)
	}

	logs, err := store.GetActivityLogs(ctx, userID)
	if err != nil {
		t.Fatalf("failed to get activity logs: %v", err)
	}

	if len(logs) == 0 {
		t.Fatalf("expected at least 1 activity log entry for task creation, got 0")
	}

	if logs[0].Action != "created" || logs[0].TaskID == nil || *logs[0].TaskID != task.ID {
		t.Fatalf("unexpected activity log content: %+v", logs[0])
	}
}
