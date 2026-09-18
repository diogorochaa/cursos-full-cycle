// ============================================
// ❌ ANTIPATTERN: MIDDLEWARE COM ACOPLAMENTO
// Problema: JWT hardcoded via variável de ambiente
// ============================================

import express from 'express';
import jwt from 'jsonwebtoken';

// ❌ PROBLEMA: Acoplamento direto à variável de ambiente
// Impossível trocar estratégia de auth sem refatorar
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// ❌ PROBLEMA: Tipos de role hardcoded aqui (duplicado do express.d.ts)
type UserRole = 'ADMIN' | 'USER' | 'SALES';

interface JWTPayload {
  userId: number;
  email: string;
  name: string;
  role: UserRole;
}

// ❌ PROBLEMA: Mapeamento de permissões hardcoded no middleware
// Lógica de autorização espalhada e duplicada
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  'ADMIN': [
    'manage_products', 'create_product', 'update_product', 'delete_product',
    'manage_customers', 'create_customer', 'update_customer', 'delete_customer',
    'manage_orders', 'create_order', 'update_order', 'cancel_order', 'view_all_orders',
    'view_reports', 'manage_users', 'view_categories', 'manage_categories'
  ],
  'SALES': [
    'manage_customers', 'create_customer', 'update_customer',
    'create_order', 'update_order', 'view_all_orders',
    'view_reports', 'view_categories'
  ],
  'USER': [
    'create_order', 'view_own_orders', 'cancel_own_order',
    'view_products', 'view_categories', 'view_own_profile', 'update_own_profile'
  ]
};

// ❌ PROBLEMA: Função helper inline para verificar permissão
// Lógica de autorização acoplada ao middleware
function hasPermission(role: UserRole, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

// ❌ PROBLEMA: Middleware acoplado ao JWT
// Não há abstração - usa jwt.verify diretamente
export function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  try {
    // ❌ PROBLEMA: Dependência direta da biblioteca jwt
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // ❌ PROBLEMA: Popula req.user diretamente
    // Controller fica acoplado a essa estrutura
    (req as any).user = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      // ❌ PROBLEMA: Permissions calculadas em runtime a cada request
      permissions: ROLE_PERMISSIONS[decoded.role] || []
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ❌ PROBLEMA: Verificação de role inline
// Lógica de autorização espalhada
export function requireRole(role: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!(req as any).user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // ❌ PROBLEMA: String comparison inline
    // Sem abstração de permissões
    if ((req as any).user.role !== role) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

// ❌ PROBLEMA: Múltiplas funções de autorização sem abstração
// Cada uma verifica de forma diferente
export function requirePermission(permission: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // ❌ PROBLEMA: Verifica permissão inline usando mapa global
    if (!hasPermission(user.role, permission)) {
      console.log(`Authorization failed: user ${user.email} (${user.role}) lacks permission ${permission}`);
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permission,
        userRole: user.role // ❌ PROBLEMA: Expõe role do usuário na resposta
      });
    }
    
    next();
  };
}

// ❌ PROBLEMA: Middleware para verificar múltiplas roles (OR)
// Lógica inline duplicada
export function requireAnyRole(...roles: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // ❌ PROBLEMA: Verificação com includes inline
    if (!roles.includes(user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        allowedRoles: roles // ❌ PROBLEMA: Expõe roles permitidas!
      });
    }
    
    next();
  };
}

// ❌ PROBLEMA: Verificação de ownership inline para recursos
// Lógica de domínio misturada com autorização
export function requireOwnershipOrAdmin(resourceType: 'order' | 'customer') {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // ❌ PROBLEMA: Admin bypassa tudo (sem granularidade)
    if (user.role === 'ADMIN') {
      return next();
    }
    
    // ❌ PROBLEMA: SALES pode ver tudo de orders/customers
    if (user.role === 'SALES' && (resourceType === 'order' || resourceType === 'customer')) {
      return next();
    }
    
    // ❌ PROBLEMA: Verificação de ownership hardcoded aqui
    // Deveria estar em um domain service
    const resourceId = parseInt(req.params.id);
    
    if (resourceType === 'order') {
      // ❌ PROBLEMA: Import dinâmico do banco no middleware!
      const { sqldb } = await import('../db/connection');
      const order: any = await sqldb.queryOne(
        'SELECT customer_id, created_by FROM orders WHERE id = $1',
        [resourceId]
      );
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // ❌ PROBLEMA: Verifica se user é o customer OU criador do pedido
      // Lógica de negócio no middleware
      if (order.created_by !== user.userId && order.customer_id !== user.userId) {
        return res.status(403).json({ error: 'Access denied: not your order' });
      }
    }
    
    if (resourceType === 'customer') {
      // ❌ PROBLEMA: USER só pode ver seu próprio perfil
      if (user.role === 'USER' && resourceId !== user.userId) {
        return res.status(403).json({ error: 'Access denied: not your profile' });
      }
    }
    
    next();
  };
}
