package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store interface {
	GetBoard(ctx context.Context, userID uuid.UUID) ([]Column, error)
	CreateColumn(ctx context.Context, userID uuid.UUID, req CreateColumnRequest) (*Column, error)
	UpdateColumn(ctx context.Context, userID, columnID uuid.UUID, req UpdateColumnRequest) (*Column, error)
	DeleteColumn(ctx context.Context, userID, columnID uuid.UUID) error

	CreateTask(ctx context.Context, userID uuid.UUID, req CreateTaskRequest) (*Task, error)
	UpdateTask(ctx context.Context, userID, taskID uuid.UUID, req UpdateTaskRequest) (*Task, error)
	ReorderTask(ctx context.Context, userID uuid.UUID, req ReorderTaskRequest) error
	DeleteTask(ctx context.Context, userID, taskID uuid.UUID) error

	CreateSubtask(ctx context.Context, userID, taskID uuid.UUID, req CreateSubtaskRequest) (*Subtask, error)
	UpdateSubtask(ctx context.Context, userID, subtaskID uuid.UUID, req UpdateSubtaskRequest) (*Subtask, error)
	DeleteSubtask(ctx context.Context, userID, subtaskID uuid.UUID) error

	CreateComment(ctx context.Context, userID, taskID uuid.UUID, req CreateCommentRequest) (*Comment, error)
	GetProfiles(ctx context.Context) ([]Profile, error)
	CreateProfile(ctx context.Context, req CreateProfileRequest) (*Profile, error)
	DeleteProfile(ctx context.Context, id uuid.UUID) error
	GetActivityLogs(ctx context.Context, userID uuid.UUID) ([]ActivityLog, error)
	LogActivity(ctx context.Context, userID uuid.UUID, taskID *uuid.UUID, taskTitle, action, details string) error
}

// -------------------------------------------------------------
// Postgres / Supabase Implementation
// -------------------------------------------------------------

type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(ctx context.Context, connStr string) (*PostgresStore, error) {
	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		return nil, fmt.Errorf("unable to connect to database: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("database ping failed: %w", err)
	}
	return &PostgresStore{pool: pool}, nil
}

