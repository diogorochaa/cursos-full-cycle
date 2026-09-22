// ============================================
// ❌ ANTIPATTERN: Monolito disfarçado de microserviços
// Problema: Todos os serviços no mesmo processo
// ============================================

import 'dotenv/config';
import express from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';

import * as orderController from './services/order-service/controllers/orderController';
import { CustomerService, CustomerEventEmitter } from './services/customer-service/business/CustomerService';
import { emailService } from './services/order-service/services/emailService';
import { sqldb } from './common/db/connection';
import { customersTable } from './common/db/tables/customers';
import { productsTable } from './common/db/tables/products';
import { ordersTable } from './common/db/tables/orders';
import { authenticate, requireRole, requirePermission, requireAnyRole, requireOwnershipOrAdmin } from './common/middleware/authentication';
import { validateCreateOrder, validateCoupon } from './common/middleware/orderValidation';
import { validateCustomerRegistration, validateCustomerUpdate } from './common/middleware/customerValidation';
import { startDailyReportJob } from './services/notification-service/jobs/sendDailyReportJob';
import { startExpiredOrdersJob } from './services/notification-service/jobs/processExpiredOrdersJob';

const app = express();

// ❌ PROBLEMA: Services instanciados globalmente
const customerService = new CustomerService();
const eventEmitter = new CustomerEventEmitter();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ❌ PROBLEMA: Logging com console.log
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ============================================
// AUTH / LOGIN
// ============================================

// ❌ PROBLEMA: Login com lógica inline, JWT hardcoded
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // ❌ PROBLEMA: Validação inline
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // ❌ PROBLEMA: Query direta no login
    const user = await sqldb.queryOne(
      'SELECT id, username, email, password_hash, role, active FROM users WHERE username = $1',
      [username]
    );
    
    if (!user) {
      console.log('Login failed: user not found', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (!user.active) {
      console.log('Login failed: user inactive', username);
      return res.status(401).json({ error: 'User account is inactive' });
    }
    
    // ❌ PROBLEMA: Comparação de senha inline (deveria usar bcrypt)
    // Simulando verificação - em produção seria bcrypt.compare()
    const passwordMatch = password === 'admin123'; // ❌ SUPER INSEGURO!
    
    if (!passwordMatch) {
      console.log('Login failed: invalid password', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // ❌ PROBLEMA: JWT secret hardcoded, sem expiração adequada
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'super-secret-key-123', // ❌ Secret fraco!
      { expiresIn: '24h' } // ❌ Expira em 24h (muito tempo)
    );
    
    // ❌ PROBLEMA: Atualizar last_login diretamente
    await sqldb.execute(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );
    
    console.log('Login successful:', username, user.role);
    
    // ❌ PROBLEMA: Retorna informações sensíveis
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error: any) {
    // ❌ PROBLEMA: Formato de erro 9 - expõe detalhes de infraestrutura
    console.error(error);
    res.status(500).json({ 
      message: 'Database error',
      error: error.message,
      sqlQuery: error.query, // ❌ EXPÕE QUERY SQL!
      sqlParams: error.parameters // ❌ EXPÕE PARÂMETROS!
    });
  }
});

