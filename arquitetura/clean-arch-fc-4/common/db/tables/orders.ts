// ============================================
// ❌ ANTIPATTERN: Queries diretas expostas
// Problema: Acesso direto ao banco sem Repository Pattern
// ============================================

import { sqldb } from '../connection';

// ❌ PROBLEMA: Módulo de tabela com queries inline
// Deveria ser Repository com interface

export const ordersTable = {
  // ❌ Queries SQL espalhadas
  async findById(id: number) {
    return sqldb.queryOne(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );
  },

  async findByCustomerId(customerId: number) {
    return sqldb.query(
      'SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC',
      [customerId]
    );
  },

  // ❌ PROBLEMA: Sem validação
  async create(orderData: any) {
    // Generate order_number
    const orderNumber = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();

    const result: any = await sqldb.query(
      `INSERT INTO orders
       (customer_id, order_number, subtotal, discount, shipping_fee, total,
        payment_method, status, payment_status, shipping_zip_code,
        shipping_address, shipping_city, shipping_state, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        orderData.customer_id,
        orderNumber,
        orderData.subtotal,
        orderData.discount || 0,
        orderData.shipping_fee || 0,
        orderData.total,
        orderData.payment_method,
        orderData.status || 'PENDING',
        orderData.payment_status || 'PENDING',
        orderData.shipping_zip_code,
        orderData.shipping_address,
        orderData.shipping_city,
        orderData.shipping_state,
        orderData.created_by
      ]
    );

    return result[0].id;
  },

  // ❌ PROBLEMA: Update sem validação de estado
  async updateStatus(id: number, status: string) {
    await sqldb.execute(
      'UPDATE orders SET status = $1 WHERE id = $2',
      [status, id]
    );
  },

  async updatePaymentStatus(id: number, paymentStatus: string, paymentId?: string) {
    await sqldb.execute(
      'UPDATE orders SET payment_status = $1, payment_transaction_id = $2 WHERE id = $3',
      [paymentStatus, paymentId, id]
    );
  },

  // ❌ PROBLEMA: Lógica de negócio aqui (deveria estar no domínio)
  async canBeCancelled(orderId: number): Promise<boolean> {
    const order: any = await sqldb.queryOne(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (!order) return false;

    // ❌ PROBLEMA: Lógica de negócio no data layer
    return ['PENDING', 'PROCESSING'].includes(order.status);
  },
  
  // ❌ PROBLEMA: SQL dinâmico com concatenação e IFs
  async searchOrders(filters: any): Promise<any[]> {
    let sql = 'SELECT * FROM orders o ';
    let params: any[] = [];
    
    // ❌ PROBLEMA: Concatenação manual de SQL baseado em IFs
    if (filters.includeCustomer) {
      sql += 'LEFT JOIN customers c ON o.customer_id = c.id ';
    }
    
    if (filters.includeItems) {
      sql += 'LEFT JOIN order_items oi ON o.id = oi.order_id ';
      sql += 'LEFT JOIN products p ON oi.product_id = p.id ';
    }
    
    sql += 'WHERE 1=1 '; // ❌ PROBLEMA: WHERE 1=1 hack
    
    if (filters.customerId) {
      sql += 'AND o.customer_id = $' + (params.length + 1) + ' ';
      params.push(filters.customerId);
    }

    if (filters.status) {
      sql += 'AND o.status = $' + (params.length + 1) + ' ';
      params.push(filters.status);
    }

    if (filters.minTotal) {
      sql += 'AND o.total >= $' + (params.length + 1) + ' ';
      params.push(filters.minTotal);
    }

    if (filters.maxTotal) {
      sql += 'AND o.total <= $' + (params.length + 1) + ' ';
      params.push(filters.maxTotal);
    }

    if (filters.dateFrom) {
      sql += 'AND o.created_at >= $' + (params.length + 1) + ' ';
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      sql += 'AND o.created_at <= $' + (params.length + 1) + ' ';
      params.push(filters.dateTo);
    }
    
    // ❌ PROBLEMA: Ordenação também concatenada
    if (filters.sortBy) {
      sql += 'ORDER BY o.' + filters.sortBy + ' '; // ❌ SQL Injection risk!
      
      if (filters.sortOrder) {
        sql += filters.sortOrder + ' '; // ❌ Mais SQL injection!
      }
    }
    
    // ❌ PROBLEMA: Limit e offset concatenados
    if (filters.limit) {
      sql += 'LIMIT ' + filters.limit + ' ';
      
      if (filters.offset) {
        sql += 'OFFSET ' + filters.offset;
      }
    }
    
    console.log('Generated SQL:', sql); // ❌ PROBLEMA: Log da query montada
    
    return sqldb.query(sql, params);
  }
};

// ❌ PROBLEMA: Order Items também com queries diretas
export const orderItemsTable = {
  async findByOrderId(orderId: number) {
    return sqldb.query(
      `SELECT oi.*, p.name as current_product_name, p.stock as current_stock
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [orderId]
    );
  },

  async create(orderItemData: any) {
    await sqldb.execute(
      `INSERT INTO order_items
       (order_id, product_id, product_name, sku, quantity, unit_price, discount_percentage, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        orderItemData.order_id,
        orderItemData.product_id,
        orderItemData.product_name,
        orderItemData.sku,
        orderItemData.quantity,
        orderItemData.unit_price,
        orderItemData.discount_percentage || 0,
        orderItemData.total
      ]
    );
  },

  // ❌ PROBLEMA: N+1 query - busca itens em loop
  async createMany(orderItems: any[]) {
    for (const item of orderItems) {
      await this.create(item);
    }
  }
};
