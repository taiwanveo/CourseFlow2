-- CourseFlow asset storage (audio, images, exports)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'courseflow-assets',
  'courseflow-assets',
  true,
  52428800,
  array['audio/mpeg', 'audio/mp3', 'audio/wav', 'image/png', 'image/jpeg', 'image/webp', 'video/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read for playback / export download links
create policy "courseflow_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'courseflow-assets');

-- Authenticated users upload into their own folder: {user_id}/...
create policy "courseflow_assets_user_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'courseflow-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "courseflow_assets_user_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'courseflow-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "courseflow_assets_user_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'courseflow-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
