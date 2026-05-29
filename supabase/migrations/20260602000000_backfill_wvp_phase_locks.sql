-- 一次性資料修復：補齊舊專案不完整的 wvp_phase_locks
-- 目的：避免前端/後端解析時回退到 legacy phase_locks，造成鎖定狀態誤判

update public.projects
set wvp_phase_locks = jsonb_build_object(
  'content',
  case
    when jsonb_typeof(wvp_phase_locks) = 'object' and (wvp_phase_locks ? 'content')
      then coalesce((wvp_phase_locks->>'content')::boolean, false)
    else false
  end,
  'checkpoint',
  case
    when jsonb_typeof(wvp_phase_locks) = 'object' and (wvp_phase_locks ? 'checkpoint')
      then coalesce((wvp_phase_locks->>'checkpoint')::boolean, false)
    else false
  end,
  'craft',
  case
    when jsonb_typeof(wvp_phase_locks) = 'object' and (wvp_phase_locks ? 'craft')
      then coalesce((wvp_phase_locks->>'craft')::boolean, false)
    else false
  end,
  'audio',
  case
    when jsonb_typeof(wvp_phase_locks) = 'object' and (wvp_phase_locks ? 'audio')
      then coalesce((wvp_phase_locks->>'audio')::boolean, false)
    else false
  end,
  'publish',
  case
    when jsonb_typeof(wvp_phase_locks) = 'object' and (wvp_phase_locks ? 'publish')
      then coalesce((wvp_phase_locks->>'publish')::boolean, false)
    else false
  end
)
where
  wvp_phase_locks is null
  or jsonb_typeof(wvp_phase_locks) <> 'object'
  or not (wvp_phase_locks ? 'content')
  or not (wvp_phase_locks ? 'checkpoint')
  or not (wvp_phase_locks ? 'craft')
  or not (wvp_phase_locks ? 'audio')
  or not (wvp_phase_locks ? 'publish');
