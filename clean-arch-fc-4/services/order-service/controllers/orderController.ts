// ============================================
// ❌ ANTIPATTERN: FAT CONTROLLER
// Problema: 300+ linhas, múltiplas responsabilidades
// ❌ ANTIPATTERN: Autorização inline espalhada
// ============================================

import express from 'express';
import { sqldb } from '../../../common/db/connection';
import { ordersTable, orderItemsTable } from '../../../common/db/tables/orders';
import { productsTable } from '../../../common/db/tables/products';
import { customersTable } from '../../../common/db/tables/customers';
import axios from 'axios';
import { emailService } from '../services/emailService';

// ❌ PROBLEMA: Tipos de role duplicados do middleware (sem compartilhamento)
type UserRole = 'ADMIN' | 'USER' | 'SALES';

// ❌ PROBLEMA: Controller com 300+ linhas e múltiplas responsabilidades
// ❌ PROBLEMA: Lógica de autorização misturada com lógica de negócio

export async function createOrder(req: express.Request, res: express.Response) {
  try {
    const user = (req as any).user;
    
    // ============= AUTORIZAÇÃO (20 linhas) =============
    // ❌ PROBLEMA: Verificação de autorização inline no controller
    // Deveria estar em um middleware ou domain service
    
    console.log(`Order creation attempt by ${user?.email} (${user?.role})`);
    
    // ❌ PROBLEMA: USER só pode criar pedidos para si mesmo
    if (user?.role === 'USER') {
      // ❌ Busca o customer_id do usuário logado
      const userCustomer: any = await sqldb.queryOne(
        'SELECT id FROM customers WHERE email = $1 OR id = $2',
        [user.email, user.userId]
      );
      
      if (!userCustomer) {
        return res.status(403).json({ 
          error: 'You must have a customer profile to place orders',
          hint: 'Contact support to create your customer account'
        });
      }
      
      // ❌ PROBLEMA: Força o customerId para o usuário logado
      if (req.body.customerId && req.body.customerId !== userCustomer.id) {
        console.log(`USER ${user.email} tried to create order for another customer: ${req.body.customerId}`);
        return res.status(403).json({ 
          error: 'You can only create orders for yourself',
          yourCustomerId: userCustomer.id
        });
      }
      
      req.body.customerId = userCustomer.id;
    }
    
    // ❌ PROBLEMA: SALES pode criar para qualquer cliente atribuído a ele
    if (user?.role === 'SALES') {
      const customer: any = await customersTable.findById(req.body.customerId);
      if (customer && customer.sales_rep_id !== user.userId) {
        console.log(`SALES ${user.email} tried to create order for unassigned customer: ${req.body.customerId}`);
        return res.status(403).json({ 
          error: 'You can only create orders for your assigned customers'
        });
      }
    }
    
    // ❌ PROBLEMA: ADMIN pode criar para qualquer cliente (sem verificação adicional)
    
    // ============= VALIDAÇÃO (50 linhas) =============
    // ❌ PROBLEMA: Logging manual inconsistente
    console.log('='.repeat(50));
    console.log('NEW ORDER REQUEST');
    console.log('Timestamp:', new Date().toISOString());
    console.log('User:', (req as any).user?.userId, (req as any).user?.email);
    console.log('Creating order for customer:', req.body.customerId);
    console.log('Request body:', JSON.stringify(req.body)); // ❌ Pode ter dados sensíveis!
    
    if (!req.body.customerId) {
      return res.status(400).json({ error: 'Customer ID required' });
    }
    
    if (!req.body.items || req.body.items.length === 0) {
      return res.status(400).json({ error: 'Items required' });
    }
    
    if (!req.body.paymentMethod) {
      return res.status(400).json({ error: 'Payment method required' });
    }
    
    const allowedPaymentMethods = ['CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BOLETO'];
    if (!allowedPaymentMethods.includes(req.body.paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }
    
    // ============= BUSCA DADOS (80 linhas) =============
    
    // ❌ PROBLEMA: Acesso direto ao banco no controller
    const customer: any = await customersTable.findById(req.body.customerId);
    
    if (!customer) {
      console.error('Customer not found:', req.body.customerId);
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    if (!customer.active) {
      return res.status(400).json({ error: 'Customer is not active' });
    }
    
    console.log('Customer found:', customer.name, customer.email);
    console.log('Customer details:', JSON.stringify(customer)); // ❌ Dados sensíveis!
    console.log('Starting items processing at', Date.now());
    
    // ❌ PROBLEMA: N+1 query problem
    const orderItems = [];
    let subtotal = 0;
    
    for (const item of req.body.items) {
      console.log(`Processing item: productId=${item.productId}, quantity=${item.quantity}`);
      const product: any = await productsTable.findById(item.productId);
      
      if (!product) {
        console.error('Product not found:', item.productId);
        console.error('Customer:', customer.email); // ❌ Email no erro
        return res.status(400).json({ error: `Product ${item.productId} not found` });
      }
      
      if (!product.active) {
        return res.status(400).json({ error: `Product ${product.name} is not active` });
      }
      
      if (product.stock < item.quantity) {
        console.warn('Insufficient stock:', product.id, 'Available:', product.stock, 'Requested:', item.quantity);
        return res.status(400).json({ 
          error: `Insufficient stock for ${product.name}. Available: ${product.stock}` 
        });
      }
      
      const itemTotal = parseFloat(product.price) * item.quantity;
      subtotal += itemTotal;
      
      orderItems.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unitPrice: product.price,
        total: itemTotal
      });
    }
    
    // ============= LÓGICA DE NEGÓCIO (100 linhas) =============
    
    // ❌ PROBLEMA: Lógica de desconto complexa no controller (deveria estar em Domain Service)
    let discount = 0;
    let vipDiscount = 0;
    let bulkDiscount = 0;
    
    // ❌ Desconto VIP baseado em total de compras do cliente
    const customerStats: any = await sqldb.queryOne(
      'SELECT SUM(total) as total_purchases, COUNT(*) as order_count FROM orders WHERE customer_id = $1 AND status = \'COMPLETED\'',
      [customer.id]
    );
    
    if (customerStats.total_purchases > 10000) {
      vipDiscount = subtotal * 0.15; // 15% para clientes VIP Gold
      console.log('VIP Gold discount applied:', vipDiscount);
    } else if (customerStats.total_purchases > 5000) {
      vipDiscount = subtotal * 0.10; // 10% para clientes VIP Silver
      console.log('VIP Silver discount applied:', vipDiscount);
    } else if (customerStats.total_purchases > 2000) {
      vipDiscount = subtotal * 0.05; // 5% para clientes VIP Bronze
      console.log('VIP Bronze discount applied:', vipDiscount);
    }
    
    // ❌ Desconto por volume (lógica de domínio espalhada)
    if (orderItems.length >= 10) {
      bulkDiscount = subtotal * 0.08; // 8% desconto para 10+ itens
    } else if (orderItems.length >= 5) {
      bulkDiscount = subtotal * 0.05; // 5% desconto para 5+ itens
    }
    
    // ❌ Cupom de desconto
    let couponDiscount = 0;
    if (req.body.couponCode) {
      const coupon: any = await sqldb.queryOne(
        `SELECT * FROM coupons
         WHERE code = $1 AND active = true
         AND expiry_date > NOW()`,
        [req.body.couponCode]
      );
      
      if (coupon) {
        if (coupon.min_order_value && subtotal < coupon.min_order_value) {
          return res.status(400).json({ 
            error: `Minimum order value for this coupon is ${coupon.min_order_value}` 
          });
        }
        
        // ❌ Validação de uso do cupom inline
        const couponUsageCount: any = await sqldb.queryOne(
          'SELECT COUNT(*) as usage_count FROM coupon_usage WHERE coupon_code = $1 AND customer_id = $2',
          [req.body.couponCode, customer.id]
        );
        
        if (coupon.usage_limit_per_customer && couponUsageCount.usage_count >= coupon.usage_limit_per_customer) {
          return res.status(400).json({ error: 'Coupon usage limit exceeded' });
        }
        
        if (coupon.discount_type === 'PERCENTAGE') {
          couponDiscount = subtotal * (coupon.discount_value / 100);
          if (coupon.max_discount_amount && couponDiscount > coupon.max_discount_amount) {
            couponDiscount = coupon.max_discount_amount;
          }
        } else {
          couponDiscount = coupon.discount_value;
        }
      }
    }
    
    // ❌ PROBLEMA: Regra de negócio - descontos não acumulam totalmente
    // VIP + Bulk são acumuláveis, mas cupom é o maior entre ele e a soma dos outros
    const automaticDiscount = vipDiscount + bulkDiscount;
    discount = Math.max(couponDiscount, automaticDiscount);
    
    console.log('Discount breakdown:', { vipDiscount, bulkDiscount, couponDiscount, finalDiscount: discount });
    
    const totalAfterDiscount = parseFloat(subtotal.toString()) - parseFloat(discount.toString());
    
    // ❌ PROBLEMA: Cálculo de frete complexo no controller (deveria estar em Domain Service)
    let shippingFee = 0;
    
    if (totalAfterDiscount >= 200) {
      // Frete grátis acima de R$ 200
      shippingFee = 0;
      console.log('Free shipping applied (order > 200)');
    } else {
      // ❌ Lógica de frete por zona geográfica
      const zipPrefix = customer.zip_code.substring(0, 5);
      const shippingZone: any = await sqldb.queryOne(
        'SELECT fee FROM shipping_zones WHERE zip_code LIKE $1',
        [zipPrefix + '%']
      );
      
      // ❌ Calcula peso total inline
      let totalWeight = 0;
      for (const item of orderItems) {
        const product: any = await productsTable.findById(item.productId);
        totalWeight += (parseFloat(product.weight || '0.5')) * item.quantity; // Peso padrão 0.5kg
      }
      
      if (shippingZone) {
        // ❌ Regra de negócio: frete por zona e peso
        shippingFee = parseFloat(shippingZone.fee) + (totalWeight * 0.5); // Base fee + R$0.50 por kg
        
        // ❌ Regra adicional: taxa de área remota
        if (totalWeight > 10) {
          shippingFee *= 1.5; // 50% adicional para área remota
          console.log('Remote area surcharge applied');
        }
        
        // ❌ Regra: frete expresso (entrega em 24h)
        if (req.body.expressDelivery) {
          shippingFee *= 2; // Dobra o valor para entrega expressa
          console.log('Express delivery fee applied');
        }
      }
      else {
        // Zona não encontrada - usa tabela padrão
        if (totalWeight <= 1) {
          shippingFee = 15;
        } else if (totalWeight <= 5) {
          shippingFee = 25;
        } else if (totalWeight <= 10) {
          shippingFee = 40;
        } else {
          shippingFee = 40 + ((totalWeight - 10) * 3); // R$ 3 por kg adicional
        }
      }
      
      console.log('Shipping calculated:', { shippingFee });
    }
    
    const total = parseFloat(totalAfterDiscount.toString()) + parseFloat(shippingFee.toString());
    
    // ❌ PROBLEMA: Validação complexa de limite de crédito no controller (deveria estar em Domain Service)
    if (req.body.paymentMethod === 'CREDIT_CARD' || req.body.paymentMethod === 'BOLETO') {
      // ❌ Calcula crédito já utilizado
      const pendingOrders: any = await sqldb.query(
        `SELECT SUM(total) as pending_total FROM orders
         WHERE customer_id = $1 AND payment_status IN ('PENDING', 'PROCESSING')
         AND status NOT IN ('CANCELLED', 'REFUNDED')`,
        [customer.id]
      );
      
      const creditUsed = parseFloat(pendingOrders[0]?.pending_total || 0);
      const creditAvailable = customer.credit_limit - creditUsed;
      
      console.log('Credit check:', { 
        limit: customer.credit_limit, 
        used: creditUsed, 
        available: creditAvailable,
        orderTotal: total 
      });
      
      if (creditAvailable < total) {
        return res.status(400).json({ 
          error: 'Customer credit limit exceeded',
          creditLimit: customer.credit_limit,
          creditUsed: creditUsed,
          creditAvailable: creditAvailable,
          orderTotal: total
        });
      }
      
      // ❌ PROBLEMA: Regra de negócio - limite especial para primeira compra
      if (customerStats.order_count === 0 && total > 500) {
        return res.status(400).json({ 
          error: 'First order limit is R$ 500.00 for credit purchases',
          orderTotal: total
        });
      }
      
      // ❌ Regra: cliente com pagamentos atrasados tem limite reduzido
      const latePayments: any = await sqldb.queryOne(
        `SELECT COUNT(*) as late_count FROM orders
         WHERE customer_id = $1
         AND payment_status = 'OVERDUE'`,
        [customer.id]
      );
      
      if (latePayments.late_count > 0) {
        const reducedLimit = customer.credit_limit * 0.5; // Reduz 50%
        if (creditUsed + total > reducedLimit) {
          return res.status(400).json({ 
            error: 'Credit limit reduced due to late payments',
            reducedLimit: reducedLimit,
            latePaymentsCount: latePayments.late_count
          });
        }
      }
    }
    
    // ============= TRANSAÇÕES NO BANCO (60 linhas) =============
    
    // ❌ PROBLEMA: Sem transaction management - race conditions!
    
    const orderId = await ordersTable.create({
      customer_id: customer.id,
      subtotal: subtotal,
      discount: discount,
      shipping_fee: shippingFee,
      total: total,
      payment_method: req.body.paymentMethod,
      status: 'PENDING',
      payment_status: 'PENDING',
      shipping_zip_code: customer.zip_code,
      shipping_address: customer.address,
      shipping_city: customer.city,
      shipping_state: customer.state,
      created_by: (req as any).user?.userId || 1
    });
    
    console.log('Order created:', orderId);
    
    // ❌ PROBLEMA: N+1 inserts
    for (const item of orderItems) {
      await orderItemsTable.create({
        order_id: orderId,
        product_id: item.productId,
        product_name: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_percentage: 0,
        total: item.total
      });
      
      // ❌ PROBLEMA: Atualiza estoque sem transaction
      await productsTable.decreaseStock(item.productId, item.quantity);
    }
    
    // ❌ PROBLEMA: Registra uso do cupom sem transaction
    if (req.body.couponCode && discount > 0) {
      await sqldb.execute(
        'INSERT INTO coupon_usage (coupon_code, order_id, customer_id, discount_applied) VALUES ($1, $2, $3, $4)',
        [req.body.couponCode, orderId, customer.id, discount]
      );
    }
    
    // ============= PROCESSAMENTO DE PAGAMENTO (40 linhas) =============
    
    console.log('Processing payment for order:', orderId);
    
    // ❌ PROBLEMA: Chamada direta a API externa (Stripe hardcoded)
    let paymentStatus = 'PENDING';
    try {
      // Real code - chamada direta ao Stripe
      const paymentResult = await axios.post('https://api.stripe.com/v1/payment_intents', {
        amount: Math.round(total * 100),
        currency: 'brl',
        payment_method: req.body.cardToken || 'pm_card_visa',
        confirm: true
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`
        }
      });
      
      paymentStatus = paymentResult.data.status === 'succeeded' ? 'PAID' : 'PENDING';
      
      await ordersTable.updatePaymentStatus(orderId, paymentStatus, paymentResult.data.id);
      
      console.log('Payment successful. Transaction ID:', paymentResult.data.id);
      
    } catch (paymentError: any) {
      console.error('Payment processing error:', paymentError);
      
      await ordersTable.updatePaymentStatus(orderId, 'FAILED');
      await ordersTable.updateStatus(orderId, 'PAYMENT_FAILED');
      
      return res.status(400).json({ 
        error: 'Payment failed', 
        details: paymentError.message 
      });
    }
    
    // ============= NOTIFICAÇÕES (30 linhas) =============
    
    // ❌ PROBLEMA: Envio de email direto no controller
    try {
      await emailService.send(
        customer.email,
        'Order Confirmation',
        `
          <h1>Order Confirmation</h1>
          <p>Hello ${customer.name},</p>
          <p>Your order #${orderId} has been confirmed!</p>
          <p>Total: R$ ${total.toFixed(2)}</p>
        `
      );
      
      console.log('Email sent to:', customer.email);
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // ❌ PROBLEMA: Erro silencioso - não falha o pedido
    }
    
    // ============= LOGGING E ANALYTICS (20 linhas) =============
    
    // ❌ PROBLEMA: Logging manual espalhado
    await sqldb.execute(
      'INSERT INTO order_logs (order_id, action, user_id) VALUES ($1, $2, $3)',
      [orderId, 'CREATED', (req as any).user?.userId || 1]
    );
    
    // ❌ Webhook para analytics
    try {
      await axios.post('https://analytics.shophub.com/events', {
        event: 'order_created',
        orderId: orderId,
        customerId: customer.id,
        total: total,
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.ANALYTICS_API_KEY}`
        }
      });
      console.log('Analytics event sent for order:', orderId);
    } catch (analyticsError) {
      console.error('Failed to send analytics event:', analyticsError);
    }

    // ❌ Registra métricas diárias (lógica de negócio no banco - ANTI-PATTERN!)
    try {
      await sqldb.execute(
        `INSERT INTO daily_metrics (date, metric_type, value) 
         VALUES (CURRENT_DATE, 'ORDERS_CREATED', 1),
                (CURRENT_DATE, 'REVENUE', $1)
         ON CONFLICT (date, metric_type) DO UPDATE SET
         value = daily_metrics.value + EXCLUDED.value`,
        [total]
      );
      console.log('Daily metrics updated');
    } catch (metricsError) {
      console.error('Failed to update metrics:', metricsError);
    }
    
    console.log('Order created successfully:', orderId);
    
    // ============= RESPOSTA (10 linhas) =============
    
    res.status(201).json({
      success: true,
      orderId: orderId,
      status: 'PENDING',
      paymentStatus: paymentStatus,
      total: total,
      message: 'Order created successfully'
    });
    
  } catch (error: any) {
    // ❌ PROBLEMA: Tratamento de erro genérico
    console.error('Error creating order:', error);
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: error.stack // ❌ PROBLEMA: Stack trace exposto!
    });
  }
}

