-- 瀏覽器錄音／上傳常見音訊格式（webm / ogg / m4a）

update storage.buckets
set allowed_mime_types = array[
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
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
