// ============================================
// ❌ ANTIPATTERN: Business Logic with Hardcoded Dependencies
// Problema: new hardcoded, sem abstrações/interfaces
// ============================================

import axios from 'axios';
import { sqldb } from '../../../common/db/connection';
import { emailService } from '../../order-service/services/emailService';

// ❌ PROBLEMA: Lógica de negócio sem abstrações

export class CustomerService {
  
  // ❌ PROBLEMA: new hardcoded - sem Dependency Injection
  
  async registerCustomer(data: any) {
    // ❌ PROBLEMA: Validações duplicadas - mesmas regras em vários lugares
    
    // Validação de nome
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Name is required');
    }
    
    if (data.name.length < 3) {
      throw new Error('Name must be at least 3 characters');
    }
    
    if (data.name.length > 100) {
      throw new Error('Name must be at most 100 characters');
    }
    
    // ❌ PROBLEMA: Validação de email - REGEX DIFERENTE em cada lugar!
    if (!data.email || data.email.trim().length === 0) {
      throw new Error('Email is required');
    }
    
    // Regex simples aqui
    if (!data.email.includes('@')) {
      throw new Error('Invalid email');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error('Invalid email format');
    }
    
    // ❌ PROBLEMA: Validação de CPF duplicada
    if (!data.cpf) {
      throw new Error('CPF is required');
    }
    
    // Remove formatação
    const cpfNumbers = data.cpf.replace(/\D/g, '');
    
    if (cpfNumbers.length !== 11) {
      throw new Error('CPF must have 11 digits');
    }
    
    // ❌ Validação de CPF repetida (mesma lógica que no middleware)
    if (/^(\d)\1{10}$/.test(cpfNumbers)) {
      throw new Error('Invalid CPF: all digits are the same');
    }
    
    // ❌ PROBLEMA: Validação de telefone
    if (!data.phone) {
      throw new Error('Phone is required');
    }
    
    const phoneNumbers = data.phone.replace(/\D/g, '');
    
    if (phoneNumbers.length < 10 || phoneNumbers.length > 11) {
      throw new Error('Phone must have 10 or 11 digits');
    }
    
    // ❌ PROBLEMA: Validação de CEP
    if (!data.zipCode) {
      throw new Error('ZIP code is required');
    }
    
    const zipCodeNumbers = data.zipCode.replace(/\D/g, '');
    
    if (zipCodeNumbers.length !== 8) {
      throw new Error('ZIP code must have 8 digits');
    }
    
    // ❌ PROBLEMA: Chamada direta ao axios
    const viaCepResponse = await axios.get(`https://viacep.com.br/ws/${data.zipCode}/json/`);
    
    if (viaCepResponse.data.erro) {
      throw new Error('Invalid ZIP code');
    }
    
    const addressData = viaCepResponse.data;
    
    // ❌ PROBLEMA: Acesso direto ao banco
    const existingCustomer = await sqldb.queryOne(
      'SELECT id FROM customers WHERE email = $1 OR document = $2',
      [data.email, data.cpf]
    );
    
    if (existingCustomer) {
      throw new Error('Customer already exists');
    }
    
    const result = await sqldb.query(
      `INSERT INTO customers (name, email, document, phone, zip_code, address, city, state, active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING id`,
      [
        data.name,
        data.email,
        data.cpf,
        data.phone,
        data.zipCode,
        addressData.logradouro,
        addressData.localidade,
        addressData.uf
      ]
    );
    const customerId = result[0]?.id;
    
    // ❌ PROBLEMA: Envio de email direto no service
    try {
      await emailService.send(
        data.email,
        'Welcome to ShopHub!',
        `<h1>Welcome ${data.name}!</h1><p>Your account has been created.</p>`
      );
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }
    
    // ❌ PROBLEMA: Log direto
    console.log('Customer registered:', customerId);
    