// ❌ PROBLEMA: Middleware de autenticação inline
const authenticateToken = (req: any, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    // ❌ PROBLEMA: JWT secret hardcoded aqui também
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-key-123');
    req.user = decoded; // ❌ PROBLEMA: Extende Request sem type safety
    next();
  } catch (error: any) {
    console.error('Token verification failed:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// ❌ PROBLEMA: Rota para verificar token (desnecessária)
app.get('/api/auth/me', authenticateToken, (req: any, res) => {
  res.json({ user: req.user });
});

// ============================================
// USER REGISTRATION (Auto-registro público)
// ============================================

// ❌ PROBLEMA: Endpoint público para usuários comuns se registrarem
// ❌ PROBLEMA CRÍTICO: DUPLICAÇÃO DE CÓDIGO COM POST /api/users!
// Mesma lógica de validação, hash, INSERT - implementada duas vezes!
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    console.log(`User registration attempt: ${username} / ${email}`);
    
    // ❌ PROBLEMA: Validação DUPLICADA (também existe em POST /api/users)
    // Mas com mensagens DIFERENTES!
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password required' }); // ❌ Diferente!
    }
    
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must have at least 3 characters' });
    }
    
    // ❌ PROBLEMA: Validação de email DIFERENTE do admin endpoint
    // Admin usa: /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/
    // Aqui usa: includes('@')
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' }); // ❌ Mais simples, menos rigoroso
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must have at least 6 characters' });
    }
    
    // ❌ PROBLEMA: Buscar username/email duplicado - DOIS endpoints fazem isso de forma diferente
    const existingByUsername = await sqldb.queryOne(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    
    if (existingByUsername) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    const existingByEmail = await sqldb.queryOne(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingByEmail) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    
    // ❌ PROBLEMA: Hash fraco - MESMA implementação do admin endpoint
    const passwordHash = `$2b$10$fake_hash_${password}`; // ❌ SUPER INSEGURO! (duplicado)
    
    // ❌ PROBLEMA: INSERT direto - DUPLICADO do admin endpoint
    const result = await sqldb.query(
      `INSERT INTO users (username, email, password_hash, role, active) 
       VALUES ($1, $2, $3, $4, true) RETURNING id`,
      [username, email, passwordHash, 'USER'] // ❌ Auto-atribui role USER (admin pode criar qualquer role)
    );
    
    console.log(`User registered successfully: ${username} (USER role)`);
    
    // ❌ PROBLEMA: Resposta DIFERENTE do endpoint de admin
    res.status(201).json({ 
      success: true,
      userId: result[0]?.id,
      username: username,
      email: email,
      role: 'USER',
      message: 'User registered successfully. Please login.'
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ❌ PROBLEMA CRÍTICO: Comparar com POST /api/users
// LINHA 1104: POST /api/users (ADMIN) - implementação QUASE IDÊNTICA acima
// Veja as duplicações:
// 1. Validação de username/email
// 2. Hash de senha
// 3. INSERT com mesmo schema
// 4. Mensagens de erro LIGEIRAMENTE DIFERENTES
// 5. Lógica de negócio DUPLICADA

// ============================================
// ORDER SERVICE ROUTES
// ============================================

// ❌ PROBLEMA: Autorização inline misturada com validação
// ❌ PROBLEMA: Múltiplos middlewares de autorização em cadeia
// USER pode criar pedidos, ADMIN/SALES podem gerenciar todos
app.post('/api/orders', authenticate, requirePermission('create_order'), validateCreateOrder, validateCoupon, orderController.createOrder);
app.get('/api/orders/:id', authenticate, requireOwnershipOrAdmin('order'), orderController.getOrder);
app.post('/api/orders/:id/cancel', authenticate, requireOwnershipOrAdmin('order'), orderController.cancelOrder);

// ❌ PROBLEMA: Rota para listar pedidos com lógica de autorização inline
// ADMIN vê todos, SALES vê dos seus clientes, USER vê só os seus
app.get('/api/orders', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    
    let query = 'SELECT o.*, c.name as customer_name FROM orders o JOIN customers c ON o.customer_id = c.id';
    let params: any[] = [];
    let whereClause = '';
    
    // ❌ PROBLEMA: Lógica de autorização inline no controller
    // Cada role vê dados diferentes
    if (user.role === 'USER') {
      // ❌ USER só vê seus próprios pedidos
      // Busca o customer_id do usuário
      const userCustomer: any = await sqldb.queryOne(
        'SELECT id FROM customers WHERE email = $1 OR id = $2',
        [user.email, user.userId]
      );
      
      if (!userCustomer) {
        return res.json({ orders: [], total: 0, message: 'No customer profile found' });
      }
      
      whereClause = ' WHERE o.customer_id = $1';
      params.push(userCustomer.id);
      console.log(`USER ${user.email} listing their own orders`);
      
    } else if (user.role === 'SALES') {
      // ❌ SALES só vê pedidos dos seus clientes atribuídos
      whereClause = ' WHERE c.sales_rep_id = $1';
      params.push(user.userId);
      console.log(`SALES user ${user.email} filtering orders by their customers`);
      
    } else if (user.role === 'ADMIN') {
      // ❌ ADMIN vê todos os pedidos (sem filtro)
      console.log(`ADMIN ${user.email} listing all orders`);
    }
    
    query += whereClause + ' ORDER BY o.created_at DESC LIMIT 100';
    
    const orders = await sqldb.query(query, params);
    
    // ❌ PROBLEMA: Mascaramento de dados baseado em role inline
    let formattedOrders = orders;
    if (user.role === 'USER') {
      // USER não vê dados internos como created_by
      formattedOrders = orders.map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        total: o.total,
        status: o.status,
        payment_status: o.payment_status,
        created_at: o.created_at
      }));
    }
    
    res.json({ orders: formattedOrders, total: orders.length, viewedAs: user.role });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ❌ PROBLEMA CRÍTICO: Endpoint que chama outro endpoint/controller diretamente (acoplamento)
// Este endpoint orquestra múltiplas operações SEM TRANSAÇÃO, chamando outros módulos via import
// ❌ PROBLEMA: Só ADMIN pode usar o complete-flow (autorização inline)
app.post('/api/orders/complete-flow', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const user = (req as any).user;
    
    // ❌ PROBLEMA: Verificação de role DUPLICADA (já verificada no middleware)
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can use complete flow' });
    }
    
    console.log('Starting complete order flow by ADMIN:', user.email, 'for customer:', req.body.customerId);
    
    // ❌ PROBLEMA: Validação duplicada (já existe no orderController)
    if (!req.body.customerId || !req.body.items || !req.body.paymentMethod) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // PASSO 1: Verificar estoque ANTES de criar pedido (sem transação!)
    console.log('Step 1: Pre-validating stock availability...');
    let totalAmount = 0;
    
    for (const item of req.body.items) {
      const product = await productsTable.findById(item.productId);
      
      if (!product) {
        return res.status(400).json({ error: `Product ${item.productId} not found` });
      }
      
      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${product.name}. Available: ${product.stock}` 
        });
      }
      
      totalAmount += product.price * item.quantity;
    }
    
    // ❌ PROBLEMA CRÍTICO: Chama o createOrder via função importada!
    // Isso cria acoplamento direto entre endpoints, sem HTTP
    console.log('Step 2: Creating order via orderController...');
    
    // ❌ Mock do req/res para chamar o controller (anti-pattern!)
    const mockReq: any = {
      body: req.body,
      user: (req as any).user
    };
    
    let orderId: number | null = null;
    let orderError: any = null;
    
    const mockRes: any = {
      status: (code: number) => ({
        json: (data: any) => {
          if (code === 201 && data.orderId) {
            orderId = data.orderId;
          } else {
            orderError = data;
          }
          return mockRes;
        }
      }),
      json: (data: any) => {
        if (data.orderId) {
          orderId = data.orderId;
        } else {
          orderError = data;
        }
        return mockRes;
      }
    };
    
    // ❌ ACOPLAMENTO DIRETO: Chama o controller como se fosse uma função comum!
    await orderController.createOrder(mockReq, mockRes); 
    
    if (!orderId) {
      console.error('Order creation failed:', orderError);
      return res.status(400).json({ 
        error: 'Failed to create order', 
        details: orderError 
      });
    }
    
    console.log('Order created successfully:', orderId);
    
    // PASSO 3: Processar pagamento (chamada externa acoplada, SEM TRANSAÇÃO!)
    console.log('Step 3: Processing payment...');
    try {
      // ❌ PROBLEMA: Axios importado no topo e usado diretamente
      const paymentResult = await axios.post('https://api.stripe.com/v1/payment_intents', {
        amount: Math.round((totalAmount + 15.00) * 100),
        currency: 'brl',
        payment_method: req.body.cardToken || 'pm_card_visa',
        confirm: true
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`
        },
        timeout: 5000
      });
      
      console.log('Payment processed:', paymentResult.data.id);
      
      // ❌ PROBLEMA: Atualiza status do pedido diretamente (sem passar pelo controller)
      await ordersTable.updatePaymentStatus(
        orderId, 
        paymentResult.data.status === 'succeeded' ? 'PAID' : 'FAILED'
      );
      
    } catch (paymentError: any) {
      console.error('Payment failed:', paymentError.message);
      
      // ❌ PROBLEMA CRÍTICO: Pedido JÁ FOI CRIADO, estoque JÁ FOI DECREMENTADO!
      // Agora tenta reverter manualmente (sem garantia de atomicidade)
      await ordersTable.updateStatus(orderId, 'PAYMENT_FAILED');
      
      // ❌ ESTOQUE NÃO É REVERTIDO! Dados inconsistentes!
      
      return res.status(400).json({ 
        error: 'Payment failed', 
        orderId: orderId,
        message: 'Order was created and stock was updated, but payment failed!',
        warning: 'Stock is now inconsistent - manual intervention required!'
      });
    }
    
    // PASSO 4: Enviar email de confirmação (acoplamento direto)
    console.log('Step 4: Sending confirmation email...');
    try {
      const customer = await customersTable.findById(req.body.customerId);
      
      // ❌ PROBLEMA: Envio de email direto no controller
      await emailService.send(
        customer.email,
        'Order Confirmation',
        `
          <h1>Order Confirmation</h1>
          <p>Your order #${orderId} has been confirmed!</p>
          <p>Total: R$ ${(totalAmount + 15.00).toFixed(2)}</p>
        `
      );
      
      console.log('Confirmation email sent to:', customer.email);
      
    } catch (emailError: any) {
      // ❌ PROBLEMA: Email falha mas não afeta o fluxo
      // Cliente pagou mas não recebe confirmação!
      console.error('Email failed but continuing:', emailError.message);
    }
    
    // PASSO 5: Log de auditoria (acesso direto ao banco)
    console.log('Step 5: Creating audit log...');
    await sqldb.execute(
      'INSERT INTO order_logs (order_id, action, user_id, details) VALUES ($1, $2, $3, $4)',
      [
        orderId, 
        'COMPLETE_FLOW_SUCCESS', 
        (req as any).user?.userId || 1,
        JSON.stringify({ totalAmount, paymentMethod: req.body.paymentMethod })
      ]
    );
    
    console.log('Complete flow finished successfully!');
    
    res.status(201).json({
      success: true,
      orderId: orderId,
      total: totalAmount + 15.00,
      message: 'Order completed with payment and notification',
      warnings: [
        'This endpoint couples multiple services without transaction',
        'If any step fails, data may be inconsistent'
      ]
    });
    
  } catch (error: any) {
    console.error('Complete flow catastrophic error:', error);
    
    // ❌ PROBLEMA: Erro genérico após possíveis alterações parciais!
    // Sistema pode estar em estado inconsistente
    res.status(500).json({ 
      error: 'Failed to complete order flow',
      message: error.message,
      stack: error.stack, // ❌ Expõe stack trace!
      warning: '⚠️  DATABASE MAY BE IN INCONSISTENT STATE - CHECK MANUALLY!'
    });
  }
});

