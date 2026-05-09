// ============================================
// ❌ ANTIPATTERN: LOGGING ESPALHADO E INCONSISTENTE
// Problema: console.log por todo código, sem padrão
// ============================================

import { sqldb } from '../../../common/db/connection';
import { customersTable } from '../../../common/db/tables/customers';
import { productsTable } from '../../../common/db/tables/products';

// ❌ PROBLEMA: Classe com logging manual excessivo

export class OrderValidationService {
  
  // ❌ PROBLEMA: 30+ logs em uma única função
  async validateOrderCreation(customerId: number, items: any[], paymentMethod: string): Promise<any> {
    // ❌ Logging inconsistente - string concat
    console.log('========================================');
    console.log('Starting order validation for customer: ' + customerId);
    console.log('Timestamp: ' + new Date().toISOString());
    console.log('========================================');
    
    // ❌ PROBLEMA: Log com dados sensíveis (pode ter cartão, token)
    console.log('Full input data:', JSON.stringify({ customerId, items, paymentMethod }));
    
    // Valida customer
    console.log('[STEP 1] Validating customer...');
    const customer = await customersTable.findById(customerId);
    
    if (!customer) {
      // ❌ PROBLEMA: Nível inconsistente - deveria ser error
      console.log('ERROR: Customer not found:', customerId);
      console.log('Validation failed at:', new Date().toISOString());
      throw new Error('Customer not found');
    }
    
    // ❌ PROBLEMA: Log com dados potencialmente sensíveis
    console.log('Customer found:');
    console.log('  - ID:', customer.id);
    console.log('  - Name:', customer.name);
    console.log('  - Email:', customer.email); // ❌ Email é sensível!
    console.log('  - CPF:', customer.document); // ❌ CPF é sensível!
    console.log('  - Credit Limit:', customer.credit_limit);
    console.log('  - Address:', customer.address);
    
    if (!customer.active) {
      console.warn('WARNING: Customer is not active:', customer.id);
      console.warn('Customer name:', customer.name);
      console.warn('Customer email:', customer.email); // ❌ De novo!
      throw new Error('Customer is not active');
    }
    
    console.log('✓ Customer validation passed');
    
    // Valida items
    console.log('[STEP 2] Validating order items...');
    console.log('Number of items to validate:', items.length);
    
    if (!items || items.length === 0) {
      console.error('ERROR: No items provided');
      console.error('Customer:', customerId);
      console.error('Time:', new Date().toISOString());
      throw new Error('Order must have items');
    }
    
    console.log('Processing', items.length, 'items...');
    
    const validatedItems = [];
    let totalAmount = 0;
    
    // ❌ PROBLEMA: Log dentro de loop (performance)
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      console.log(`  [Item ${i + 1}/${items.length}] Processing product ${item.productId}...`);
      console.log(`    Requested quantity: ${item.quantity}`);
      
      const product = await productsTable.findById(item.productId);
      
      if (!product) {
        console.error(`  ✗ Product not found: ${item.productId}`);
        console.error(`    Customer: ${customer.email}`); // ❌ Email de novo
        console.error(`    Item index: ${i}`);
        console.error(`    Full item data:`, JSON.stringify(item));
        throw new Error(`Product ${item.productId} not found`);
      }
      
      // ❌ PROBLEMA: Log com informações comerciais sensíveis
      console.log(`    Product found: ${product.name}`);
      console.log(`    SKU: ${product.sku}`);
      console.log(`    Price: R$ ${product.price}`); // ❌ Preço pode ser sensível
      console.log(`    Cost: R$ ${product.cost}`); // ❌ CUSTO É SENSÍVEL!
      console.log(`    Stock: ${product.stock}`);
      console.log(`    Profit margin: ${((product.price - product.cost) / product.cost * 100).toFixed(2)}%`); // ❌ MARGEM!
      
      if (!product.active) {
        console.warn(`  ⚠ Product is not active: ${product.id}`);
        console.warn(`    Product name: ${product.name}`);
        console.warn(`    Requested by customer: ${customer.email}`);
        throw new Error(`Product ${product.name} is not available`);
      }
      
      if (product.stock < item.quantity) {
        console.warn(`  ⚠ Insufficient stock for product ${product.id}`);
        console.warn(`    Product: ${product.name}`);
        console.warn(`    Available: ${product.stock}`);
        console.warn(`    Requested: ${item.quantity}`);
        console.warn(`    Shortage: ${item.quantity - product.stock}`);
        console.warn(`    Customer: ${customer.name} (${customer.email})`);
        
        throw new Error(`Insufficient stock for ${product.name}`);
      }
      
      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;
      
      console.log(`    Item total: R$ ${itemTotal.toFixed(2)}`);
      console.log(`    Running total: R$ ${totalAmount.toFixed(2)}`);
      console.log(`  ✓ Item ${i + 1} validated successfully`);
      
      validatedItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        total: itemTotal
      });
    }
    
    console.log('✓ All items validated');
    console.log('Order subtotal: R$ ' + totalAmount.toFixed(2));
    
    // Valida payment method
    console.log('[STEP 3] Validating payment method...');
    console.log('Payment method:', paymentMethod);
    
    const allowedMethods = ['CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BOLETO'];
    
    if (!allowedMethods.includes(paymentMethod)) {
      console.error('ERROR: Invalid payment method:', paymentMethod);
      console.error('Allowed methods:', allowedMethods.join(', '));
      console.error('Customer:', customer.email);
      throw new Error('Invalid payment method');
    }
    
    console.log('✓ Payment method validated');
    
    // Valida credit limit
    if (paymentMethod === 'CREDIT_CARD') {
      console.log('[STEP 4] Validating credit limit...');
      console.log('Customer credit limit: R$', customer.credit_limit);
      console.log('Order total: R$', totalAmount.toFixed(2));
      
      if (customer.credit_limit < totalAmount) {
        console.warn('⚠ Credit limit exceeded!');
        console.warn('  Customer:', customer.name, '(' + customer.email + ')');
        console.warn('  Credit limit: R$', customer.credit_limit);
        console.warn('  Order total: R$', totalAmount.toFixed(2));
        console.warn('  Shortage: R$', (totalAmount - customer.credit_limit).toFixed(2));
        
        throw new Error('Customer credit limit exceeded');
      }
      
      console.log('✓ Credit limit validated');
    }
    
    // ❌ PROBLEMA: Log com dados completos do resultado
    console.log('========================================');
    console.log('Order validation COMPLETED SUCCESSFULLY');
    console.log('Customer:', customer.name, '-', customer.email);
    console.log('Items count:', validatedItems.length);
    console.log('Total amount: R$', totalAmount.toFixed(2));
    console.log('Payment method:', paymentMethod);
    console.log('Validated at:', new Date().toISOString());
    console.log('Full validated items:', JSON.stringify(validatedItems, null, 2));
    console.log('========================================');
    
    return {
      customer,
      items: validatedItems,
      totalAmount,
      paymentMethod
    };
  }
  
  // ❌ PROBLEMA: Outra função com logging inconsistente
  async validateStockAvailability(productId: number, quantity: number): Promise<boolean> {
    console.log('>>> Checking stock for product', productId);
    
    const product = await productsTable.findById(productId);
    
    if (!product) {
      console.log('!!! Product not found:', productId);
      return false;
    }
    
    console.log('Product:', product.name);
    console.log('Available stock:', product.stock);
    console.log('Requested:', quantity);
    
    const available = product.stock >= quantity;
    
    if (available) {
      console.log('>>> Stock check PASSED');
    } else {
      console.log('!!! Stock check FAILED');
      console.log('Shortage:', quantity - product.stock);
    }
    
    return available;
  }
  
  // ❌ PROBLEMA: Formato de log completamente diferente
  async logOrderAttempt(customerId: number, result: string, error?: string): Promise<void> {
    const timestamp = Date.now();
    const date = new Date().toISOString();
    
    // ❌ PROBLEMA: Mix de formatos
    console.log(`[${timestamp}] Order attempt`);
    console.log('Customer ID: ' + customerId);
    console.log('Result:', result);
    
    if (error) {
      console.log('Error details:', error);
    }
    
    // ❌ PROBLEMA: Log direto no banco (side effect!)
    await sqldb.execute(
      'INSERT INTO order_attempt_logs (customer_id, result, error_message, created_at) VALUES (?, ?, ?, ?)',
      [customerId, result, error || null, date]
    );
    
    console.log('Order attempt logged to database');
  }
}