    return customerId;
  }
  
  async updateCreditLimit(customerId: number, newLimit: number) {
    // ❌ PROBLEMA: Lógica de domínio complexa espalhada em service de aplicação
    // Deveria estar em Domain Service especializado
    
    const customer: any = await sqldb.queryOne(
      'SELECT * FROM customers WHERE id = $1',
      [customerId]
    );
    
    if (!customer) {
      throw new Error('Customer not found');
    }
    
    // ❌ Regra 1: Consulta Serasa para score de crédito
    const serasa = new SerasaClient();
    const creditScore = await serasa.getCreditScore(customerId);
    
    console.log('Credit score retrieved:', creditScore);
    
    if (creditScore < 600) {
      throw new Error('Credit score too low for credit limit increase');
    }
    
    // ❌ Regra 2: Calcula limite baseado em score E histórico de compras
    const purchaseHistory: any = await sqldb.query(
      `SELECT 
        SUM(total) as total_purchases,
        COUNT(*) as order_count,
        AVG(total) as avg_order_value,
        MAX(total) as max_order_value
       FROM orders 
       WHERE customer_id = $1 AND status = 'CONFIRMED' AND payment_status = 'PAID'`,
      [customerId]
    );
    
    const totalPurchases = parseFloat(purchaseHistory[0]?.total_purchases || 0);
    const orderCount = parseInt(purchaseHistory[0]?.order_count || 0);
    const avgOrderValue = parseFloat(purchaseHistory[0]?.avg_order_value || 0);
    
    // ❌ Regra 3: Limite base por score
    let baseLimit = this.calculateMaxLimit(creditScore);
    
    // ❌ Regra 4: Multiplica por fator de histórico
    let historyMultiplier = 1.0;
    if (totalPurchases > 50000) {
      historyMultiplier = 2.0; // Cliente platinum
    } else if (totalPurchases > 20000) {
      historyMultiplier = 1.7; // Cliente gold
    } else if (totalPurchases > 10000) {
      historyMultiplier = 1.5; // Cliente silver
    } else if (totalPurchases > 5000) {
      historyMultiplier = 1.3; // Cliente bronze
    } else if (orderCount >= 10) {
      historyMultiplier = 1.2; // Cliente frequente
    }
    
    // ❌ Regra 5: Ajusta por ticket médio
    if (avgOrderValue > 1000) {
      historyMultiplier += 0.2;
    } else if (avgOrderValue > 500) {
      historyMultiplier += 0.1;
    }
    
    const maxAllowedLimit = Math.floor(baseLimit * historyMultiplier);
    
    console.log('Credit limit calculation:', {
      creditScore,
      baseLimit,
      totalPurchases,
      orderCount,
      avgOrderValue,
      historyMultiplier,
      maxAllowedLimit
    });
    
    // ❌ Regra 6: Valida se novo limite não excede máximo
    if (newLimit > maxAllowedLimit) {
      throw new Error(`Maximum allowed limit is R$ ${maxAllowedLimit.toFixed(2)}. Based on credit score (${creditScore}) and purchase history.`);
    }
    
    // ❌ Regra 7: Valida aumento máximo por vez (50%)
    const currentLimit = parseFloat(customer.credit_limit || 0);
    const maxIncrease = currentLimit * 1.5;
    
    if (newLimit > maxIncrease && currentLimit > 0) {
      throw new Error(`Maximum increase is 50% per request. Current: R$ ${currentLimit.toFixed(2)}, Max allowed: R$ ${maxIncrease.toFixed(2)}`);
    }
    
    // ❌ Regra 8: Verifica pagamentos atrasados
    const latePayments: any = await sqldb.query(
      `SELECT COUNT(*) as late_count FROM orders 
       WHERE customer_id = $1 AND payment_status = 'OVERDUE'`,
      [customerId]
    );
    
    if (latePayments[0].late_count > 0) {
      throw new Error('Cannot increase credit limit with overdue payments');
    }
    
    // ❌ Regra 9: Verifica chargebacks
    const chargebacks: any = await sqldb.query(
      `SELECT COUNT(*) as chargeback_count FROM orders 
       WHERE customer_id = $1 AND payment_status = 'CHARGEBACK'`,
      [customerId]
    );
    
    if (chargebacks[0].chargeback_count > 0) {
      throw new Error('Cannot increase credit limit with chargeback history');
    }
    
    // ❌ Atualiza limite
    await sqldb.execute(
      'UPDATE customers SET credit_limit = $1, updated_at = NOW() WHERE id = $2',
      [newLimit, customerId]
    );
    
    // ❌ Registra histórico
    await sqldb.execute(
      `INSERT INTO credit_limit_history (customer_id, old_limit, new_limit, credit_score, reason) 
       VALUES (?, ?, ?, ?, ?)`,
      [customerId, currentLimit, newLimit, creditScore, 'Manual update']
    );
    
    console.log('Credit limit updated for customer:', customerId, 'from', currentLimit, 'to', newLimit);
  }
  
  private calculateMaxLimit(creditScore: number): number {
    if (creditScore >= 800) return 10000;
    if (creditScore >= 700) return 5000;
    if (creditScore >= 600) return 2000;
    return 0;
  }
  
  // ❌ PROBLEMA: Lógica de promoção VIP espalhada (deveria estar em Domain Service)
  async promoteToVip(customerId: number): Promise<boolean> {
    const customer: any = await sqldb.queryOne(
      'SELECT * FROM customers WHERE id = $1',
      [customerId]
    );
    
    if (!customer) {
      throw new Error('Customer not found');
    }
    
    if (customer.vip_status === 'GOLD') {
      return false; // Já é VIP Gold (máximo)
    }
    
    // ❌ Regra complexa: Valida critérios para VIP
    const stats: any = await sqldb.queryOne(
      `SELECT 
        SUM(total) as total_spent,
        COUNT(*) as order_count,
        AVG(total) as avg_order,
        EXTRACT(DAY FROM (NOW() - MIN(created_at))) as days_as_customer,
        COUNT(DISTINCT DATE_TRUNC('month', created_at)) as active_months
       FROM orders 
       WHERE customer_id = $1 AND status = 'CONFIRMED'`,
      [customerId]
    );
    
    const totalSpent = parseFloat(stats.total_spent || 0);
    const orderCount = parseInt(stats.order_count || 0);
    const avgOrder = parseFloat(stats.avg_order || 0);
    const daysAsCustomer = parseInt(stats.days_as_customer || 0);
    const activeMonths = parseInt(stats.active_months || 0);
    
    console.log('VIP promotion evaluation:', stats);
    
    // ❌ Critérios para Bronze
    const qualifiesForBronze = (
      totalSpent >= 2000 && 
      orderCount >= 5 && 
      daysAsCustomer >= 30
    );
    
    // ❌ Critérios para Silver
    const qualifiesForSilver = (
      totalSpent >= 5000 && 
      orderCount >= 10 && 
      activeMonths >= 3 &&
      avgOrder >= 300
    );
    
    // ❌ Critérios para Gold
    const qualifiesForGold = (
      totalSpent >= 10000 && 
      orderCount >= 20 && 
      activeMonths >= 6 &&
      avgOrder >= 500
    );
    
    let newVipStatus = customer.vip_status || 'NONE';
    let creditLimitBonus = 0;
    
    if (qualifiesForGold) {
      newVipStatus = 'GOLD';
      creditLimitBonus = 2000;
    } else if (qualifiesForSilver) {
      newVipStatus = 'SILVER';
      creditLimitBonus = 1000;
    } else if (qualifiesForBronze) {
      newVipStatus = 'BRONZE';
      creditLimitBonus = 500;
    } else {
      return false; // Não qualifica para VIP
    }
    
    // ❌ Atualiza status VIP
    await sqldb.execute(
      'UPDATE customers SET vip_status = $1, credit_limit = credit_limit + $2 WHERE id = $3',
      [newVipStatus, creditLimitBonus, customerId]
    );
    
    // ❌ Envia email de promoção
    try {
      const customer: any = await sqldb.queryOne('SELECT email FROM customers WHERE id = $1', [customerId]);
      if (customer) {
        await emailService.send(
          customer.email,
          `Congratulations! You are now ${newVipStatus} VIP`,
          `
            <h1>Welcome to ${newVipStatus} VIP Club!</h1>
            <p>You've earned exclusive benefits:</p>
            <ul>
              <li>Credit limit increased by R$ ${creditLimitBonus}</li>
              <li>Priority support</li>
              <li>Exclusive discounts</li>
            </ul>
          `
        );
      }
    } catch (emailError) {
      console.error('Failed to send VIP promotion email:', emailError);
    }
    
    console.log('Customer promoted to VIP:', customerId, newVipStatus);
    return true;
  }
}