// ============================================
// PRODUCT SERVICE ROUTES
// ============================================

// ❌ PROBLEMA: GET público (qualquer um pode ver produtos, até sem autenticação)
app.get('/api/products', async (req, res) => {
  try {
    // ❌ PROBLEMA: Sem TypeORM, usando queries diretas
    const products = await sqldb.query(
      'SELECT id, name, sku, price, stock, category_id, active FROM products WHERE active = $1 ORDER BY name LIMIT 100',
      [true]
    );
    
    // ❌ PROBLEMA: Transformações inline de apresentação
    const formattedProducts = products.map((product: any) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      // ❌ Formata preço inline - diferentes em cada endpoint
      price: `R$ ${parseFloat(product.price).toFixed(2).replace('.', ',')}`,
      // ❌ Stock display inline
      stock: product.stock,
      category_id: product.category_id
    }));
    
    res.json({ products: formattedProducts, total: products.length });
  } catch (error: any) {
    // ❌ PROBLEMA: Formato de erro 1 - expõe stack trace
    console.error(error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack, // ❌ STACK TRACE EXPOSTO!
      name: error.name
    });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    // ❌ PROBLEMA: Query direta sem abstrações
    const product = await sqldb.queryOne(
      'SELECT id, name, sku, description, price, cost, stock, category_id FROM products WHERE id = $1',
      [parseInt(req.params.id)]
    );
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error: any) {
    // ❌ PROBLEMA: Formato de erro 2 - formato completamente diferente
    console.error(error);
    res.status(500).send({
      status: 'error',
      message: error.toString(), // ❌ toString() expõe detalhes técnicos
      timestamp: Date.now()
    });
  }
});

