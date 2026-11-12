CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  type TEXT NOT NULL,
  grade TEXT NOT NULL,
  subject TEXT NOT NULL,
  bundle INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL,
  phone TEXT NOT NULL,
  student_code TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  sender_phone TEXT NOT NULL,
  receipt_key TEXT NOT NULL,
  receipt_type TEXT NOT NULL,
  receipt_size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed')),
  telegram_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (telegram_status IN ('pending', 'sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_student_code ON orders(student_code);
