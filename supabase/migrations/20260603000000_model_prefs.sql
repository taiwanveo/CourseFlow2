-- 為每個 provider 的 API Key 增加模型偏好欄位
-- default_model : 預設模型（必填），text_model / image_model 為選填覆蓋
alter table public.user_api_keys
  add column if not exists default_model text,
  add column if not exists text_model     text,
  add column if not exists image_model    text;
