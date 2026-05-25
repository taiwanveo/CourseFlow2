-- CourseFlow v2 — WVP 擴充（僅在「v2 專用」Supabase 專案執行，勿套用在 v1）

alter table public.projects
  add column if not exists edition text not null default 'v2',
  add column if not exists wvp_settings jsonb not null default '{}'::jsonb,
  add column if not exists wvp_phase_locks jsonb not null default '{"content":false,"checkpoint":false,"craft":false,"audio":false,"publish":false}'::jsonb,
  add column if not exists article_storage_path text,
  add column if not exists script_storage_path text,
  add column if not exists outline_storage_path text,
  add column if not exists presentation_revision text;

comment on column public.projects.edition is 'v2 = WVP craft; legacy v1 uses slide pipeline';
comment on column public.projects.wvp_phase_locks is 'WVP 五階段鎖：content, checkpoint, craft, audio, publish';

-- 章節 Craft 狀態（與 presentation 內 wvp chapter id 對應）
create table if not exists public.chapter_craft (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  wvp_chapter_id text not null,
  title text not null default '',
  craft_status text not null default 'pending',
  step_count int not null default 0,
  checklist_result jsonb,
  presentation_path text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, wvp_chapter_id)
);

create index if not exists chapter_craft_project_id_idx on public.chapter_craft(project_id);

drop trigger if exists chapter_craft_updated_at on public.chapter_craft;
create trigger chapter_craft_updated_at
  before update on public.chapter_craft
  for each row execute function public.set_updated_at();

alter table public.chapter_craft enable row level security;

create policy "chapter_craft_all_own" on public.chapter_craft
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = chapter_craft.project_id and p.user_id = auth.uid()
    )
  );
