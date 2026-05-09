// ============================================
// ❌ ANTIPATTERN: Global Database Connection
// Problema: Pool compartilhado, sem abstração
// ============================================

import { Pool } from 'pg';

// ❌ PROBLEMA: Pool global exportado diretamente
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'shophub_ecommerce',
  max: 1, // Force single connection to avoid cache issues
  idleTimeoutMillis: 100, // Short timeout
  connectionTimeoutMillis: 2000
});

// ❌ PROBLEMA: Export global usado por TUDO
// ❌ PROBLEMA: Métodos de conveniência misturados com conexão
export const sqldb = {
  async query(sql: string, params?: any[]): Promise<any[]> {
    const result = await pool.query(sql, params);
    return result.rows;
  },

  async queryOne(sql: string, params?: any[]): Promise<any | null> {
    const result = await pool.query(sql, params);
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  async execute(sql: string, params?: any[]): Promise<number> {
    const result = await pool.query(sql, params);
    return result.rowCount || 0;
  },

// ❌ PROBLEMA: Queries específicas exportadas diretamente
// Viola Single Responsibility - módulo de conexão não deveria ter queries

  // ❌ PROBLEMA: Helper queries misturadas (deveria estar em Repository)
  async getCustomerById(id: number): Promise<any> {
    return this.queryOne('SELECT * FROM customers WHERE id = $1', [id]);
  },

  async getProductById(id: number): Promise<any> {
    return this.queryOne('SELECT * FROM products WHERE id = $1', [id]);
  }
};

// ❌ PROBLEMA: Sem tratamento de erros adequado
// ❌ PROBLEMA: Sem logging
// ❌ PROBLEMA: Sem retry logic
// ❌ PROBLEMA: Sem pool monitoring
