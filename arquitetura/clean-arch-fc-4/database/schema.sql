-- ============================================
-- ShopHub E-Commerce Database Schema
-- PostgreSQL Version
-- ============================================
-- ⚠️ Este schema é parte de um projeto DIDÁTICO
-- com problemas arquiteturais propositais
-- ============================================

-- ============================================
-- 1. CUSTOMERS (Clientes)
-- ============================================

DROP TABLE IF EXISTS customers CASCADE;

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  document VARCHAR(20) NOT NULL, -- CPF/CNPJ
  zip_code VARCHAR(10) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  active BOOLEAN DEFAULT true,
  credit_limit DECIMAL(10, 2) DEFAULT 0.00,
  trust_score INT DEFAULT 5 CHECK (trust_score >= 1 AND trust_score <= 10), -- Score de 1-10
  sales_rep_id INT NULL,
  receive_reports BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_active ON customers(active);
CREATE INDEX idx_customers_sales_rep ON customers(sales_rep_id);

-- Dados de exemplo
INSERT INTO customers (name, email, phone, document, zip_code, address, city, state, credit_limit, trust_score, sales_rep_id) VALUES
('João Silva', 'joao.silva@example.com', '+5511999999999', '12345678901', '01310-100', 'Av Paulista, 1000', 'São Paulo', 'SP', 5000.00, 8, 1),
('Maria Santos', 'maria.santos@example.com', '+5511888888888', '98765432109', '22041-080', 'Av Atlântica, 500', 'Rio de Janeiro', 'RJ', 3000.00, 6, 1),
('Pedro Costa', 'pedro.costa@example.com', '+5511777777777', '45678912345', '30130-100', 'Av Afonso Pena, 1500', 'Belo Horizonte', 'MG', 10000.00, 9, 2);

-- ============================================
-- 2. CATEGORIES (Categorias)
-- ============================================

DROP TABLE IF EXISTS categories CASCADE;

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  parent_id INT REFERENCES categories(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);

INSERT INTO categories (name, slug, parent_id) VALUES
('Eletrônicos', 'eletronicos', NULL),
('Computadores', 'computadores', 1),
('Smartphones', 'smartphones', 1),
('Móveis', 'moveis', NULL),
('Livros', 'livros', NULL);

-- ============================================
-- 3. PRODUCTS (Produtos)
-- ============================================

DROP TABLE IF EXISTS products CASCADE;

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  sku VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  cost DECIMAL(10, 2),
  stock INT NOT NULL DEFAULT 0,
  weight DECIMAL(10, 3), -- Peso em kg
  category_id INT REFERENCES categories(id),
  supplier_id INT,
  active BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(active);

INSERT INTO products (name, sku, description, price, cost, stock, category_id, active) VALUES
('Notebook Dell Inspiron', 'NB-DELL-001', 'Notebook i5 8GB 256GB SSD', 3500.00, 2800.00, 15, 2, true),
('iPhone 13 Pro', 'IP-13-PRO', 'iPhone 13 Pro 128GB', 7000.00, 5500.00, 8, 3, true),
('Mouse Logitech MX', 'MS-LOG-MX', 'Mouse sem fio ergonômico', 350.00, 200.00, 50, 2, true),
('Cadeira Gamer', 'CD-GAME-01', 'Cadeira ergonômica para games', 1200.00, 800.00, 20, 4, true),
('Clean Code Book', 'LV-CLEAN-01', 'Livro Clean Code - Robert Martin', 85.00, 50.00, 100, 5, true);

-- ============================================
-- 4. ORDERS (Pedidos)
-- ============================================

DROP TABLE IF EXISTS orders CASCADE;

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id),
  order_number VARCHAR(50) NOT NULL UNIQUE,
  subtotal DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0.00,
  shipping_fee DECIMAL(10, 2) DEFAULT 0.00,
  total DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'PAYMENT_FAILED')),
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BOLETO', 'BANK_TRANSFER')),
  payment_status VARCHAR(20) DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  payment_transaction_id VARCHAR(100),
  shipping_zip_code VARCHAR(10),
  shipping_address TEXT,
  shipping_city VARCHAR(100),
  shipping_state VARCHAR(2),
  shipping_tracking_code VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_number ON orders(order_number);

INSERT INTO orders (customer_id, order_number, subtotal, discount, shipping_fee, total, status, payment_method, payment_status, shipping_zip_code, shipping_address, shipping_city, shipping_state, created_by) VALUES
(1, 'ORD-2024-0001', 3850.00, 100.00, 50.00, 3800.00, 'DELIVERED', 'CREDIT_CARD', 'PAID', '01310-100', 'Av Paulista, 1000', 'São Paulo', 'SP', 1),
(2, 'ORD-2024-0002', 7350.00, 0.00, 80.00, 7430.00, 'SHIPPED', 'PIX', 'PAID', '22041-080', 'Av Atlântica, 500', 'Rio de Janeiro', 'RJ', 1),
(3, 'ORD-2024-0003', 1285.00, 85.00, 30.00, 1230.00, 'PROCESSING', 'BOLETO', 'PENDING', '30130-100', 'Av Afonso Pena, 1500', 'Belo Horizonte', 'MG', 2);

