-- CourseFlow initial schema
-- Apply via Supabase CLI: supabase db push

-- Extensions
create extension if not exists "pgcrypto";

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '未命名專案',
  public_slug text unique,
  article jsonb not null default '{}'::jsonb,
  theme_id text,
  phase_locks jsonb not null default '{"content":false,"audio":false,"visual":false}'::jsonb,
  composition_snapshot jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects(user_id);

-- Chapters (tree via parent_id)
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id uuid references public.chapters(id) on delete cascade,
  title text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists chapters_project_id_idx on public.chapters(project_id);

-- Steps
create table if not exists public.steps (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  sort_order int not null default 0,
  script text not null default '',
  screen_summary text not null default '',
  info_pool jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists steps_chapter_id_idx on public.steps(chapter_id);

-- Audio assets
create table if not exists public.audio_assets (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null unique references public.steps(id) on delete cascade,
  storage_path text not null,
  duration_ms int not null default 0,
  tts_provider text,
  tts_voice_id text,
  created_at timestamptz not null default now()
);

-- Subtitle tracks
create table if not exists public.subtitle_tracks (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null unique references public.steps(id) on delete cascade,
  segments jsonb not null default '[]'::jsonb,
  style jsonb not null default '{}'::jsonb,
  position jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Step visuals
create table if not exists public.step_visuals (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null unique references public.steps(id) on delete cascade,
  background jsonb not null default '{}'::jsonb,
  elements jsonb not null default '[]'::jsonb,
  enter_animation_id text not null default 'fade-up',
  transition_id text not null default 'crossfade',
  created_at timestamptz not null default now()
);

-- Render jobs
create type public.render_job_status as enum (
  'pending', 'processing', 'completed', 'failed'
);

create type public.render_job_kind as enum ('preview', 'export');

create table if not exists public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.render_job_kind not null default 'preview',
  status public.render_job_status not null default 'pending',
  progress int not null default 0,
  output_path text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists render_jobs_project_id_idx on public.render_jobs(project_id);

-- Encrypted API keys (server-side only via service role)
create table if not exists public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  encrypted_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

-- Background jobs queue metadata
create table if not exists public.job_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_type text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists render_jobs_updated_at on public.render_jobs;
create trigger render_jobs_updated_at
  before update on public.render_jobs
  for each row execute function public.set_updated_at();

-- RLS
alter table public.projects enable row level security;
alter table public.chapters enable row level security;
alter table public.steps enable row level security;
alter table public.audio_assets enable row level security;
alter table public.subtitle_tracks enable row level security;
alter table public.step_visuals enable row level security;
alter table public.render_jobs enable row level security;
alter table public.user_api_keys enable row level security;
alter table public.job_runs enable row level security;

-- Projects policies
create policy "projects_select_own" on public.projects
  for select using (auth.uid() = user_id);
create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = user_id);
create policy "projects_update_own" on public.projects
  for update using (auth.uid() = user_id);
create policy "projects_delete_own" on public.projects
  for delete using (auth.uid() = user_id);

-- Public read by slug (for published players)
create policy "projects_select_public_slug" on public.projects
  for select using (public_slug is not null);

-- Chapters: via project ownership
create policy "chapters_all_own" on public.chapters
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = chapters.project_id and p.user_id = auth.uid()
    )
  );

-- Steps: via chapter -> project
create policy "steps_all_own" on public.steps
  for all using (
    exists (
      select 1 from public.chapters c
      join public.projects p on p.id = c.project_id
      where c.id = steps.chapter_id and p.user_id = auth.uid()
    )
  );

-- Audio assets
create policy "audio_all_own" on public.audio_assets
  for all using (
    exists (
      select 1 from public.steps s
      join public.chapters c on c.id = s.chapter_id
      join public.projects p on p.id = c.project_id
      where s.id = audio_assets.step_id and p.user_id = auth.uid()
    )
  );

-- Subtitles
create policy "subtitles_all_own" on public.subtitle_tracks
  for all using (
    exists (
      select 1 from public.steps s
      join public.chapters c on c.id = s.chapter_id
      join public.projects p on p.id = c.project_id
      where s.id = subtitle_tracks.step_id and p.user_id = auth.uid()
    )
  );

-- Visuals
create policy "visuals_all_own" on public.step_visuals
  for all using (
    exists (
      select 1 from public.steps s
      join public.chapters c on c.id = s.chapter_id
      join public.projects p on p.id = c.project_id
      where s.id = step_visuals.step_id and p.user_id = auth.uid()
    )
  );

-- Render jobs
create policy "render_jobs_all_own" on public.render_jobs
  for all using (auth.uid() = user_id);

-- API keys: owner only
create policy "api_keys_all_own" on public.user_api_keys
  for all using (auth.uid() = user_id);

-- Job runs
create policy "job_runs_all_own" on public.job_runs
  for all using (auth.uid() = user_id);

-- Storage buckets (run in Supabase dashboard or storage migration)
-- insert into storage.buckets (id, name, public) values
--   ('courseflow-assets', 'courseflow-assets', false);
