// ============================================
// ❌ ANTIPATTERN: MIDDLEWARE COM LÓGICA DE NEGÓCIO
// Problema: Regras de negócio dentro do middleware Express
// ============================================

import express from 'express';
import { sqldb } from '../db/connection';
import { customersTable } from '../db/tables/customers';
import { productsTable } from '../db/tables/products';

// ❌ PROBLEMA: Middleware contém validações de regras de negócio
// Deveria ser apenas parsing/validação de entrada HTTP
export async function validateCreateOrder(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const { customerId, items, paymentMethod } = req.body;
    
    // Validação básica OK (input HTTP)
    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must have items' });
    }
    
    if (!paymentMethod) {
      return res.status(400).json({ error: 'Payment method is required' });
    }
    
    // ❌ PROBLEMA: Lógica de negócio - verifica se cliente existe e está ativo
    // Isso deveria estar no use case, não no middleware
    console.log('Middleware: Validating customer existence...');
    const customer = await customersTable.findById(customerId);
    
    if (!customer) {
      return res.status(400).json({ 
        error: 'Customer not found' 
      });
    }
    
    if (!customer.active) {
      return res.status(400).json({ 
        error: 'Customer is not active' 
      });
    }
    
    // ❌ PROBLEMA: Regra de negócio - cliente deve ter limite de crédito mínimo
    // Conhecimento de domínio enterrado no middleware!
    if (paymentMethod === 'CREDIT_CARD' && customer.credit_limit < 100) {
      console.warn('Middleware blocked order: insufficient credit limit');
      return res.status(400).json({ 
        error: 'Customer does not have sufficient credit limit',
        hint: 'Minimum credit limit required: R$ 100.00'
      });
    }
    
    // ❌ PROBLEMA CRÍTICO: N+1 queries - verifica cada produto individualmente
    // E contém regra de negócio (verificação de estoque)
    console.log('Middleware: Validating products and stock...');
    
    for (const item of items) {
      if (!item.productId || !item.quantity) {
        return res.status(400).json({ 
          error: 'Each item must have productId and quantity' 
        });
      }
      
      if (item.quantity <= 0) {
        return res.status(400).json({ 
          error: 'Quantity must be greater than 0' 
        });
      }
      
      // ❌ PROBLEMA: Acesso direto ao banco de dados no middleware
      const product = await productsTable.findById(item.productId);
      
      if (!product) {
        return res.status(400).json({ 
          error: `Product ${item.productId} not found` 
        });
      }
      
      if (!product.active) {
        return res.status(400).json({ 
          error: `Product ${product.name} is not available` 
        });
      }
      
      // ❌ PROBLEMA: Regra de negócio - verificação de estoque
      // Esta é uma regra CORE do domínio, não deveria estar no middleware!
      if (product.stock < item.quantity) {
        console.warn(`Middleware blocked order: insufficient stock for product ${product.id}`);
        return res.status(400).json({ 
          error: `Insufficient stock for product ${product.name}`,
          available: product.stock,
          requested: item.quantity
        });
      }
      
      // ❌ PROBLEMA: Lógica de precificação no middleware
      // Calcula preço para validar valor mínimo do pedido
      const itemTotal = product.price * item.quantity;
      
      if (itemTotal > 50000) {
        return res.status(400).json({ 
          error: `Item total exceeds maximum allowed per product (R$ 50,000.00)`,
          productName: product.name
        });
      }
    }
    
    // ❌ PROBLEMA: Validação de regra de negócio - valor mínimo do pedido
    // Query adicional para calcular total (ineficiente!)
    let orderTotal = 0;
    for (const item of items) {
      const product = await productsTable.findById(item.productId);
      orderTotal += product.price * item.quantity;
    }
    
    if (orderTotal < 10) {
      return res.status(400).json({ 
        error: 'Order total must be at least R$ 10.00',
        currentTotal: orderTotal
      });
    }
    
    // ❌ PROBLEMA: Anexa dados ao request (side effect)
    // Controller vai depender desses dados estarem disponíveis
    (req as any).validatedCustomer = customer;
    (req as any).orderTotal = orderTotal;
    
    console.log('Middleware: All validations passed');
    next();
    
  } catch (error: any) {
    console.error('Middleware validation error:', error);
    
    // ❌ PROBLEMA: Tratamento de erro genérico expondo detalhes
    res.status(500).json({ 
      error: 'Validation failed',
      message: error.message,
      stack: error.stack // ❌ Stack trace vazado!
    });
  }
}

// ❌ PROBLEMA: Outro middleware com regra de negócio - validação de cupom
export async function validateCoupon(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const { couponCode } = req.body;
    
    if (!couponCode) {
      return next(); // Cupom é opcional
    }
    
    // ❌ PROBLEMA: Lógica de negócio - validação de cupom
    // Query direta no banco dentro do middleware
    const coupon = await sqldb.queryOne(
      `SELECT * FROM coupons 
       WHERE code = ? AND active = 1 
       AND expiry_date > NOW()`,
      [couponCode]
    );
    
    if (!coupon) {
      return res.status(400).json({ 
        error: 'Invalid or expired coupon code' 
      });
    }
    
    // ❌ PROBLEMA: Regra de negócio - verifica uso máximo do cupom
    const usageCount = await sqldb.queryOne(
      'SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_code = ?',
      [couponCode]
    );
    
    if (coupon.max_uses && usageCount.count >= coupon.max_uses) {
      return res.status(400).json({ 
        error: 'Coupon usage limit exceeded' 
      });
    }
    
    // ❌ PROBLEMA: Regra de negócio - verifica limite de uso por cliente
    if ((req as any).user?.userId) {
      const customerUsage = await sqldb.queryOne(
        'SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_code = ? AND customer_id = ?',
        [(req as any).user.userId]
      );
      
      if (coupon.max_uses_per_customer && customerUsage.count >= coupon.max_uses_per_customer) {
        return res.status(400).json({ 
          error: 'You have already used this coupon the maximum number of times' 
        });
      }
    }
    
    // ❌ PROBLEMA: Anexa cupom validado ao request (side effect)
    (req as any).validatedCoupon = coupon;
    
    next();
    
  } catch (error: any) {
    console.error('Coupon validation error:', error);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
}