-- ============================================
-- 5. ORDER_ITEMS (Itens do Pedido)
-- ============================================

DROP TABLE IF EXISTS order_items CASCADE;

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  product_name VARCHAR(200) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL,
  discount_percentage DECIMAL(5, 2) DEFAULT 0.00,
  total DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

INSERT INTO order_items (order_id, product_id, product_name, sku, quantity, unit_price, discount_percentage, total) VALUES
(1, 1, 'Notebook Dell Inspiron', 'NB-DELL-001', 1, 3500.00, 0, 3500.00),
(1, 3, 'Mouse Logitech MX', 'MS-LOG-MX', 1, 350.00, 0, 350.00),
(2, 2, 'iPhone 13 Pro', 'IP-13-PRO', 1, 7000.00, 0, 7000.00),
(2, 3, 'Mouse Logitech MX', 'MS-LOG-MX', 1, 350.00, 0, 350.00),
(3, 4, 'Cadeira Gamer', 'CD-GAME-01', 1, 1200.00, 0, 1200.00),
(3, 5, 'Clean Code Book', 'LV-CLEAN-01', 1, 85.00, 0, 85.00);

-- ============================================
-- 6. COUPONS (Cupons de Desconto)
-- ============================================

DROP TABLE IF EXISTS coupons CASCADE;

CREATE TABLE coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED')),
  discount_value DECIMAL(10, 2) NOT NULL,
  min_order_value DECIMAL(10, 2),
  max_discount_amount DECIMAL(10, 2),
  usage_limit INT,
  used_count INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  expiry_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active ON coupons(active);

INSERT INTO coupons (code, discount_type, discount_value, min_order_value, max_discount_amount, usage_limit, active, expiry_date) VALUES
('WELCOME10', 'PERCENTAGE', 10.00, 100.00, 50.00, 100, true, '2025-12-31 23:59:59'),
('SAVE50', 'FIXED', 50.00, 200.00, NULL, 50, true, '2025-12-31 23:59:59'),
('BLACKFRIDAY', 'PERCENTAGE', 20.00, 500.00, 200.00, 1000, true, '2025-11-30 23:59:59');

-- ============================================
-- 7. COUPON_USAGE (Uso de Cupons)
-- ============================================

DROP TABLE IF EXISTS coupon_usage CASCADE;

