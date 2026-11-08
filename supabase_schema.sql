-- Supabase Database Schema for Kanban Task Board with Row Level Security (RLS)
-- Enables Anonymous / Guest Authentication and Strict Per-User Isolation

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles table linked to Supabase Auth (both authenticated and anonymous guests)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to automatically create a profile entry when any user (anonymous or email) signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, is_anonymous)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, 'guest_' || substring(NEW.id::text, 1, 8) || '@kanban.guest'),
        COALESCE(NEW.raw_user_meta_data->>'full_name', CASE WHEN NEW.is_anonymous THEN 'Guest User' ELSE split_part(COALESCE(NEW.email, 'User'), '@', 1) END),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        COALESCE(NEW.is_anonymous, FALSE)
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        is_anonymous = EXCLUDED.is_anonymous;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Columns Table
CREATE TABLE IF NOT EXISTS public.columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    position DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),
    column_id UUID REFERENCES public.columns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    description TEXT DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date TIMESTAMPTZ,
    position DOUBLE PRECISION NOT NULL DEFAULT 0,
    labels JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Subtasks Table
CREATE TABLE IF NOT EXISTS public.subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Comments Table
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Activity Logs Table (for board history timeline)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    task_title TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast ordering and queries
CREATE INDEX IF NOT EXISTS idx_columns_user_pos ON public.columns(user_id, position);
CREATE INDEX IF NOT EXISTS idx_tasks_user_pos ON public.tasks(user_id, column_id, position);
CREATE INDEX IF NOT EXISTS idx_subtasks_user ON public.subtasks(user_id, task_id);
CREATE INDEX IF NOT EXISTS idx_comments_task_created ON public.comments(task_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs(user_id, created_at DESC);

-- ===================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Each user (including anonymous guest sessions) can ONLY access & mutate their own data
-- ===================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can see profiles and update only their own profile
CREATE POLICY "Allow users to view profiles"
    ON public.profiles FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow users to update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Columns: Strict per-user isolation
CREATE POLICY "Users can only select their own columns"
    ON public.columns FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own columns"
    ON public.columns FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own columns"
    ON public.columns FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own columns"
    ON public.columns FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Tasks: Strict per-user isolation (Each user ONLY reads and writes their own tasks)
CREATE POLICY "Users can only select their own tasks"
    ON public.tasks FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own tasks"
    ON public.tasks FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own tasks"
    ON public.tasks FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own tasks"
    ON public.tasks FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Subtasks: Strict per-user isolation
CREATE POLICY "Users can only select their own subtasks"
    ON public.subtasks FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own subtasks"
    ON public.subtasks FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own subtasks"
    ON public.subtasks FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own subtasks"
    ON public.subtasks FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Comments: Strict per-user isolation
CREATE POLICY "Users can only select comments on tasks they own"
    ON public.comments FOR SELECT
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = comments.task_id AND tasks.user_id = auth.uid()));

CREATE POLICY "Users can only insert comments on tasks they own"
    ON public.comments FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = comments.task_id AND tasks.user_id = auth.uid()));

-- Activity Logs: Strict per-user isolation
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only select their own activity logs"
    ON public.activity_logs FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own activity logs"
    ON public.activity_logs FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
