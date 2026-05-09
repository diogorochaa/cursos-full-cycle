// ============================================
// ❌ ANTIPATTERN: Queries diretas para clientes
// ============================================

import { sqldb } from '../connection';

export const customersTable = {
  async findById(id: number) {
    return sqldb.queryOne(
      'SELECT * FROM customers WHERE id = $1',
      [id]
    );
  },

  async findByEmail(email: string) {
    return sqldb.queryOne(
      'SELECT * FROM customers WHERE email = $1',
      [email]
    );
  },

  async findAll() {
    return sqldb.query(
      'SELECT * FROM customers ORDER BY name'
    );
  },

  async findActive() {
    return sqldb.query(
      'SELECT * FROM customers WHERE active = true ORDER BY name'
    );
  },

  // ❌ PROBLEMA: Validação inline
  async create(customerData: any) {
    // ❌ Validação básica aqui (deveria ser no domínio)
    if (!customerData.email || !customerData.email.includes('@')) {
      throw new Error('Invalid email');
    }

    // ❌ Verifica duplicata aqui (deveria ser em use case)
    const existing = await this.findByEmail(customerData.email);
    if (existing) {
      throw new Error('Email already exists');
    }

    const result: any = await sqldb.execute(
      `INSERT INTO customers
       (name, email, phone, document, zip_code, address, city, state, credit_limit, trust_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        customerData.name,
        customerData.email,
        customerData.phone,
        customerData.document,
        customerData.zip_code,
        customerData.address,
        customerData.city,
        customerData.state,
        customerData.credit_limit || 0,
        customerData.trust_score || 5
      ]
    );

    return result.insertId;
  },

  async update(id: number, customerData: any) {
    await sqldb.execute(
      `UPDATE customers SET
       name = $1, phone = $2, zip_code = $3, address = $4, city = $5, state = $6
       WHERE id = $7`,
      [
        customerData.name,
        customerData.phone,
        customerData.zip_code,
        customerData.address,
        customerData.city,
        customerData.state,
        id
      ]
    );
  },

  // ❌ PROBLEMA: Soft delete sem auditoria
  async deactivate(id: number) {
    await sqldb.execute(
      'UPDATE customers SET active = false WHERE id = $1',
      [id]
    );
  },

  // ❌ PROBLEMA: Lógica de negócio aqui
  async hasAvailableCredit(customerId: number, amount: number): Promise<boolean> {
    const customer: any = await this.findById(customerId);
    
    if (!customer) return false;
    
    // ❌ PROBLEMA: Lógica de negócio no data layer
    return customer.credit_limit >= amount;
  },
  
  // ❌ PROBLEMA: Query gigante com SELECT * e joins complexos
  async getCustomerFullProfile(customerId: number, options: any = {}): Promise<any> {
    // ❌ PROBLEMA: SELECT * de múltiplas tabelas
    let sql = 'SELECT * FROM customers c ';
    
    // ❌ PROBLEMA: Joins sempre executados (mesmo sem necessidade)
    if (options.includeOrders || options.includeAll) {
      sql += 'LEFT JOIN orders o ON c.id = o.customer_id ';
    }
    
    if (options.includeOrderItems || options.includeAll) {
      sql += 'LEFT JOIN order_items oi ON o.id = oi.order_id ';
    }
    
    if (options.includeProducts || options.includeAll) {
      sql += 'LEFT JOIN products p ON oi.product_id = p.id ';
    }
    
    if (options.includePayments || options.includeAll) {
      sql += 'LEFT JOIN payments pay ON o.id = pay.order_id ';
    }
    
    if (options.includeAddresses || options.includeAll) {
      sql += 'LEFT JOIN customer_addresses ca ON c.id = ca.customer_id ';
    }
    
    sql += 'WHERE c.id = ' + customerId + ' '; // ❌ SQL Injection!
    
    // ❌ PROBLEMA: Filtros adicionais concatenados
    if (options.onlyActiveOrders) {
      sql += "AND o.status IN ('PENDING', 'PROCESSING', 'SHIPPED') ";
    }
    
    if (options.minOrderValue) {
      sql += 'AND o.total >= ' + options.minOrderValue + ' ';
    }
    
    console.log('Customer profile query:', sql);
    
    return sqldb.query(sql);
  },
  
  // ❌ PROBLEMA: Busca avançada com concatenação massiva
  async searchCustomers(criteria: any): Promise<any[]> {
    let sql = 'SELECT * FROM customers c ';
    let params: any[] = [];
    let whereClauses: string[] = [];
    
    // ❌ PROBLEMA: Array de WHEREs concatenado depois
    if (criteria.name) {
      whereClauses.push("c.name LIKE '%" + criteria.name + "%'"); // ❌ Injection!
    }
    
    if (criteria.email) {
      whereClauses.push("c.email LIKE '%" + criteria.email + "%'");
    }
    
    if (criteria.cpf) {
      whereClauses.push("c.cpf = '" + criteria.cpf + "'");
    }
    
    if (criteria.city) {
      whereClauses.push("c.city = '" + criteria.city + "'");
    }
    
    if (criteria.state) {
      whereClauses.push("c.state = '" + criteria.state + "'");
    }
    
    if (criteria.minCreditLimit) {
      whereClauses.push('c.credit_limit >= ' + criteria.minCreditLimit);
    }
    
    if (criteria.hasOrders) {
      sql += 'INNER JOIN orders o ON c.id = o.customer_id ';
    }
    
    // ❌ PROBLEMA: Junta tudo com AND/OR baseado em flag
    if (whereClauses.length > 0) {
      if (criteria.matchAll) {
        sql += 'WHERE ' + whereClauses.join(' AND ');
      } else {
        sql += 'WHERE ' + whereClauses.join(' OR ');
      }
    }
    
    // ❌ PROBLEMA: Ordenação dinâmica vulnerável
    if (criteria.sortBy) {
      sql += ' ORDER BY c.' + criteria.sortBy; // ❌ Injection!
      
      if (criteria.sortOrder === 'DESC') {
        sql += ' DESC';
      } else {
        sql += ' ASC';
      }
    }
    
    // ❌ PROBLEMA: Paginação concatenada
    if (criteria.page && criteria.pageSize) {
      const offset = (criteria.page - 1) * criteria.pageSize;
      sql += ' LIMIT ' + criteria.pageSize + ' OFFSET ' + offset;
    }
    
    console.log('Search SQL:', sql);
    
    return sqldb.query(sql, params);
  }
};
