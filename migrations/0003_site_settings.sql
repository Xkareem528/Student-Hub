CREATE TABLE IF NOT EXISTS site_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO site_settings (setting_key, setting_value) VALUES
('prices', '{"JavaScript (QUREO)":35,"JavaScript":40,"Python":40,"ثقافة مالية":40,"Financial Literacy":40,"bundle":100,"bundleOriginal":120}'),
('offer', '{"enabled":true,"title":"باقة تانية بكالوريا","description":"المواد الثلاثة بدلًا من 120 جنيه","price":100,"originalPrice":120}'),
('maintenance', '{"enabled":false,"message":"الموقع تحت الصيانة مؤقتًا. حاول مرة أخرى لاحقًا."}'),
('announcement', '{"enabled":false,"type":"info","message":""}');