// ❌ PROBLEMA: Autorização para criar produto - só ADMIN pode
app.post('/api/products', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    if (!req.body.name || !req.body.sku || !req.body.price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // ❌ PROBLEMA: Verificação de role DUPLICADA no handler
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can create products' });
    }
    
    // ❌ PROBLEMA: INSERT direto sem abstrações
    const result = await sqldb.query(
      `INSERT INTO products (name, sku, description, price, cost, stock, category_id, active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        req.body.name,
        req.body.sku,
        req.body.description || '',
        req.body.price,
        req.body.cost || 0,
        req.body.stock || 0,
        req.body.category_id || null,
        true
      ]
    );
    
    console.log('Product created by ADMIN:', user.email, 'Product ID:', result[0]?.id);
    res.status(201).json({ id: result[0]?.id, ...req.body });
  } catch (error: any) {
    // ❌ PROBLEMA: Formato de erro 3 - vaza exceção completa
    console.error(error);
    res.status(500).json({ 
      success: false,
      exception: error, // ❌ OBJETO DE ERRO COMPLETO!
      code: 'PRODUCT_CREATE_FAILED'
    });
  }
});

// ❌ PROBLEMA: Autorização para atualizar produto - só ADMIN pode
app.put('/api/products/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const user = (req as any).user;
    
    // ❌ PROBLEMA: Verificação de role inline NOVAMENTE
    if (user.role !== 'ADMIN') {
      console.log(`Unauthorized product update attempt by ${user.email}`);
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const product = await sqldb.queryOne(
      'SELECT id FROM products WHERE id = $1',
      [productId]
    );
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    await sqldb.execute(
      `UPDATE products SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        stock = COALESCE($4, stock),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [req.body.name, req.body.description, req.body.price, req.body.stock, productId]
    );
    
    console.log(`Product ${productId} updated by ADMIN ${user.email}`);
    res.json({ success: true, message: 'Product updated' });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ❌ PROBLEMA: Autorização para deletar produto - só ADMIN pode
app.delete('/api/products/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const user = (req as any).user;
    
    // ❌ PROBLEMA: Log de auditoria inline
    console.log(`Product deletion requested by ${user.email} (${user.role}) for product ${productId}`);
    
    // ❌ PROBLEMA: Soft delete inline
    await sqldb.execute(
      'UPDATE products SET active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [productId]
    );
    
    res.json({ success: true, message: 'Product deleted' });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id/stock', authenticate, requireAnyRole('ADMIN', 'SALES'), async (req, res) => {
  try {
    const user = (req as any).user;
    
    // ❌ PROBLEMA: Logging de autorização inline
    console.log(`Stock update by ${user.role}: ${user.email}`);
    
    // ❌ PROBLEMA: Query para buscar produto
    const product = await sqldb.queryOne(
      'SELECT id, stock FROM products WHERE id = $1',
      [parseInt(req.params.id)]
    );
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // ❌ PROBLEMA: Lógica de negócio no controller
    let newStock = product.stock;
    if (req.body.operation === 'decrease') {
      newStock = Math.max(0, product.stock - (req.body.quantity || 0));
    } else if (req.body.operation === 'increase') {
      newStock = product.stock + (req.body.quantity || 0);
    }
    
    // ❌ PROBLEMA: UPDATE direto
    await sqldb.execute(
      'UPDATE products SET stock = $1 WHERE id = $2',
      [newStock, parseInt(req.params.id)]
    );
    
    res.json({ id: product.id, stock: newStock });
  } catch (error: any) {
    // ❌ PROBLEMA: Formato de erro 4 - muito genérico
    console.error(error);
    res.status(500).send('Error updating stock'); // ❌ String simples, sem detalhes
  }
});

