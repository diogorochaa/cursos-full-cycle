// ============================================
// ❌ ANTIPATTERN: Queries diretas para produtos
// ============================================

import { sqldb } from '../connection';

export const productsTable = {
  async findById(id: number) {
    return sqldb.queryOne(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );
  },

  // ❌ PROBLEMA: N+1 query potencial
  async findByIds(ids: number[]) {
    const products = [];
    for (const id of ids) {
      const product = await this.findById(id);
      if (product) {
        products.push(product);
      }
    }
    return products;
  },

  async findByCategory(categoryId: number) {
    return sqldb.query(
      'SELECT * FROM products WHERE category_id = $1 AND active = true',
      [categoryId]
    );
  },

  async findActive() {
    return sqldb.query(
      'SELECT * FROM products WHERE active = true ORDER BY name'
    );
  },

  // ❌ PROBLEMA: Lógica de negócio no módulo de dados
  async decreaseStock(productId: number, quantity: number) {
    // ❌ Sem validação se tem estoque
    await sqldb.execute(
      'UPDATE products SET stock = stock - $1 WHERE id = $2',
      [quantity, productId]
    );
  },

  async increaseStock(productId: number, quantity: number): Promise<void> {
    await sqldb.execute(
      'UPDATE products SET stock = stock + $1 WHERE id = $2',
      [quantity, productId]
    );
  },
  
  // ❌ PROBLEMA: Query complexa com SELECT * e joins dinâmicos
  async getProductsWithDetails(filters: any): Promise<any[]> {
    // ❌ PROBLEMA: SELECT * trazendo tudo
    let sql = 'SELECT * FROM products p ';
    let params: any[] = [];
    
    // ❌ PROBLEMA: Joins concatenados baseado em flags
    if (filters.includeCategory) {
      sql += 'LEFT JOIN categories c ON p.category_id = c.id ';
    }
    
    if (filters.includeStock) {
      sql += 'LEFT JOIN product_stock ps ON p.id = ps.product_id ';
    }
    
    if (filters.includePriceHistory) {
      sql += 'LEFT JOIN price_history ph ON p.id = ph.product_id ';
    }
    
    if (filters.includeSupplier) {
      sql += 'LEFT JOIN suppliers s ON p.supplier_id = s.id ';
    }
    
    sql += 'WHERE p.deleted_at IS NULL '; // ❌ Soft delete no SQL
    
    // ❌ PROBLEMA: Filtros com concatenação de strings
    if (filters.categoryId) {
      sql += 'AND p.category_id = ' + filters.categoryId + ' '; // ❌ SQL Injection!
    }
    
    if (filters.search) {
      // ❌ PROBLEMA: LIKE com concatenação vulnerável
      sql += "AND (p.name LIKE '%" + filters.search + "%' ";
      sql += "OR p.description LIKE '%" + filters.search + "%') ";
    }
    
    if (filters.minPrice) {
      sql += 'AND p.price >= $' + (params.length + 1) + ' ';
      params.push(filters.minPrice);
    }

    if (filters.maxPrice) {
      sql += 'AND p.price <= $' + (params.length + 1) + ' ';
      params.push(filters.maxPrice);
    }

    if (filters.onlyActive) {
      sql += 'AND p.active = true ';
    }
    
    if (filters.onlyInStock) {
      sql += 'AND p.stock > 0 ';
    }
    
    // ❌ PROBLEMA: GROUP BY concatenado
    if (filters.groupBy) {
      sql += 'GROUP BY ' + filters.groupBy + ' '; // ❌ Injection!
    }
    
    // ❌ PROBLEMA: HAVING também concatenado
    if (filters.havingCount) {
      sql += 'HAVING COUNT(*) > ' + filters.havingCount + ' ';
    }
    
    console.log('Dynamic SQL:', sql, params);
    
    return sqldb.query(sql, params);
  },
  
  // ❌ PROBLEMA: Relatório com SQL mega concatenado
  async getProductReport(reportType: string, filters: any): Promise<any[]> {
    let sql = '';
    let params: any[] = [];
    
    // ❌ PROBLEMA: IF gigante construindo queries diferentes
    if (reportType === 'sales') {
      sql = 'SELECT * FROM products p ';
      sql += 'LEFT JOIN order_items oi ON p.id = oi.product_id ';
      sql += 'LEFT JOIN orders o ON oi.order_id = o.id ';
      sql += 'WHERE o.status = \'COMPLETED\' ';
      
      if (filters.dateFrom) {
        sql += 'AND o.created_at >= \'' + filters.dateFrom + '\' ';
      }

      if (filters.dateTo) {
        sql += 'AND o.created_at <= \'' + filters.dateTo + '\' ';
      }
      
      sql += 'GROUP BY p.id ';
      sql += 'ORDER BY SUM(oi.quantity) DESC';
      
    } else if (reportType === 'inventory') {
      sql = 'SELECT * FROM products p ';
      sql += 'WHERE p.stock < ' + (filters.minStock || 10) + ' ';
      sql += 'ORDER BY p.stock ASC';
      
    } else if (reportType === 'profit') {
      sql = 'SELECT p.*, (p.price - p.cost) as profit FROM products p ';
      sql += 'WHERE p.cost IS NOT NULL ';
      
      if (filters.categoryId) {
        sql += 'AND p.category_id IN (' + filters.categoryId.join(',') + ') ';
      }
      
      sql += 'ORDER BY profit DESC';
    }
    
    console.log('Report SQL:', sql);
    
    return sqldb.query(sql, params);
  },

  // ❌ PROBLEMA: Validação misturada com query
  async checkStock(productId: number, requestedQuantity: number): Promise<boolean> {
    const product: any = await this.findById(productId);
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    if (!product.active) {
      throw new Error('Product is not active');
    }
    
    return product.stock >= requestedQuantity;
  },

  async updatePrice(productId: number, newPrice: number) {
    // ❌ Sem validação de preço negativo
    await sqldb.execute(
      'UPDATE products SET price = $1 WHERE id = $2',
      [newPrice, productId]
    );
  }
};
