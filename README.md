# Kanban Task Board

A modern, high-performance Kanban board built with **React**, **TypeScript**, **Tailwind CSS**, and a **Go** backend, integrated with **Supabase** for database storage and authentication.

---

## 🛠️ Tech Stack & Features

- **Frontend**:
  - React 19 + TypeScript + Vite
  - Tailwind CSS v4 styling with Dark/Light theme switching
  - `@hello-pangea/dnd` for smooth, responsive drag-and-drop
  - Lucide icons for crisp modern UI accents
- **Backend**:
  - Go HTTP REST API using Chi router & CORS handling
  - Supabase JWT token verification middleware
  - PostgreSQL adapter with `pgx/v5`
  - In-memory mock store fallback for instantaneous local testing without external setup
- **Task & Board Capabilities**:
  - Customizable, renameable, and reorderable columns with card counters
  - Drag-and-drop tasks between columns or reorder within a column
  - Subtask checklists with automatic progress bars
  - Priority badges (`Low`, `Medium`, `High`, `Urgent`)
  - Color-coded labels and tags
  - Due dates with overdue detection
  - Activity & comment threads
  - Real-time search query and priority filtering
  - Assignee avatar badges

---

## 🚀 Getting Started

### 1. Start the Go Backend Server
From the root directory:
```bash
cd server
go run .
```
The Go server will start on `http://localhost:8080`.

> **Note on Supabase configuration**:
> By default, if `DATABASE_URL` is omitted, the server automatically starts in an **interactive In-Memory mode pre-seeded with sample columns, tasks, and users** so you can immediately explore and test all functionality without needing any cloud setup.
> To connect your live Supabase project:
> 1. Copy `server/.env.example` to `server/.env`
> 2. Run the SQL script found in `supabase_schema.sql` in your Supabase SQL Editor.
> 3. Fill in `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_JWT_SECRET`.

---

### 2. Start the React Frontend
In a new terminal window:
```bash
cd client
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🗄️ Database Setup (Supabase)
The database schema and Row Level Security policies are provided in:
- [`supabase_schema.sql`](./supabase_schema.sql)

It configures tables for:
- `profiles` (linked to `auth.users`)
- `columns`
- `tasks`
- `subtasks`
- `comments`
- Optimized index definitions and RLS policies for authenticated access.