// ❌ PROBLEMA: Mais funções no mesmo arquivo

export async function getOrder(req: express.Request, res: express.Response) {
  try {
    const user = (req as any).user;
    const orderId = parseInt(req.params.id);
    
    console.log(`Order ${orderId} requested by ${user?.email} (${user?.role})`);
    
    const order = await ordersTable.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // ❌ PROBLEMA: Verificação de autorização inline
    // USER só pode ver seus próprios pedidos
    if (user?.role === 'USER') {
      const userCustomer: any = await sqldb.queryOne(
        'SELECT id FROM customers WHERE email = $1 OR id = $2',
        [user.email, user.userId]
      );
      
      if (!userCustomer || order.customer_id !== userCustomer.id) {
        console.log(`USER ${user.email} tried to view order ${orderId} of another customer`);
        return res.status(403).json({ error: 'Access denied: not your order' });
      }
    }
    
    // ❌ PROBLEMA: SALES só pode ver pedidos dos seus clientes
    if (user?.role === 'SALES') {
      const customer: any = await customersTable.findById(order.customer_id);
      if (customer && customer.sales_rep_id !== user.userId) {
        console.log(`SALES ${user.email} tried to view order ${orderId} of unassigned customer`);
        return res.status(403).json({ error: 'Access denied: not your customer\'s order' });
      }
    }
    
    // ❌ ADMIN pode ver qualquer pedido
    
    const items = await orderItemsTable.findByOrderId(order.id);
    const customer = await customersTable.findById(order.customer_id);
    
    // ❌ PROBLEMA: Transformações inline de apresentação
    // Formata valores monetários
    const formattedOrder = {
      ...order,
      total: `R$ ${parseFloat(order.total).toFixed(2).replace('.', ',')}`,
      subtotal: `R$ ${parseFloat(order.subtotal).toFixed(2).replace('.', ',')}`,
      discount: `R$ ${parseFloat(order.discount).toFixed(2).replace('.', ',')}`,
      shipping_fee: `R$ ${parseFloat(order.shipping_fee).toFixed(2).replace('.', ',')}`,
      // ❌ Formata data inline
      created_at: new Date(order.created_at).toLocaleDateString('pt-BR'),
      // ❌ Traduz status inline
      status_label: order.status === 'PENDING' ? 'Pendente' : 
                    order.status === 'PAID' ? 'Pago' :
                    order.status === 'CANCELLED' ? 'Cancelado' : order.status
    };
    
    // ❌ Formata items inline
    const formattedItems = items.map((item: any) => ({
      ...item,
      unit_price: `R$ ${parseFloat(item.unit_price).toFixed(2)}`,
      total: `R$ ${(item.quantity * parseFloat(item.unit_price)).toFixed(2)}`,
      // ❌ Formata quantidade
      quantity_display: `${item.quantity}x`
    }));
    
    // ❌ PROBLEMA: Mascaramento de dados baseado em role
    let formattedCustomer: any;
    
    if (user?.role === 'ADMIN') {
      // ADMIN vê todos os dados (mas mascarados)
      formattedCustomer = {
        ...customer,
        document: customer.document?.replace(/(\d{3})\d{5}(\d{3})/, '$1*****$2'),
        email: customer.email,
        phone: customer.phone
      };
    } else if (user?.role === 'SALES') {
      // SALES vê dados para contato
      formattedCustomer = {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        city: customer.city,
        state: customer.state
      };
    } else {
      // USER vê dados mínimos
      formattedCustomer = {
        id: customer.id,
        name: customer.name,
        city: customer.city,
        state: customer.state
      };
    }
    
    res.json({
      order: formattedOrder,
      items: formattedItems,
      customer: formattedCustomer,
      viewedBy: user?.role
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

export async function cancelOrder(req: express.Request, res: express.Response) {
  try {
    const orderId = parseInt(req.params.id);
    const user = (req as any).user;
    
    // ❌ PROBLEMA: Lógica de autorização inline no controller
    console.log(`Order cancellation attempt by ${user?.email} (${user?.role}) for order ${orderId}`);
    
    // ❌ PROBLEMA: Lógica de negócio complexa no controller (deveria estar em Domain Service)
    const order: any = await ordersTable.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // ❌ PROBLEMA: Verificação de ownership inline
    // USER só pode cancelar seus próprios pedidos
    if (user?.role === 'USER') {
      const userCustomer: any = await sqldb.queryOne(
        'SELECT id FROM customers WHERE email = $1 OR id = $2',
        [user.email, user.userId]
      );
      
      if (!userCustomer || order.customer_id !== userCustomer.id) {
        console.log(`USER ${user.email} tried to cancel order ${orderId} of another customer`);
        return res.status(403).json({ error: 'You can only cancel your own orders' });
      }
      
      // ❌ PROBLEMA: USER tem restrições adicionais de cancelamento
      const now = new Date();
      const createdAt = new Date(order.created_at);
      const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      
      // USER só pode cancelar em até 2 horas
      if (hoursSinceCreation > 2) {
        return res.status(403).json({ 
          error: 'Users can only cancel orders within 2 hours of creation',
          hoursSinceCreation: hoursSinceCreation.toFixed(2),
          hint: 'Contact support to request cancellation'
        });
      }
    }
    
    // ❌ PROBLEMA: SALES pode cancelar pedidos dos seus clientes
    if (user?.role === 'SALES') {
      const customer: any = await customersTable.findById(order.customer_id);
      if (customer && customer.sales_rep_id !== user.userId) {
        console.log(`SALES ${user.email} tried to cancel order ${orderId} of unassigned customer`);
        return res.status(403).json({ error: 'You can only cancel orders of your assigned customers' });
      }
    }
    
    // ❌ PROBLEMA: ADMIN pode cancelar qualquer pedido (sem restrição de tempo)
    
    // ❌ Regras de cancelamento inline
    const now = new Date();
    const createdAt = new Date(order.created_at);
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    
    // ❌ Regra 1: Pedidos pagos há mais de 24h não podem ser cancelados
    if (order.payment_status === 'PAID' && hoursSinceCreation > 24) {
      return res.status(400).json({ 
        error: 'Cannot cancel paid orders after 24 hours',
        orderCreatedAt: order.created_at,
        hoursSinceCreation: hoursSinceCreation.toFixed(2)
      });
    }
    
    // ❌ Regra 2: Pedidos em separação/envio não podem ser cancelados
    if (['PREPARING', 'SHIPPED', 'IN_TRANSIT'].includes(order.status)) {
      return res.status(400).json({ 
        error: 'Cannot cancel orders that are being prepared or shipped',
        currentStatus: order.status
      });
    }
    
    // ❌ Regra 3: Pedidos já cancelados/entregues
    if (['CANCELLED', 'DELIVERED', 'REFUNDED'].includes(order.status)) {
      return res.status(400).json({ 
        error: 'Order is already in final state',
        currentStatus: order.status
      });
    }
    
    console.log('Cancelling order:', orderId, 'Status:', order.status, 'Payment:', order.payment_status);
    
    // ❌ PROBLEMA: Lógica de reembolso inline
    let refundAmount = 0;
    let refundPercentage = 100;
    
    if (order.payment_status === 'PAID') {
      // ❌ Regra: Cobra taxa de cancelamento progressiva
      if (hoursSinceCreation < 1) {
        refundPercentage = 100; // Reembolso total se cancelar em 1h
      } else if (hoursSinceCreation < 6) {
        refundPercentage = 95; // 5% de taxa se cancelar em 6h
      } else if (hoursSinceCreation < 12) {
        refundPercentage = 90; // 10% de taxa se cancelar em 12h
      } else {
        refundPercentage = 85; // 15% de taxa após 12h
      }
      
      refundAmount = parseFloat(order.total) * (refundPercentage / 100);
      
      console.log('Refund calculation:', { 
        orderTotal: order.total, 
        refundPercentage, 
        refundAmount,
        hoursSinceCreation: hoursSinceCreation.toFixed(2)
      });
      
      // ❌ Processa reembolso inline
      try {
        await axios.post('https://api.stripe.com/v1/refunds', {
          payment_intent: order.payment_transaction_id,
          amount: Math.round(refundAmount * 100)
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`
          }
        });
        
        console.log('Refund processed:', refundAmount);
      } catch (refundError) {
        console.error('Refund failed:', refundError);
        return res.status(500).json({ error: 'Failed to process refund' });
      }
    }
    
    // ❌ PROBLEMA: Reversão de estoque sem transaction
    const items: any = await orderItemsTable.findByOrderId(orderId);
    for (const item of items) {
      await productsTable.increaseStock(item.product_id, item.quantity);
      console.log('Stock restored:', item.product_id, '+', item.quantity);
    }
    
    // ❌ Atualiza status do pedido
    await ordersTable.updateStatus(orderId, 'CANCELLED');
    if (refundAmount > 0) {
      await ordersTable.updatePaymentStatus(orderId, 'REFUNDED');
    }
    
    // ❌ Registra cancelamento
    await sqldb.execute(
      'INSERT INTO order_logs (order_id, action, user_id, details) VALUES ($1, $2, $3, $4)',
      [orderId, 'CANCELLED', (req as any).user?.userId || 1, JSON.stringify({ refundAmount, refundPercentage })]
    );
    
    res.json({ 
      success: true, 
      message: 'Order cancelled',
      refundAmount: refundAmount,
      refundPercentage: refundPercentage
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