// ============================================
// CATEGORY ROUTES (Públicas para consulta)
// ============================================

// ❌ PROBLEMA: Rotas de categorias públicas, sem autenticação
app.get('/api/categories', async (req, res) => {
  try {
    // ❌ PROBLEMA: Query direta sem abstração
    const categories = await sqldb.query(
      'SELECT id, name, slug, parent_id, active FROM categories WHERE active = $1 ORDER BY name',
      [true]
    );
    
    res.json({ categories, total: categories.length });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/categories/:id', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    
    const category = await sqldb.queryOne(
      'SELECT id, name, slug, parent_id, active FROM categories WHERE id = $1',
      [categoryId]
    );
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // ❌ PROBLEMA: Buscar produtos da categoria inline
    const products = await sqldb.query(
      'SELECT id, name, sku, price FROM products WHERE category_id = $1 AND active = true LIMIT 50',
      [categoryId]
    );
    
    res.json({ category, products, productCount: products.length });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ❌ PROBLEMA: CRUD de categorias só para ADMIN
app.post('/api/categories', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    if (!req.body.name || !req.body.slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }
    
    const result = await sqldb.query(
      'INSERT INTO categories (name, slug, parent_id, active) VALUES ($1, $2, $3, true) RETURNING id',
      [req.body.name, req.body.slug, req.body.parent_id || null]
    );
    
    res.status(201).json({ id: result[0]?.id, ...req.body });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// USER PROFILE ROUTES (Usuário vê seu próprio perfil)
// ============================================

// ❌ PROBLEMA: Rota para usuário ver seu próprio perfil
// Qualquer usuário autenticado pode acessar
app.get('/api/profile', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    
    console.log(`Profile requested by ${user.email} (${user.role})`);
    
    // ❌ PROBLEMA: Query inline para buscar dados do usuário
    const userData = await sqldb.queryOne(
      'SELECT id, username, email, role, active, last_login, created_at FROM users WHERE id = $1',
      [user.userId]
    );
    
    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // ❌ PROBLEMA: Se o usuário tem um perfil de customer, busca também
    let customerData = null;
    if (user.role === 'USER') {
      customerData = await sqldb.queryOne(
        'SELECT id, name, email, phone, city, state, credit_limit, vip_status FROM customers WHERE email = $1',
        [user.email]
      );
    }
    
    res.json({ 
      user: userData,
      customer: customerData,
      permissions: user.permissions || []
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ❌ PROBLEMA: Rota para usuário atualizar seu próprio perfil (dados básicos)
app.put('/api/profile', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // ❌ PROBLEMA: Validação inline
    if (req.body.email && !req.body.email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    
    // ❌ PROBLEMA: Só pode atualizar nome e telefone do customer
    // Não pode mudar email, role, etc (segurança inline)
    if (user.role === 'USER') {
      const customerData = await sqldb.queryOne(
        'SELECT id FROM customers WHERE email = $1',
        [user.email]
      );
      
      if (customerData) {
        await sqldb.execute(
          'UPDATE customers SET name = COALESCE($1, name), phone = COALESCE($2, phone), updated_at = CURRENT_TIMESTAMP WHERE id = $3',
          [req.body.name, req.body.phone, customerData.id]
        );
      }
    }
    
    console.log(`Profile updated by ${user.email}`);
    res.json({ success: true, message: 'Profile updated' });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CUSTOMER SERVICE ROUTES
// ============================================

// ❌ PROBLEMA: Autorização espalhada por múltiplos middlewares e handlers
// ❌ PROBLEMA: Validação INLINE duplicada (também existe no middleware e no CustomerService!)
// ADMIN e SALES podem criar clientes, USER não pode
app.post('/api/customers', authenticate, requireAnyRole('ADMIN', 'SALES'), validateCustomerRegistration, async (req, res) => {
  try {
    const user = (req as any).user;
    console.log('Creating customer by:', user.email, 'Role:', user.role);
    
    // ❌ PROBLEMA: Verificação de role DUPLICADA aqui (já foi feita no middleware!)
    if (user.role !== 'ADMIN' && user.role !== 'SALES') {
      return res.status(403).json({ error: 'Only administrators and sales reps can create customers' });
    }
    
    // ❌ PROBLEMA: Validações NOVAMENTE aqui (4ª vez!)
    if (!req.body.email) {
      return res.status(400).json({ error: 'Email must be provided' }); // ❌ Mensagem diferente!
    }
    
    if (!req.body.cpf) {
      return res.status(400).json({ error: 'CPF must be provided' });
    }
    
    if (!req.body.name) {
      return res.status(400).json({ error: 'Name must be provided' });
    }
    
    // ❌ Validação de email INLINE - quinta vez!
    const emailPattern = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/; // ❌ QUARTA REGEX DIFERENTE!
    if (!emailPattern.test(req.body.email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    
    // ❌ PROBLEMA: Lógica de atribuição de sales rep inline
    // Se for SALES criando o customer, atribui automaticamente a ele
    if (user.role === 'SALES') {
      req.body.salesRepId = user.userId;
      console.log(`Customer auto-assigned to SALES rep: ${user.userId}`);
    }
    
    const customerId = await customerService.registerCustomer(req.body);
    await eventEmitter.notifyCustomerCreated(customerId);
    
    console.log('Customer created successfully:', customerId);
    
    // ❌ PROBLEMA: Transformação inline de apresentação
    // Formata CPF para resposta
    const formattedCpf = req.body.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    
    // ❌ Formata telefone inline
    const phone = req.body.phone.replace(/\D/g, '');
    const formattedPhone = phone.length === 11 
      ? phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
      : phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    
    res.status(201).json({ 
      success: true, 
      customerId,
      createdBy: user.email,
      data: {
        id: customerId,
        cpf: formattedCpf,
        phone: formattedPhone
      }
    });
  } catch (error: any) {
    // ❌ PROBLEMA: Formato de erro 5 - códigos HTTP inconsistentes
    console.error('Error creating customer:', error);
    
    // ❌ Verificações baseadas em substring (frágil)
    if (error.message.includes('already exists')) {
      return res.status(409).json({ 
        error: error.message,
        errorCode: 'DUPLICATE' // ❌ Nome de campo diferente
      });
    }
    
    if (error.message.includes('Invalid')) {
      return res.status(400).json({ 
        msg: error.message, // ❌ 'msg' ao invés de 'error'
        type: 'validation'
      });
    }
    
    if (error.message.includes('CPF')) {
      return res.status(422).json({ // ❌ Código HTTP diferente para validação
        message: error.message,
        field: 'cpf'
      });
    }
    
    // ❌ Erro genérico expõe detalhes
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message, // ❌ Vaza mensagem técnica
      errorType: error.constructor.name // ❌ Vaza tipo da classe
    });
  }
});

// ❌ PROBLEMA: GET de customer com verificação de ownership inline
app.get('/api/customers/:id', authenticate, requireOwnershipOrAdmin('customer'), async (req, res) => {
  try {
    const user = (req as any).user;
    const customerId = parseInt(req.params.id);
    
    // ❌ PROBLEMA: Verificação de autorização DUPLICADA (já feita no middleware)
    if (user.role === 'USER' && customerId !== user.userId) {
      console.log(`USER ${user.email} tried to access customer ${customerId}`);
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const customer = await customersTable.findById(customerId);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // ❌ PROBLEMA: Mascaramento de dados inline baseado em role
    let response: any = { ...customer };
    
    // USER vê dados limitados, ADMIN/SALES vêem tudo
    if (user.role === 'USER') {
      // ❌ PROBLEMA: Filtragem de campos inline
      response = {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        city: customer.city,
        state: customer.state
        // ❌ Não mostra credit_limit, document, etc para USER
      };
    } else {
      // ADMIN/SALES vêem dados sensíveis mascarados
      response.document = customer.document?.replace(/(\d{3})\d{5}(\d{3})/, '$1*****$2');
    }
    
    res.json(response);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ❌ PROBLEMA: UPDATE de customer só por ADMIN/SALES
app.put('/api/customers/:id', authenticate, requireAnyRole('ADMIN', 'SALES'), validateCustomerUpdate, async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    const user = (req as any).user;
    
    // ❌ PROBLEMA: Validação DUPLICADA aqui também!
    if (req.body.name && req.body.name.trim().length < 3) {
      return res.status(400).json({ error: 'Name must have minimum 3 characters' });
    }
    
    if (req.body.email && !req.body.email.includes('@')) {
      return res.status(400).json({ error: 'Email must contain @' }); // ❌ Validação mais simples aqui
    }
    
    // ❌ PROBLEMA: SALES só pode atualizar seus próprios clientes
    if (user.role === 'SALES') {
      const customer: any = await customersTable.findById(customerId);
      if (customer && customer.sales_rep_id !== user.userId) {
        console.log(`SALES ${user.email} tried to update customer ${customerId} assigned to another rep`);
        return res.status(403).json({ error: 'You can only update your own customers' });
      }
    }
    
    await sqldb.execute(
      'UPDATE customers SET name = $1, email = $2, phone = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
      [req.body.name, req.body.email, req.body.phone, customerId]
    );
    
    console.log(`Customer ${customerId} updated by ${user.role}: ${user.email}`);
    res.json({ success: true, message: 'Customer updated' });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ❌ PROBLEMA: DELETE de customer só por ADMIN
app.delete('/api/customers/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    const user = (req as any).user;
    
    console.log(`Customer deletion requested by ADMIN ${user.email} for customer ${customerId}`);
    
    // ❌ PROBLEMA: Soft delete inline
    await sqldb.execute(
      'UPDATE customers SET active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [customerId]
    );
    
    res.json({ success: true, message: 'Customer deleted' });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ❌ PROBLEMA: Credit limit update só por ADMIN
app.put('/api/customers/:id/credit-limit', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    const newLimit = parseFloat(req.body.creditLimit);
    const user = (req as any).user;
    
    // ❌ PROBLEMA: Verificação de role DUPLICADA
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can change credit limits' });
    }
    
    if (isNaN(newLimit) || newLimit < 0) {
      return res.status(400).json({ error: 'Invalid credit limit' });
    }
    
    if (newLimit > 50000) {
      return res.status(400).json({ error: 'Credit limit exceeds maximum' });
    }
    
    // ❌ PROBLEMA: Lógica de negócio inline no controller
    const customer: any = await customersTable.findById(customerId);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // ❌ Regra: Limite mínimo por categoria de cliente
    const minLimitByCategory: any = {
      'RETAIL': 500,
      'CORPORATE': 5000,
      'GOVERNMENT': 10000
    };
    
    const category = customer.category || 'RETAIL';
    const minLimit = minLimitByCategory[category] || 500;
    
    if (newLimit < minLimit) {
      return res.status(400).json({ 
        error: `Minimum credit limit for ${category} customers is R$ ${minLimit}` 
      });
    }
    
    // ❌ Regra: Requer aprovação para limites acima de 20k
    if (newLimit > 20000 && !req.body.approvedBy) {
      return res.status(400).json({ 
        error: 'Credit limits above R$ 20,000 require supervisor approval',
        required_field: 'approvedBy'
      });
    }
    
    await customerService.updateCreditLimit(customerId, newLimit);
    await eventEmitter.notifyCreditLimitChanged(customerId, newLimit);
    
    console.log(`Credit limit updated for customer ${customerId}: ${newLimit} by ADMIN ${user.email}`);
    res.json({ success: true, message: 'Credit limit updated', newLimit });
  } catch (error: any) {
    // ❌ PROBLEMA: Formato de erro 8 - muito verboso e inconsistente
    console.error(error);
    
    if (error.message.includes('score')) {
      return res.status(400).json({ 
        success: false,
        error: {
          message: error.message,
          code: 'LOW_CREDIT_SCORE',
          severity: 'high',
          timestamp: Date.now(),
          path: req.path
        }
      });
    }
    
    // ❌ Formato completamente diferente para erro genérico
    res.status(500).json({
      ok: false,
      err: error.message,
      stack_trace: error.stack, // ❌ STACK TRACE DE NOVO!
      request_id: Math.random().toString()
    });
  }
});

// ❌ PROBLEMA: Lista de customers só para ADMIN e SALES
app.get('/api/customers', authenticate, requireAnyRole('ADMIN', 'SALES'), async (req, res) => {
  try {
    const user = (req as any).user;
    
    let query = 'SELECT id, name, email, city, state, credit_limit, active FROM customers WHERE active = $1';
    let params: any[] = [true];
    
    // ❌ PROBLEMA: Lógica de autorização inline
    // SALES só vê seus clientes atribuídos
    if (user.role === 'SALES') {
      query += ' AND sales_rep_id = $2';
      params.push(user.userId);
      console.log(`SALES ${user.email} filtering customers by their assignment`);
    }
    
    query += ' ORDER BY name';
    
    const customers = await sqldb.query(query, params);
    
    res.json({ customers, total: customers.length, filteredBy: user.role === 'SALES' ? 'sales_rep' : 'all' });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ❌ ADMIN-ONLY ROUTES (User Management)
// ============================================

// ❌ PROBLEMA: Gerenciamento de usuários só para ADMIN
// Lógica de autorização espalhada por todo o código
app.get('/api/users', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const user = (req as any).user;
    
    // ❌ PROBLEMA: Verificação DUPLICADA (já feita no middleware)
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    console.log(`User list requested by ADMIN: ${user.email}`);
    
    const users = await sqldb.query(
      'SELECT id, username, email, role, active, last_login, created_at FROM users ORDER BY username',
      []
    );
    
    res.json({ users, total: users.length });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const adminUser = (req as any).user;
    
    console.log(`User creation requested by ADMIN: ${adminUser.email}`);
    
    // ❌ PROBLEMA: Validação inline
    if (!req.body.username || !req.body.email || !req.body.password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }
    
    // ❌ PROBLEMA: Validação de role inline
    const allowedRoles = ['ADMIN', 'USER', 'SALES'];
    if (req.body.role && !allowedRoles.includes(req.body.role)) {
      return res.status(400).json({ error: 'Invalid role. Allowed: ADMIN, USER, SALES' });
    }
    
    // ❌ PROBLEMA: Hash de senha inline (deveria usar bcrypt)
    const passwordHash = `$2b$10$fake_hash_${req.body.password}`; // ❌ SUPER INSEGURO!
    
    const result = await sqldb.query(
      `INSERT INTO users (username, email, password_hash, role, active) 
       VALUES ($1, $2, $3, $4, true) RETURNING id`,
      [req.body.username, req.body.email, passwordHash, req.body.role || 'USER']
    );
    
    console.log(`User created by ADMIN ${adminUser.email}: ${req.body.username} (${req.body.role || 'USER'})`);
    
    res.status(201).json({ 
      success: true, 
      userId: result[0]?.id,
      username: req.body.username,
      role: req.body.role || 'USER',
      createdBy: adminUser.email
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id/role', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const adminUser = (req as any).user;
    const userId = parseInt(req.params.id);
    
    // ❌ PROBLEMA: Admin não pode alterar seu próprio role (verificação inline)
    if (userId === adminUser.userId) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }
    
    const allowedRoles = ['ADMIN', 'USER', 'SALES'];
    if (!allowedRoles.includes(req.body.role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // ❌ PROBLEMA: Verificar se usuário existe inline
    const targetUser = await sqldb.queryOne(
      'SELECT id, username, role FROM users WHERE id = $1',
      [userId]
    );
    
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await sqldb.execute(
      'UPDATE users SET role = $1 WHERE id = $2',
      [req.body.role, userId]
    );
    
    console.log(`User ${targetUser.username} role changed from ${targetUser.role} to ${req.body.role} by ADMIN ${adminUser.email}`);
    
    res.json({ 
      success: true, 
      message: 'User role updated',
      userId: userId,
      oldRole: targetUser.role,
      newRole: req.body.role
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const adminUser = (req as any).user;
    const userId = parseInt(req.params.id);
    
    // ❌ PROBLEMA: Admin não pode deletar a si mesmo
    if (userId === adminUser.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // ❌ PROBLEMA: Soft delete inline
    await sqldb.execute(
      'UPDATE users SET active = false WHERE id = $1',
      [userId]
    );
    
    console.log(`User ${userId} deactivated by ADMIN ${adminUser.email}`);
    
    res.json({ success: true, message: 'User deactivated' });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ❌ PROBLEMA: Relatórios só para ADMIN e SALES
app.get('/api/reports/daily', authenticate, requireAnyRole('ADMIN', 'SALES'), async (req, res) => {
  try {
    const user = (req as any).user;
    
    console.log(`Daily report requested by ${user.role}: ${user.email}`);
    
    // ❌ PROBLEMA: Query complexa inline
    const metrics = await sqldb.query(
      `SELECT date, metric_type, value FROM daily_metrics 
       WHERE date >= CURRENT_DATE - INTERVAL '7 days' 
       ORDER BY date DESC, metric_type`,
      []
    );
    
    // ❌ PROBLEMA: SALES vê relatório filtrado, ADMIN vê tudo
    let ordersQuery = `
      SELECT DATE(created_at) as date, COUNT(*) as orders, SUM(total) as revenue
      FROM orders 
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    `;
    
    if (user.role === 'SALES') {
      // ❌ PROBLEMA: Lógica de filtro inline
      ordersQuery += ` AND created_by = ${user.userId}`;
      console.log(`Filtering report for SALES rep: ${user.userId}`);
    }
    
    ordersQuery += ' GROUP BY DATE(created_at) ORDER BY date DESC';
    
    const orderStats = await sqldb.query(ordersQuery, []);
    
    res.json({ 
      metrics, 
      orderStats,
      filteredBy: user.role === 'SALES' ? user.email : 'all',
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HEALTH CHECKS
// ============================================

app.get('/health', async (req, res) => {
  try {
    // ❌ PROBLEMA: Sem verificação adequada de saúde dos serviços
    await sqldb.query('SELECT 1');
    
    res.json({ 
      status: 'ok',
      database: 'connected',
      services: ['order', 'product', 'customer']
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ❌ PROBLEMA: Error handler genérico expondo stack
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message,
    stack: err.stack // ❌ Stack trace exposto!
  });
});

// ❌ PROBLEMA: 404 handler inline
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`===========================================`);
  console.log(`ShopHub API (Monolito) running on port ${PORT}`);
  console.log(`===========================================`);
  console.log(`Order Service:    http://localhost:${PORT}/api/orders`);
  console.log(`Product Service:  http://localhost:${PORT}/api/products`);
  console.log(`Customer Service: http://localhost:${PORT}/api/customers`);
  console.log(`Health Check:     http://localhost:${PORT}/health`);
  console.log(`===========================================`);
  console.log(`⚠️  ATENÇÃO: Este código contém ANTI-PATTERNS!`);
  console.log(`===========================================`);
  
  // ❌ PROBLEMA: Background jobs iniciados no mesmo processo da API
  // Jobs deveriam rodar em processos separados
  if (process.env.ENABLE_JOBS !== 'false') {
    console.log(`\n📋 Starting background jobs...`);
    startDailyReportJob();
    startExpiredOrdersJob();
    console.log(`✓ Background jobs started\n`);
  }
});

export default app;
