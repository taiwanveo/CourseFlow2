-- WVP dist 上傳需 html / js / css / json 等 MIME（建置預覽上傳至 Storage）

update storage.buckets
set allowed_mime_types = array[
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'video/mp4',
  'text/html',
  'text/css',
  'text/plain',
  'application/javascript',
  'application/json',
  'font/woff',
  'font/woff2',
  'application/octet-stream'
]
where id = 'courseflow-assets';