CREATE TABLE coupon_usage (
  id SERIAL PRIMARY KEY,
  coupon_code VARCHAR(50) NOT NULL,
  order_id INT NOT NULL REFERENCES orders(id),
  customer_id INT NOT NULL REFERENCES customers(id),
  discount_applied DECIMAL(10, 2) NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_coupon_usage_code ON coupon_usage(coupon_code);
CREATE INDEX idx_coupon_usage_order ON coupon_usage(order_id);

INSERT INTO coupon_usage (coupon_code, order_id, customer_id, discount_applied) VALUES
('WELCOME10', 1, 1, 100.00);

-- ============================================
-- 8. SHIPPING_ZONES (Zonas de Entrega)
-- ============================================

DROP TABLE IF EXISTS shipping_zones CASCADE;

CREATE TABLE shipping_zones (
  id SERIAL PRIMARY KEY,
  zip_code VARCHAR(10) NOT NULL,
  city VARCHAR(100),
  state VARCHAR(2),
  fee DECIMAL(10, 2) NOT NULL,
  delivery_days INT DEFAULT 5,
  active BOOLEAN DEFAULT true
);

CREATE INDEX idx_shipping_zip ON shipping_zones(zip_code);
CREATE INDEX idx_shipping_state ON shipping_zones(state);

INSERT INTO shipping_zones (zip_code, city, state, fee, delivery_days) VALUES
('01310-100', 'São Paulo', 'SP', 15.00, 2),
('22041-080', 'Rio de Janeiro', 'RJ', 20.00, 3),
('30130-100', 'Belo Horizonte', 'MG', 25.00, 4);

-- ============================================
-- 9. USERS (Usuários do Sistema)
-- ============================================

DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER', 'SALES')),
  active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

INSERT INTO users (username, email, password_hash, role) VALUES
('admin', 'admin@shophub.com', '$2b$10$hash_placeholder', 'ADMIN'),
('john.sales', 'john@shophub.com', '$2b$10$hash_placeholder', 'SALES');

-- ============================================
-- 10. ORDER_LOGS (Logs de Pedidos)
-- ============================================

DROP TABLE IF EXISTS order_logs CASCADE;

CREATE TABLE order_logs (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  user_id INT REFERENCES users(id),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_logs_order ON order_logs(order_id);
CREATE INDEX idx_order_logs_action ON order_logs(action);

INSERT INTO order_logs (order_id, action, user_id) VALUES
(1, 'CREATED', 1),
(1, 'PAYMENT_CONFIRMED', 1),
(1, 'SHIPPED', 1),
(1, 'DELIVERED', 1),
(2, 'CREATED', 1),
(2, 'PAYMENT_CONFIRMED', 1),
(2, 'SHIPPED', 1);

-- ============================================
-- 11. DAILY_METRICS (Métricas Diárias)
-- ============================================

DROP TABLE IF EXISTS daily_metrics CASCADE;

CREATE TABLE daily_metrics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  value DECIMAL(15, 2) NOT NULL,
  metadata JSONB,
  UNIQUE(date, metric_type)
);

CREATE INDEX idx_metrics_date ON daily_metrics(date);
CREATE INDEX idx_metrics_type ON daily_metrics(metric_type);

INSERT INTO daily_metrics (date, metric_type, value) VALUES
(CURRENT_DATE, 'ORDERS_CREATED', 3),
(CURRENT_DATE, 'REVENUE', 12460.00),
(CURRENT_DATE, 'NEW_CUSTOMERS', 0);

-- ============================================
-- ❌ PROBLEMA: TRIGGERS COM LÓGICA DE NEGÓCIO
-- ============================================

-- Trigger para aplicar desconto automático (ANTI-PATTERN!)
CREATE OR REPLACE FUNCTION apply_discount_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- ❌ PROBLEMA: Lógica de negócio no banco
  IF NEW.subtotal > 5000 THEN
    NEW.discount := NEW.subtotal * 0.05; -- 5% desconto
  ELSIF NEW.subtotal > 2000 THEN
    NEW.discount := NEW.subtotal * 0.03; -- 3% desconto
  END IF;
  
  NEW.total := NEW.subtotal - NEW.discount + NEW.shipping_fee;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_discount
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION apply_discount_trigger();

-- Trigger para notificar estoque baixo (ANTI-PATTERN!)
CREATE OR REPLACE FUNCTION notify_low_stock_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- ❌ PROBLEMA: Side effect no banco
  IF NEW.stock < 10 THEN
    INSERT INTO order_logs (order_id, action, user_id)
    VALUES (0, 'LOW_STOCK_ALERT: ' || NEW.name, 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_low_stock
AFTER UPDATE OF stock ON products
FOR EACH ROW
WHEN (NEW.stock < OLD.stock)
EXECUTE FUNCTION notify_low_stock_trigger();

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ❌ PROBLEMA: STORED PROCEDURES COM REGRAS DE DOMÍNIO
-- ============================================

-- Procedure para validar estoque (ANTI-PATTERN!)
CREATE OR REPLACE FUNCTION validate_order_stock(p_order_id INT)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_error BOOLEAN := false;
  item RECORD;
BEGIN
  -- ❌ PROBLEMA: Validação de domínio no banco
  FOR item IN
    SELECT oi.product_id, oi.quantity, p.stock
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = p_order_id
  LOOP
    IF item.stock < item.quantity THEN
      v_has_error := true;
    END IF;
  END LOOP;
  
  RETURN NOT v_has_error;
END;
$$ LANGUAGE plpgsql;

-- Procedure para calcular frete (ANTI-PATTERN!)
CREATE OR REPLACE FUNCTION calculate_shipping(p_zip_code VARCHAR, p_total DECIMAL)
RETURNS DECIMAL AS $$
DECLARE
  v_fee DECIMAL;
BEGIN
  -- ❌ PROBLEMA: Cálculo de negócio no banco
  SELECT fee INTO v_fee
  FROM shipping_zones
  WHERE zip_code = p_zip_code
  LIMIT 1;
  
  IF v_fee IS NULL THEN
    v_fee := 50.00; -- Valor padrão
  END IF;
  
  -- Frete grátis acima de 500
  IF p_total >= 500.00 THEN
    v_fee := 0;
  END IF;
  
  RETURN v_fee;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ❌ PROBLEMA: VIEWS COM SUBQUERIES INEFICIENTES
-- ============================================

-- View problemática com múltiplos subqueries
CREATE OR REPLACE VIEW order_summary_view AS
SELECT 
  o.id,
  o.order_number,
  o.total,
  o.status,
  -- ❌ PROBLEMA: Subquery correlacionada
  (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
  -- ❌ PROBLEMA: Mais subqueries
  (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) as total_items,
  -- ❌ PROBLEMA: JOIN dentro de subquery
  (SELECT c.name FROM customers c WHERE c.id = o.customer_id) as customer_name,
  -- ❌ PROBLEMA: Cálculo complexo no banco
  (SELECT COALESCE(SUM(discount_applied), 0) FROM coupon_usage WHERE order_id = o.id) as coupon_discount
FROM orders o;

-- View com join desnecessário
CREATE OR REPLACE VIEW product_sales_view AS
SELECT 
  p.*,
  c.name as category_name,
  -- ❌ PROBLEMA: Agregação na view
  COALESCE(SUM(oi.quantity), 0) as total_sold,
  COALESCE(SUM(oi.total), 0) as total_revenue
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN order_items oi ON p.id = oi.product_id
GROUP BY p.id, c.name;

-- ============================================
-- FIM DO SCHEMA
-- ============================================

-- Mensagem de conclusão
SELECT 'Database shophub_ecommerce criado com sucesso!' as message;
SELECT 'ATENÇÃO: Este schema contém ANTI-PATTERNS propositais para fins didáticos!' as warning;