func (s *PostgresStore) GetProfiles(ctx context.Context) ([]Profile, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, email, full_name, avatar_url, COALESCE(color, '') FROM public.profiles ORDER BY created_at ASC`)
	if err != nil {
		return []Profile{}, nil
	}
	defer rows.Close()

	var profiles []Profile
	for rows.Next() {
		var p Profile
		if err := rows.Scan(&p.ID, &p.Email, &p.FullName, &p.AvatarURL, &p.Color); err == nil {
			profiles = append(profiles, p)
		}
	}
	return profiles, nil
}

func (s *PostgresStore) GetBoard(ctx context.Context, userID uuid.UUID) ([]Column, error) {
	// 1. Fetch columns owned by this user
	colRows, err := s.pool.Query(ctx, `
		SELECT id, user_id, title, position, created_at, updated_at 
		FROM public.columns 
		WHERE user_id = $1
		ORDER BY position ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer colRows.Close()

	var columns []Column
	colMap := make(map[uuid.UUID]int)

	for colRows.Next() {
		var c Column
		if err := colRows.Scan(&c.ID, &c.UserID, &c.Title, &c.Position, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		c.Tasks = []Task{}
		colMap[c.ID] = len(columns)
		columns = append(columns, c)
	}

	// If no columns exist yet for this board/user, seed default ones for this user
	if len(columns) == 0 {
		defaultTitles := []string{"To Do", "In Progress", "In Review", "Done"}
		for i, title := range defaultTitles {
			col, err := s.CreateColumn(ctx, userID, CreateColumnRequest{
				Title:    title,
				Position: float64((i + 1) * 1000),
			})
			if err == nil && col != nil {
				col.Tasks = []Task{}
				colMap[col.ID] = len(columns)
				columns = append(columns, *col)
			}
		}
	}

	// 2. Fetch only tasks owned by this user
	taskRows, err := s.pool.Query(ctx, `
		SELECT 
			t.id, t.column_id, COALESCE(t.status, 'todo'), t.user_id, t.assignee_id, t.title, t.description, 
			t.priority, t.due_date, t.position, t.labels, t.created_at, t.updated_at,
			p.id, p.email, p.full_name, p.avatar_url
		FROM public.tasks t
		LEFT JOIN public.profiles p ON t.assignee_id = p.id
		WHERE t.user_id = $1
		ORDER BY t.position ASC
	`, userID)
	if err != nil {
		return columns, nil
	}
	defer taskRows.Close()

	taskMap := make(map[uuid.UUID]*Task)

	for taskRows.Next() {
		var t Task
		var p Profile
		var pID *uuid.UUID
		var pEmail, pName, pAvatar *string

		if err := taskRows.Scan(
			&t.ID, &t.ColumnID, &t.Status, &t.UserID, &t.AssigneeID, &t.Title, &t.Description,
			&t.Priority, &t.DueDate, &t.Position, &t.Labels, &t.CreatedAt, &t.UpdatedAt,
			&pID, &pEmail, &pName, &pAvatar,
		); err != nil {
			continue
		}

		if pID != nil {
			p.ID = *pID
			if pEmail != nil {
				p.Email = *pEmail
			}
			if pName != nil {
				p.FullName = *pName
			}
			if pAvatar != nil {
				p.AvatarURL = *pAvatar
			}
			t.Assignee = &p
		}
		t.Subtasks = []Subtask{}
		t.Comments = []Comment{}

		if idx, exists := colMap[t.ColumnID]; exists {
			columns[idx].Tasks = append(columns[idx].Tasks, t)
			// Track pointer in slice
			taskMap[t.ID] = &columns[idx].Tasks[len(columns[idx].Tasks)-1]
		}
	}

	// 3. Fetch subtasks
	subRows, err := s.pool.Query(ctx, `
		SELECT id, task_id, title, is_completed, position, created_at 
		FROM public.subtasks 
		ORDER BY position ASC
	`)
	if err == nil {
		defer subRows.Close()
		for subRows.Next() {
			var st Subtask
			if err := subRows.Scan(&st.ID, &st.TaskID, &st.Title, &st.IsCompleted, &st.Position, &st.CreatedAt); err == nil {
				if taskPtr, exists := taskMap[st.TaskID]; exists {
					taskPtr.Subtasks = append(taskPtr.Subtasks, st)
				}
			}
		}
	}

	// 4. Fetch comments
	commentRows, err := s.pool.Query(ctx, `
		SELECT c.id, c.task_id, c.user_id, c.content, c.created_at,
		       p.id, p.email, p.full_name, p.avatar_url
		FROM public.comments c
		LEFT JOIN public.profiles p ON c.user_id = p.id
		ORDER BY c.created_at ASC
	`)
	if err == nil {
		defer commentRows.Close()
		for commentRows.Next() {
			var cm Comment
			var p Profile
			var pID *uuid.UUID
			var pEmail, pName, pAvatar *string
			if err := commentRows.Scan(
				&cm.ID, &cm.TaskID, &cm.UserID, &cm.Content, &cm.CreatedAt,
				&pID, &pEmail, &pName, &pAvatar,
			); err == nil {
				if pID != nil {
					p.ID = *pID
					if pEmail != nil {
						p.Email = *pEmail
					}
					if pName != nil {
						p.FullName = *pName
					}
					if pAvatar != nil {
						p.AvatarURL = *pAvatar
					}
					cm.User = &p
				}
				if taskPtr, exists := taskMap[cm.TaskID]; exists {
					taskPtr.Comments = append(taskPtr.Comments, cm)
				}
			}
		}
	}

	return columns, nil
}

func (s *PostgresStore) CreateColumn(ctx context.Context, userID uuid.UUID, req CreateColumnRequest) (*Column, error) {
	col := &Column{
		ID:        uuid.New(),
		UserID:    userID,
		Title:     req.Title,
		Position:  req.Position,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Tasks:     []Task{},
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO public.columns (id, user_id, title, position, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, col.ID, col.UserID, col.Title, col.Position, col.CreatedAt, col.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return col, nil
}

func (s *PostgresStore) UpdateColumn(ctx context.Context, userID, columnID uuid.UUID, req UpdateColumnRequest) (*Column, error) {
	query := `UPDATE public.columns SET updated_at = NOW()`
	args := []interface{}{}
	argIdx := 1

	if req.Title != nil {
		query += fmt.Sprintf(`, title = $%d`, argIdx)
		args = append(args, *req.Title)
		argIdx++
	}
	if req.Position != nil {
		query += fmt.Sprintf(`, position = $%d`, argIdx)
		args = append(args, *req.Position)
		argIdx++
	}

	query += fmt.Sprintf(` WHERE id = $%d RETURNING id, user_id, title, position, created_at, updated_at`, argIdx)
	args = append(args, columnID)

	var col Column
	err := s.pool.QueryRow(ctx, query, args...).Scan(&col.ID, &col.UserID, &col.Title, &col.Position, &col.CreatedAt, &col.UpdatedAt)
	if err != nil {
		return nil, err
	}
	col.Tasks = []Task{}
	return &col, nil
}

func (s *PostgresStore) DeleteColumn(ctx context.Context, userID, columnID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM public.columns WHERE id = $1`, columnID)
	return err
}

func (s *PostgresStore) CreateTask(ctx context.Context, userID uuid.UUID, req CreateTaskRequest) (*Task, error) {
	status := req.Status
	if status == "" {
		status = "todo"
	}

	task := &Task{
		ID:          uuid.New(),
		ColumnID:    req.ColumnID,
		Status:      status,
		UserID:      userID,
		AssigneeID:  req.AssigneeID,
		Title:       req.Title,
		Description: req.Description,
		Priority:    req.Priority,
		DueDate:     req.DueDate,
		Position:    float64(time.Now().UnixMilli()),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		Subtasks:    []Subtask{},
		Comments:    []Comment{},
	}
	if task.Priority == "" {
		task.Priority = "medium"
	}

	labelsJSON, _ := json.Marshal(req.Labels)
	task.Labels = labelsJSON

	_, err := s.pool.Exec(ctx, `
		INSERT INTO public.tasks (id, column_id, status, user_id, assignee_id, title, description, priority, due_date, position, labels, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`, task.ID, task.ColumnID, task.Status, task.UserID, task.AssigneeID, task.Title, task.Description, task.Priority, task.DueDate, task.Position, task.Labels, task.CreatedAt, task.UpdatedAt)
	if err != nil {
		return nil, err
	}

	if task.AssigneeID != nil {
		var p Profile
		err := s.pool.QueryRow(ctx, `SELECT id, email, full_name, avatar_url FROM public.profiles WHERE id = $1`, task.AssigneeID).
			Scan(&p.ID, &p.Email, &p.FullName, &p.AvatarURL)
		if err == nil {
			task.Assignee = &p
		}
	}

	return task, nil
}

func (s *PostgresStore) UpdateTask(ctx context.Context, userID, taskID uuid.UUID, req UpdateTaskRequest) (*Task, error) {
	query := `UPDATE public.tasks SET updated_at = NOW()`
	args := []interface{}{}
	argIdx := 1

	if req.ColumnID != nil {
		query += fmt.Sprintf(`, column_id = $%d`, argIdx)
		args = append(args, *req.ColumnID)
		argIdx++
	}
	if req.Status != nil {
		query += fmt.Sprintf(`, status = $%d`, argIdx)
		args = append(args, *req.Status)
		argIdx++
	}
	if req.Title != nil {
		query += fmt.Sprintf(`, title = $%d`, argIdx)
		args = append(args, *req.Title)
		argIdx++
	}
	if req.Description != nil {
		query += fmt.Sprintf(`, description = $%d`, argIdx)
		args = append(args, *req.Description)
		argIdx++
	}
	if req.Priority != nil {
		query += fmt.Sprintf(`, priority = $%d`, argIdx)
		args = append(args, *req.Priority)
		argIdx++
	}
	if req.DueDate != nil {
		query += fmt.Sprintf(`, due_date = $%d`, argIdx)
		args = append(args, *req.DueDate)
		argIdx++
	}
	if req.Position != nil {
		query += fmt.Sprintf(`, position = $%d`, argIdx)
		args = append(args, *req.Position)
		argIdx++
	}
	if req.AssigneeID != nil {
		query += fmt.Sprintf(`, assignee_id = $%d`, argIdx)
		args = append(args, *req.AssigneeID)
		argIdx++
	}
	if req.Labels != nil {
		labelsJSON, _ := json.Marshal(req.Labels)
		query += fmt.Sprintf(`, labels = $%d`, argIdx)
		args = append(args, labelsJSON)
		argIdx++
	}

	query += fmt.Sprintf(` WHERE id = $%d AND user_id = $%d RETURNING id, column_id, status, user_id, assignee_id, title, description, priority, due_date, position, labels, created_at, updated_at`, argIdx, argIdx+1)
	args = append(args, taskID, userID)

	var t Task
	err := s.pool.QueryRow(ctx, query, args...).Scan(
		&t.ID, &t.ColumnID, &t.Status, &t.UserID, &t.AssigneeID, &t.Title, &t.Description,
		&t.Priority, &t.DueDate, &t.Position, &t.Labels, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if t.AssigneeID != nil {
		var p Profile
		err := s.pool.QueryRow(ctx, `SELECT id, email, full_name, avatar_url FROM public.profiles WHERE id = $1`, t.AssigneeID).
			Scan(&p.ID, &p.Email, &p.FullName, &p.AvatarURL)
		if err == nil {
			t.Assignee = &p
		}
	}
	return &t, nil
}

func (s *PostgresStore) ReorderTask(ctx context.Context, userID uuid.UUID, req ReorderTaskRequest) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE public.tasks 
		SET column_id = $1, position = $2, updated_at = NOW() 
		WHERE id = $3 AND user_id = $4
	`, req.NewColumnID, req.NewPosition, req.TaskID, userID)
	return err
}

func (s *PostgresStore) DeleteTask(ctx context.Context, userID, taskID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM public.tasks WHERE id = $1 AND user_id = $2`, taskID, userID)
	return err
}

func (s *PostgresStore) CreateSubtask(ctx context.Context, userID, taskID uuid.UUID, req CreateSubtaskRequest) (*Subtask, error) {
	st := &Subtask{
		ID:          uuid.New(),
		TaskID:      taskID,
		Title:       req.Title,
		IsCompleted: false,
		Position:    int(time.Now().Unix() % 10000),
		CreatedAt:   time.Now(),
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO public.subtasks (id, task_id, title, is_completed, position, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, st.ID, st.TaskID, st.Title, st.IsCompleted, st.Position, st.CreatedAt)
	if err != nil {
		return nil, err
	}
	return st, nil
}

func (s *PostgresStore) UpdateSubtask(ctx context.Context, userID, subtaskID uuid.UUID, req UpdateSubtaskRequest) (*Subtask, error) {
	query := `UPDATE public.subtasks SET is_completed = COALESCE($1, is_completed), title = COALESCE($2, title) WHERE id = $3 RETURNING id, task_id, title, is_completed, position, created_at`
	var st Subtask
	err := s.pool.QueryRow(ctx, query, req.IsCompleted, req.Title, subtaskID).
		Scan(&st.ID, &st.TaskID, &st.Title, &st.IsCompleted, &st.Position, &st.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func (s *PostgresStore) DeleteSubtask(ctx context.Context, userID, subtaskID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM public.subtasks WHERE id = $1`, subtaskID)
	return err
}

func (s *PostgresStore) CreateComment(ctx context.Context, userID, taskID uuid.UUID, req CreateCommentRequest) (*Comment, error) {
	cm := &Comment{
		ID:        uuid.New(),
		TaskID:    taskID,
		UserID:    userID,
		Content:   req.Content,
		CreatedAt: time.Now(),
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO public.comments (id, task_id, user_id, content, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`, cm.ID, cm.TaskID, cm.UserID, cm.Content, cm.CreatedAt)
	if err != nil {
		return nil, err
	}
	var p Profile
	_ = s.pool.QueryRow(ctx, `SELECT id, email, full_name, avatar_url FROM public.profiles WHERE id = $1`, userID).
		Scan(&p.ID, &p.Email, &p.FullName, &p.AvatarURL)
	cm.User = &p
	_ = s.LogActivity(ctx, userID, &taskID, "Task", "commented", fmt.Sprintf("Added comment: %q", req.Content))
	return cm, nil
}

func (s *PostgresStore) CreateProfile(ctx context.Context, req CreateProfileRequest) (*Profile, error) {
	p := &Profile{
		ID:        uuid.New(),
		Email:     req.Email,
		FullName:  req.FullName,
		AvatarURL: req.AvatarURL,
		Color:     req.Color,
	}
	if p.Email == "" {
		p.Email = fmt.Sprintf("%s@kanban.team", uuid.New().String()[:8])
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO public.profiles (id, email, full_name, avatar_url, color)
		VALUES ($1, $2, $3, $4, $5)
	`, p.ID, p.Email, p.FullName, p.AvatarURL, p.Color)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (s *PostgresStore) DeleteProfile(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM public.profiles WHERE id = $1`, id)
	return err
}

func (s *PostgresStore) GetActivityLogs(ctx context.Context, userID uuid.UUID) ([]ActivityLog, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, user_id, task_id, task_title, action, details, created_at
		FROM public.activity_logs
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 50
	`, userID)
	if err != nil {
		return []ActivityLog{}, nil
	}
	defer rows.Close()

	var logs []ActivityLog
	for rows.Next() {
		var log ActivityLog
		if err := rows.Scan(&log.ID, &log.UserID, &log.TaskID, &log.TaskTitle, &log.Action, &log.Details, &log.CreatedAt); err == nil {
			logs = append(logs, log)
		}
	}
	return logs, nil
}

func (s *PostgresStore) LogActivity(ctx context.Context, userID uuid.UUID, taskID *uuid.UUID, taskTitle, action, details string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO public.activity_logs (id, user_id, task_id, task_title, action, details, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
	`, uuid.New(), userID, taskID, taskTitle, action, details)
	return err
}

// -------------------------------------------------------------
// In-Memory Fallback Store (for immediate out-of-the-box local testing
// without needing live Supabase credentials configured immediately)
// -------------------------------------------------------------

type MemoryStore struct {
	mu           sync.RWMutex
	columns      []Column
	tasks        []Task
	subtasks     []Subtask
	comments     []Comment
	profiles     []Profile
	activityLogs []ActivityLog
}

func NewMemoryStore() *MemoryStore {
	aliceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	bobID := uuid.MustParse("00000000-0000-0000-0000-000000000002")
	charlieID := uuid.MustParse("00000000-0000-0000-0000-000000000003")

	col1ID := uuid.MustParse("10000000-0000-0000-0000-000000000001")
	col2ID := uuid.MustParse("10000000-0000-0000-0000-000000000002")
	col3ID := uuid.MustParse("10000000-0000-0000-0000-000000000003")
	col4ID := uuid.MustParse("10000000-0000-0000-0000-000000000004")

	t1ID := uuid.MustParse("20000000-0000-0000-0000-000000000001")
	t2ID := uuid.MustParse("20000000-0000-0000-0000-000000000002")
	t3ID := uuid.MustParse("20000000-0000-0000-0000-000000000003")

	now := time.Now()
	nextWeek := now.Add(7 * 24 * time.Hour)
	tomorrow := now.Add(24 * time.Hour)

	labels1, _ := json.Marshal([]string{"Frontend", "UI/UX"})
	labels2, _ := json.Marshal([]string{"Backend", "Security"})
	labels3, _ := json.Marshal([]string{"Database", "DevOps"})

	ms := &MemoryStore{
		profiles: []Profile{
			{ID: aliceID, Email: "alice@company.com", FullName: "Alice Chen", AvatarURL: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120"},
			{ID: bobID, Email: "bob@company.com", FullName: "Bob Smith", AvatarURL: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120"},
			{ID: charlieID, Email: "charlie@company.com", FullName: "Charlie Davis", AvatarURL: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120"},
		},
		columns: []Column{
			{ID: col1ID, Title: "To Do", Position: 1000, CreatedAt: now, UpdatedAt: now},
			{ID: col2ID, Title: "In Progress", Position: 2000, CreatedAt: now, UpdatedAt: now},
			{ID: col3ID, Title: "In Review", Position: 3000, CreatedAt: now, UpdatedAt: now},
			{ID: col4ID, Title: "Done", Position: 4000, CreatedAt: now, UpdatedAt: now},
		},
		tasks: []Task{
			{
				ID:          t1ID,
				ColumnID:    col1ID,
				Status:      "todo",
				UserID:      aliceID,
				AssigneeID:  &aliceID,
				Title:       "Design responsive Kanban card components",
				Description: "Build modern, accessible card UI with tag badges, priority indicators, and checklist progress bars.",
				Priority:    "high",
				DueDate:     &nextWeek,
				Position:    1000,
				Labels:      labels1,
				CreatedAt:   now,
				UpdatedAt:   now,
			},
			{
				ID:          t2ID,
				ColumnID:    col2ID,
				Status:      "in_progress",
				UserID:      bobID,
				AssigneeID:  &bobID,
				Title:       "Implement JWT auth verification in Go backend",
				Description: "Secure all REST routes with Supabase auth token parsing and context injection.",
				Priority:    "urgent",
				DueDate:     &tomorrow,
				Position:    1000,
				Labels:      labels2,
				CreatedAt:   now,
				UpdatedAt:   now,
			},
			{
				ID:          t3ID,
				ColumnID:    col4ID,
				Status:      "done",
				UserID:      charlieID,
				AssigneeID:  &charlieID,
				Title:       "Set up Supabase tables & RLS policies",
				Description: "Run initial migrations for columns, tasks, subtasks, and comments.",
				Priority:    "medium",
				Position:    1000,
				Labels:      labels3,
				CreatedAt:   now,
				UpdatedAt:   now,
			},
		},
		subtasks: []Subtask{
			{ID: uuid.New(), TaskID: t1ID, Title: "Draft Figma mockups", IsCompleted: true, Position: 1},
			{ID: uuid.New(), TaskID: t1ID, Title: "Add smooth drag drop animations", IsCompleted: false, Position: 2},
			{ID: uuid.New(), TaskID: t2ID, Title: "JWKS caching", IsCompleted: true, Position: 1},
			{ID: uuid.New(), TaskID: t2ID, Title: "Role verification tests", IsCompleted: false, Position: 2},
		},
		comments: []Comment{
			{ID: uuid.New(), TaskID: t1ID, UserID: aliceID, Content: "Tailwind colors and Lucide icons look great!", CreatedAt: now.Add(-2 * time.Hour)},
		},
		activityLogs: []ActivityLog{
			{ID: uuid.New(), UserID: aliceID, TaskID: &t1ID, TaskTitle: "Design responsive Kanban card components", Action: "created", Details: "Task created in 'To Do'", CreatedAt: now.Add(-3 * time.Hour)},
			{ID: uuid.New(), UserID: bobID, TaskID: &t2ID, TaskTitle: "Implement JWT auth verification in Go backend", Action: "moved", Details: "Moved task to 'In Progress'", CreatedAt: now.Add(-1 * time.Hour)},
			{ID: uuid.New(), UserID: charlieID, TaskID: &t3ID, TaskTitle: "Set up Supabase tables & RLS policies", Action: "completed", Details: "Marked task as Done", CreatedAt: now.Add(-30 * time.Minute)},
		},
	}
	return ms
}

func (m *MemoryStore) GetActivityLogs(ctx context.Context, userID uuid.UUID) ([]ActivityLog, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var logs []ActivityLog
	for _, l := range m.activityLogs {
		if l.UserID == userID || l.UserID == uuid.Nil || userID == uuid.Nil {
			logs = append(logs, l)
		}
	}
	// Return newest first
	sort.Slice(logs, func(i, j int) bool {
		return logs[i].CreatedAt.After(logs[j].CreatedAt)
	})
	return logs, nil
}

func (m *MemoryStore) logActivityInternal(userID uuid.UUID, taskID *uuid.UUID, taskTitle, action, details string) {
	entry := ActivityLog{
		ID:        uuid.New(),
		UserID:    userID,
		TaskID:    taskID,
		TaskTitle: taskTitle,
		Action:    action,
		Details:   details,
		CreatedAt: time.Now(),
	}
	m.activityLogs = append([]ActivityLog{entry}, m.activityLogs...)
	if len(m.activityLogs) > 100 {
		m.activityLogs = m.activityLogs[:100]
	}
}

func (m *MemoryStore) LogActivity(ctx context.Context, userID uuid.UUID, taskID *uuid.UUID, taskTitle, action, details string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.logActivityInternal(userID, taskID, taskTitle, action, details)
	return nil
}

func (m *MemoryStore) GetProfiles(ctx context.Context) ([]Profile, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.profiles, nil
}

func (m *MemoryStore) CreateProfile(ctx context.Context, req CreateProfileRequest) (*Profile, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	p := Profile{
		ID:        uuid.New(),
		Email:     req.Email,
		FullName:  req.FullName,
		AvatarURL: req.AvatarURL,
		Color:     req.Color,
	}
	if p.Email == "" {
		p.Email = fmt.Sprintf("%s@kanban.team", uuid.New().String()[:8])
	}
	m.profiles = append(m.profiles, p)
	return &p, nil
}

func (m *MemoryStore) DeleteProfile(ctx context.Context, id uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var newProfiles []Profile
	for _, p := range m.profiles {
		if p.ID != id {
			newProfiles = append(newProfiles, p)
		}
	}
	m.profiles = newProfiles
	return nil
}

func (m *MemoryStore) GetBoard(ctx context.Context, userID uuid.UUID) ([]Column, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	profileMap := make(map[uuid.UUID]Profile)
	for _, p := range m.profiles {
		profileMap[p.ID] = p
	}

	cols := make([]Column, len(m.columns))
	copy(cols, m.columns)

	sort.Slice(cols, func(i, j int) bool {
		return cols[i].Position < cols[j].Position
	})

	for i := range cols {
		cols[i].Tasks = []Task{}
		for _, t := range m.tasks {
			// Per-user isolation in memory
			if t.ColumnID == cols[i].ID && (t.UserID == userID || cols[i].UserID == userID) {
				taskCopy := t
				if taskCopy.AssigneeID != nil {
					if p, exists := profileMap[*taskCopy.AssigneeID]; exists {
						taskCopy.Assignee = &p
					}
				}
				taskCopy.Assignees = []Profile{}
				for _, aID := range taskCopy.AssigneeIDs {
					if p, exists := profileMap[aID]; exists {
						taskCopy.Assignees = append(taskCopy.Assignees, p)
					}
				}
				if len(taskCopy.Assignees) == 0 && taskCopy.Assignee != nil {
					taskCopy.Assignees = append(taskCopy.Assignees, *taskCopy.Assignee)
				}
				taskCopy.Subtasks = []Subtask{}
				for _, st := range m.subtasks {
					if st.TaskID == taskCopy.ID {
						taskCopy.Subtasks = append(taskCopy.Subtasks, st)
					}
				}
				taskCopy.Comments = []Comment{}
				for _, cm := range m.comments {
					if cm.TaskID == taskCopy.ID {
						commentCopy := cm
						if p, exists := profileMap[cm.UserID]; exists {
							commentCopy.User = &p
						}
						taskCopy.Comments = append(taskCopy.Comments, commentCopy)
					}
				}
				cols[i].Tasks = append(cols[i].Tasks, taskCopy)
			}
		}
		sort.Slice(cols[i].Tasks, func(a, b int) bool {
			return cols[i].Tasks[a].Position < cols[i].Tasks[b].Position
		})
	}

	return cols, nil
}

func (m *MemoryStore) CreateColumn(ctx context.Context, userID uuid.UUID, req CreateColumnRequest) (*Column, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	c := Column{
		ID:        uuid.New(),
		UserID:    userID,
		Title:     req.Title,
		Position:  req.Position,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Tasks:     []Task{},
	}
	m.columns = append(m.columns, c)
	return &c, nil
}

func (m *MemoryStore) UpdateColumn(ctx context.Context, userID, columnID uuid.UUID, req UpdateColumnRequest) (*Column, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for i := range m.columns {
		if m.columns[i].ID == columnID {
			if req.Title != nil {
				m.columns[i].Title = *req.Title
			}
			if req.Position != nil {
				m.columns[i].Position = *req.Position
			}
			m.columns[i].UpdatedAt = time.Now()
			res := m.columns[i]
			return &res, nil
		}
	}
	return nil, fmt.Errorf("column not found")
}

func (m *MemoryStore) DeleteColumn(ctx context.Context, userID, columnID uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var newCols []Column
	for _, c := range m.columns {
		if c.ID != columnID {
			newCols = append(newCols, c)
		}
	}
	m.columns = newCols

	// Delete associated tasks
	var newTasks []Task
	for _, t := range m.tasks {
		if t.ColumnID != columnID {
			newTasks = append(newTasks, t)
		}
	}
	m.tasks = newTasks
	return nil
}

func (m *MemoryStore) CreateTask(ctx context.Context, userID uuid.UUID, req CreateTaskRequest) (*Task, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	status := req.Status
	if status == "" {
		status = "todo"
	}

	labelsJSON, _ := json.Marshal(req.Labels)
	if req.AssigneeID == nil && len(req.AssigneeIDs) > 0 {
		req.AssigneeID = &req.AssigneeIDs[0]
	}
	t := Task{
		ID:          uuid.New(),
		ColumnID:    req.ColumnID,
		Status:      status,
		UserID:      userID,
		AssigneeID:  req.AssigneeID,
		AssigneeIDs: req.AssigneeIDs,
		Title:       req.Title,
		Description: req.Description,
		Priority:    req.Priority,
		DueDate:     req.DueDate,
		Position:    float64(time.Now().UnixMilli()),
		Labels:      labelsJSON,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		Subtasks:    []Subtask{},
		Comments:    []Comment{},
	}
	if t.Priority == "" {
		t.Priority = "medium"
	}
	for _, p := range m.profiles {
		if t.AssigneeID != nil && p.ID == *t.AssigneeID {
			t.Assignee = &p
		}
		for _, aID := range t.AssigneeIDs {
			if p.ID == aID {
				t.Assignees = append(t.Assignees, p)
			}
		}
	}
	if len(t.Assignees) == 0 && t.Assignee != nil {
		t.Assignees = append(t.Assignees, *t.Assignee)
	}
	m.tasks = append(m.tasks, t)
	m.logActivityInternal(userID, &t.ID, t.Title, "created", fmt.Sprintf("Task %q created", t.Title))
	return &t, nil
}

func (m *MemoryStore) UpdateTask(ctx context.Context, userID, taskID uuid.UUID, req UpdateTaskRequest) (*Task, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for i := range m.tasks {
		if m.tasks[i].ID == taskID && (m.tasks[i].UserID == userID || m.tasks[i].UserID == uuid.Nil) {
			if req.ColumnID != nil {
				m.tasks[i].ColumnID = *req.ColumnID
			}
			if req.Status != nil {
				m.tasks[i].Status = *req.Status
			}
			if req.Title != nil {
				m.tasks[i].Title = *req.Title
			}
			if req.Description != nil {
				m.tasks[i].Description = *req.Description
			}
			if req.Priority != nil {
				m.tasks[i].Priority = *req.Priority
			}
			if req.DueDate != nil {
				m.tasks[i].DueDate = req.DueDate
			}
			if req.Position != nil {
				m.tasks[i].Position = *req.Position
			}
			if req.AssigneeID != nil {
				m.tasks[i].AssigneeID = req.AssigneeID
			}
			if req.AssigneeIDs != nil {
				m.tasks[i].AssigneeIDs = req.AssigneeIDs
				if len(req.AssigneeIDs) > 0 && req.AssigneeID == nil {
					m.tasks[i].AssigneeID = &req.AssigneeIDs[0]
				}
			}
			if req.Labels != nil {
				labelsJSON, _ := json.Marshal(req.Labels)
				m.tasks[i].Labels = labelsJSON
			}
			m.tasks[i].UpdatedAt = time.Now()

			res := m.tasks[i]
			res.Assignees = []Profile{}
			for _, p := range m.profiles {
				if res.AssigneeID != nil && p.ID == *res.AssigneeID {
					res.Assignee = &p
				}
				for _, aID := range res.AssigneeIDs {
					if p.ID == aID {
						res.Assignees = append(res.Assignees, p)
					}
				}
			}
			if len(res.Assignees) == 0 && res.Assignee != nil {
				res.Assignees = append(res.Assignees, *res.Assignee)
			}
			return &res, nil
		}
	}
	return nil, fmt.Errorf("task not found")
}

func (m *MemoryStore) ReorderTask(ctx context.Context, userID uuid.UUID, req ReorderTaskRequest) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for i := range m.tasks {
		if m.tasks[i].ID == req.TaskID && (m.tasks[i].UserID == userID || m.tasks[i].UserID == uuid.Nil) {
			m.tasks[i].ColumnID = req.NewColumnID
			m.tasks[i].Position = req.NewPosition
			m.tasks[i].UpdatedAt = time.Now()
			m.logActivityInternal(userID, &req.TaskID, m.tasks[i].Title, "moved", fmt.Sprintf("Moved task %q", m.tasks[i].Title))
			return nil
		}
	}
	return fmt.Errorf("task not found")
}

func (m *MemoryStore) DeleteTask(ctx context.Context, userID, taskID uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var newTasks []Task
	for _, t := range m.tasks {
		if !(t.ID == taskID && (t.UserID == userID || t.UserID == uuid.Nil)) {
			newTasks = append(newTasks, t)
		}
	}
	m.tasks = newTasks
	return nil
}

func (m *MemoryStore) CreateSubtask(ctx context.Context, userID, taskID uuid.UUID, req CreateSubtaskRequest) (*Subtask, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	st := Subtask{
		ID:          uuid.New(),
		TaskID:      taskID,
		Title:       req.Title,
		IsCompleted: false,
		Position:    len(m.subtasks) + 1,
		CreatedAt:   time.Now(),
	}
	m.subtasks = append(m.subtasks, st)
	return &st, nil
}

func (m *MemoryStore) UpdateSubtask(ctx context.Context, userID, subtaskID uuid.UUID, req UpdateSubtaskRequest) (*Subtask, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for i := range m.subtasks {
		if m.subtasks[i].ID == subtaskID {
			if req.Title != nil {
				m.subtasks[i].Title = *req.Title
			}
			if req.IsCompleted != nil {
				m.subtasks[i].IsCompleted = *req.IsCompleted
			}
			res := m.subtasks[i]
			return &res, nil
		}
	}
	return nil, fmt.Errorf("subtask not found")
}

func (m *MemoryStore) DeleteSubtask(ctx context.Context, userID, subtaskID uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var newSubtasks []Subtask
	for _, st := range m.subtasks {
		if st.ID != subtaskID {
			newSubtasks = append(newSubtasks, st)
		}
	}
	m.subtasks = newSubtasks
	return nil
}

func (m *MemoryStore) CreateComment(ctx context.Context, userID, taskID uuid.UUID, req CreateCommentRequest) (*Comment, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	cm := Comment{
		ID:        uuid.New(),
		TaskID:    taskID,
		UserID:    userID,
		Content:   req.Content,
		CreatedAt: time.Now(),
	}
	for _, p := range m.profiles {
		if p.ID == userID {
			cm.User = &p
			break
		}
	}
	m.comments = append(m.comments, cm)
	m.logActivityInternal(userID, &taskID, "Task", "commented", fmt.Sprintf("Added comment: %q", req.Content))
	return &cm, nil
}

func InitStore(ctx context.Context) Store {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL != "" {
		fmt.Println("Connecting to Supabase PostgreSQL...")
		pgStore, err := NewPostgresStore(ctx, dbURL)
		if err == nil {
			fmt.Println("Connected to Supabase PostgreSQL successfully.")
			return pgStore
		}
		fmt.Printf("Warning: Failed to connect to DATABASE_URL: %v. Using in-memory fallback.\n", err)
	} else {
		fmt.Println("DATABASE_URL not set. Running with interactive In-Memory store (seeded with demo data).")
	}
	return NewMemoryStore()
}
