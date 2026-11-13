ALTER TABLE orders ADD COLUMN tracking_token_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tracking_token_hash
ON orders(tracking_token_hash);
