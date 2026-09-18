// ============================================
// ❌ ANTIPATTERN: TYPE POLLUTION
// Problema: Poluição de tipos globais do Express
// ============================================

// ❌ PROBLEMA: Modificação global de tipos do framework
// Acopla toda aplicação ao conceito de "session"
// Torna impossível trocar Express sem refatorar todo código

// ❌ PROBLEMA: Enum de roles hardcoded no tipo global
// Qualquer mudança aqui afeta toda a aplicação
export type UserRole = 'ADMIN' | 'USER' | 'SALES';

// ❌ PROBLEMA: Permissões definidas em tipo global (acoplamento)
export type Permission = 'manage_products' | 'manage_customers' | 'manage_orders' | 'view_reports' | 'create_orders';

declare namespace Express {
  export interface Request {
    session?: {
      user?: {
        id: number;
        email: string;
        name: string;
        role: UserRole;
      };
    };
    // ❌ PROBLEMA: User diretamente no request (polui interface)
    user?: {
      userId: number;
      email: string;
      name: string;
      role: UserRole;
      permissions?: Permission[];
    };
  }
}
