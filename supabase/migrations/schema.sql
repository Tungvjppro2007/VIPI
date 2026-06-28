-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLE: products
CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    price numeric NOT NULL,
    description text,
    image_url text, -- Public URL from Supabase Storage
    stock integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- Index for faster queries on products
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- 2. TABLE: orders
CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name text NOT NULL,
    phone text NOT NULL,
    facebook_url text, -- Facebook link or username
    address text NOT NULL,
    total_price numeric NOT NULL,
    status text NOT NULL DEFAULT 'pending', -- pending, processing, shipped, completed, cancelled
    created_at timestamp with time zone DEFAULT now()
);

-- Index for order lookup
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 3. TABLE: order_items
CREATE TABLE IF NOT EXISTS order_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id) ON DELETE SET NULL,
    quantity integer NOT NULL,
    price numeric NOT NULL -- Price of the product at the purchase time
);

-- Index on order_items to query items of a specific order
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Products Policies:
-- Anyone (public) can read products
CREATE POLICY "Allow public read products" ON products
    FOR SELECT USING (true);

-- Only authenticated users (admins) can modify products
CREATE POLICY "Allow admin CRUD products" ON products
    FOR ALL TO authenticated USING (true);

-- Orders Policies:
-- Anyone (public) can insert an order (checkout)
CREATE POLICY "Allow public insert orders" ON orders
    FOR INSERT WITH CHECK (true);

-- Only authenticated users (admins) can read or edit orders
CREATE POLICY "Allow admin manage orders" ON orders
    FOR ALL TO authenticated USING (true);

-- Order Items Policies:
-- Anyone (public) can insert order items
CREATE POLICY "Allow public insert order_items" ON order_items
    FOR INSERT WITH CHECK (true);

-- Only authenticated users (admins) can read or edit order items
CREATE POLICY "Allow admin manage order_items" ON order_items
    FOR ALL TO authenticated USING (true);

-- 5. STORAGE BUCKET CONFIGURATION (for product images)
-- Insert products bucket if it doesn't exist (handled by Supabase DB schema trigger or manual SQL)
-- Note: In Supabase, bucket creation can be done via API or direct insert if we have permission.
-- We declare policies for the 'products' bucket.
CREATE POLICY "Allow public read from products bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'products');

CREATE POLICY "Allow admin write to products bucket"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'products')
WITH CHECK (bucket_id = 'products');

-- 6. STORED PROCEDURE (RPC): create_order_transaction
-- Handles checking stock, deducting stock, inserting order, and inserting order_items in a single database transaction.
CREATE OR REPLACE FUNCTION create_order_transaction(
    p_customer_name text,
    p_phone text,
    p_facebook_url text,
    p_address text,
    p_total_price numeric,
    p_items jsonb -- Array of {"product_id": "...", "quantity": ...}
) RETURNS uuid AS $$
DECLARE
    v_order_id uuid;
    item jsonb;
    v_product_id uuid;
    v_quantity integer;
    v_stock integer;
    v_price numeric;
BEGIN
    -- 1. Insert order and get generated order ID
    INSERT INTO orders (customer_name, phone, facebook_url, address, total_price, status)
    VALUES (p_customer_name, p_phone, p_facebook_url, p_address, p_total_price, 'pending')
    RETURNING id INTO v_order_id;

    -- 2. Loop through each item in the order
    FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (item->>'product_id')::uuid;
        v_quantity := (item->>'quantity')::integer;

        -- Check inputs
        IF v_quantity <= 0 THEN
            RAISE EXCEPTION 'Quantity for product % must be greater than 0', v_product_id;
        END IF;

        -- Lock product row for update to prevent race conditions
        SELECT stock, price INTO v_stock, v_price FROM products WHERE id = v_product_id FOR UPDATE;

        IF v_stock IS NULL THEN
            RAISE EXCEPTION 'Product % does not exist', v_product_id;
        END IF;

        IF v_stock < v_quantity THEN
            RAISE EXCEPTION 'Out of stock for product % (Requested: %, Available: %)', v_product_id, v_quantity, v_stock;
        END IF;

        -- Deduct stock
        UPDATE products SET stock = stock - v_quantity WHERE id = v_product_id;

        -- Insert order item with the current product price
        INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES (v_order_id, v_product_id, v_quantity, v_price);
    END LOOP;

    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;