// ❌ PROBLEMA: Cliente de API externa sem interface

class SerasaClient {
  async getCreditScore(customerId: number): Promise<number> {
    // ❌ PROBLEMA: axios hardcoded
    const response = await axios.get(`https://api.serasa.com.br/score/${customerId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.SERASA_API_KEY}`
      }
    });
    
    return response.data.score;
  }
}

// ❌ PROBLEMA: Event emitter sem abstração

export class CustomerEventEmitter {
    
  // ❌ PROBLEMA: Webhook hardcoded
  async notifyCustomerCreated(customerId: number) {
    // NOTE: Disabled for testing - demonstrates hard-coded external dependencies
    // await axios.post('https://analytics.shophub.com/events', {
    //   event: 'customer_created',
    //   customerId: customerId,
    //   timestamp: new Date()
    // }, {
    //   headers: {
    //     'X-API-Key': process.env.ANALYTICS_API_KEY
    //   }
    // });
    
    console.log('Event sent: customer_created');
  }
  
  async notifyCreditLimitChanged(customerId: number, newLimit: number) {
    // NOTE: Disabled for testing - demonstrates hard-coded external dependencies
    // await axios.post('https://analytics.shophub.com/events', {
    //   event: 'credit_limit_changed',
    //   customerId: customerId,
    //   newLimit: newLimit,
    //   timestamp: new Date()
    // }, {
    //   headers: {
    //     'X-API-Key': process.env.ANALYTICS_API_KEY
    //   }
    // });
    
    console.log('Event sent: credit_limit_changed');
  }
}
