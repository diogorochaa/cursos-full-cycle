# 🔍 Mapa de Problemas Arquiteturais - ShopHub API

**Data de Criação**: 4 de Dezembro de 2025  
**Total de Problemas**: 29  
**Documentação**: Completa

---

## 🔴🔵 FUNDACIONAIS (8 problemas)

Estes são problemas de arquitetura de ordem superior. Sua existência permite que TODOS os outros problemas (críticos, altos e médios) proliferem. Resolvê-los elimina as raízes dos 29 problemas anteriores.

### F1: Sem Separação entre Camada de Apresentação e Lógica de Negócio
- **Locações**: Todos os endpoints em app.ts
- **Problema**: Controllers fazem validações de domínio, aplicam regras de negócio, formatam resposta
- **Exemplo**:
  ```typescript
  // No mesmo handler: validação + regra de negócio + formatação
  if (newLimit > 20000 && !req.body.approvedBy) { ... }  // regra
  if (newLimit < minLimit) { ... }  // regra
  response.document = customer.document?.replace(...)  // formatação
  ```
- **Impacto**: Impossível testar lógica sem HTTP; impossível reutilizar em outros contextos
- **Raiz de**: A3, A5, A6, A7, A8, M4, M6, M7
- **Solução**: Extrair lógica de negócio para camada intermediária

### F2: Camada de Dados Acoplada Diretamente à Apresentação
- **Locações**: 40+ pontos no app.ts com `sqldb.query()` direto
- **Problema**: SQL direto nos handlers HTTP
- **Impacto**: Migrar banco de dados quebra todas as rotas; impossível testar sem BD real
- **Raiz de**: A4, A9, A10, A11, A12, M1
- **Solução**: Abstrair acesso a dados em repositórios

### F3: Sem Camada de Negócio Entre HTTP e Banco
- **Problema**: Fluxo direto: Request HTTP → Query SQL → Response
- **Impacto**: Nenhum lugar para orquestrar, validar, aplicar regras de forma centralizada
- **Raiz de**: C1, C2, C3, A1, A3, A16
- **Solução**: Criar camada que receba dados, aplique lógica, retorne resultado

### F4: Regras de Negócio Espalhadas em Vários Lugares
- **Exemplo**: Limite de crédito definido em endpoint + service + middleware
- **Locações**: `/api/customers/:id/credit-limit`, `CustomerService`, `customerValidation.ts`
- **Impacto**: Mudar uma regra exige encontrar e atualizar N arquivos; inconsistência inevitável
- **Raiz de**: A1, A13, A16, M5, M6
- **Solução**: Centralizar regras em objetos de domínio

### F5: Entidades de Domínio Não Existem
- **Problema**: Customer, Order, Product são `any` vindo do BD, sem comportamento ou invariantes
- **Exemplo**: CPF é string (sem validação), Money é number (sem arredondamento), Credit é número simples (sem regras)
- **Impacto**: Lógica de validação espalhada em 5 lugares diferentes; impossível garantir que um domínio seja sempre válido
- **Raiz de**: A1, M2, M5, M8
- **Solução**: Criar classes de domínio com comportamento e validação encapsulada

### F6: Sem Abstrações para Dependências Externas
- **Problema**: Axios chamado diretamente para Stripe/SendGrid/ViaCEP
- **Locações**: `emailService`, `complete-flow` (pagamento), `axios` importado no topo
- **Impacto**: Código de negócio acoplado a provedores específicos; mudança de provedor quebra lógica
- **Raiz de**: A14
- **Solução**: Criar interfaces/adapters para esses serviços

### F7: Orquestração Sem Isolamento
- **Exemplo**: complete-flow faz validação + banco + pagamento + email + log tudo em uma função
- **Locações**: POST `/api/orders/complete-flow`
- **Impacto**: Impossível testar cada passo isoladamente; uma falha não sabe se vem de qual etapa
- **Raiz de**: C2, A4, A15
- **Solução**: Ter orquestrador que chame serviços isolados e compostos

### F8: Sem Limites Claros do Sistema
- **Problema**: Difícil dizer "aqui termina a aplicação de negócio e começa o mundo exterior"
- **Impacto**: Acoplamento total; não há "dentro" (lógica) e "fora" (tecnologia)
- **Raiz de**: Permite que todos os 29 problemas existam simultaneamente
- **Solução**: Definir portas (o que a app oferece) e adapters (como se conecta ao exterior)

---

## 🔴 CRÍTICOS (4 problemas)

### C1: SQL Injection em /api/reports/daily
- **Endpoint**: `GET /api/reports/daily`
- **Linha**: `app.ts:~1345`
- **Código**:
  ```typescript
  if (user.role === 'SALES') {
    ordersQuery += ` AND created_by = ${user.userId}`;  // ← Vulnerable!
  }
  ```
- **Risco**: Execução de SQL arbitrário
- **Impacto**: Deleção/modificação de dados
- **Prova de Conceito**:
  ```bash
  curl "http://localhost:3000/api/reports/daily?id=1' DROP TABLE users; --"
  ```
- **Solução**: Usar prepared statements

### C2: Orquestração sem Transação em /api/orders/complete-flow
- **Endpoint**: `POST /api/orders/complete-flow`
- **Linhas**: `app.ts:~340-500`
- **Problema**: 5 operações (validar, criar, pagar, emailar, log) sem transação
- **Risco**: Estado inconsistente do banco
- **Cenário de Falha**:
  ```
  Passo 1: ✅ Validar estoque
  Passo 2: ✅ Criar pedido (orderId = 42)
  Passo 3: ❌ Pagamento falha (timeout)
  Resultado: Pedido criado + estoque decrementado, mas sem pagamento!
  ```
- **Impacto**: Dados inconsistentes, cliente pagou mas sem confirmação
- **Solução**: Usar transação ACID

### C3: Acoplamento Direto entre Endpoints
- **Endpoint**: `POST /api/orders/complete-flow`
- **Linhas**: `app.ts:~390-425`
- **Problema**: Chama controller como função (não via HTTP)
- **Código**:
  ```typescript
  const mockReq = { body: req.body, user: req.user };
  const mockRes = { status: ... };  // ← Mock de req/res (anti-pattern!)
  await orderController.createOrder(mockReq, mockRes);
  ```
- **Risco**: Impossível testar isoladamente
- **Impacto**: Testes frágeis, refatoração difícil
- **Solução**: Extrair use case, chamar via injeção de dependência

### C4: JWT Secret Hardcoded
- **Locações**: 
  - `app.ts:87` (login endpoint)
  - `app.ts:133` (verify token middleware)
- **Código**:
  ```typescript
  process.env.JWT_SECRET || 'super-secret-key-123'  // ← Fallback inseguro!
  ```
- **Risco**: Segurança comprometida se env var não estiver definida
- **Impacto**: Token pode ser forjado
- **Solução**: Usar variável de ambiente obrigatória, sem fallback

---

## 🟠 ALTOS (16 problemas)

### A1: Validações Duplicadas
- **Endpoints Afetados**: 6
  - `/api/auth/register` (validação 1)
  - `/api/users` (validação 2)
  - `/api/customers` (validação 3)
  - Middleware (validação 4)
- **Problema**: Email validado com 4 regex diferentes!
  ```typescript
  // /api/auth/register
  if (!email.includes('@')) { ... }
  
  // /api/users
  if (!email.includes('@')) { ... }
  
  // /api/customers
  const emailPattern = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
  if (!emailPattern.test(email)) { ... }
  ```
- **Impacto**: Comportamento inconsistente
- **Solução**: Centralizar validação em classe reutilizável

### A2: Stack Traces Expostos em Erros
- **Endpoints Afetados**: 9+
- **Locações**:
  - `app.ts:119` (login error)
  - `app.ts:538` (products error)
  - `app.ts:607` (create product error)
  - Error handler global `app.ts:~1370`
- **Problema**:
  ```typescript
  catch (error: any) {
    res.status(500).json({
      error: 'Internal Server Error',
      stack: error.stack  // ← Expõe stack trace!
    });
  }
  ```
- **Risco**: Exposição de detalhes internos
- **Impacto**: Security risk, pode revelar estrutura do código
- **Solução**: Log stack trace localmente, retornar apenas message genérica

### A3: Lógica de Negócio Inline em Controllers
- **Endpoints Afetados**: 8
- **Exemplos**:
  - `/api/orders` - filtro por role inline
  - `/api/customers/:id/credit-limit` - regras de limite inline
  - `/api/products/:id/stock` - lógica de aumento/diminuição inline
- **Problema**:
  ```typescript
  app.get('/api/orders', authenticate, async (req, res) => {
    if (user.role === 'USER') {
      // 30 linhas de lógica de autorização inline!
    } else if (user.role === 'SALES') {
      // 20 linhas mais!
    }
  });
  ```
- **Impacto**: Controllers com 300+ linhas, difícil testar
- **Solução**: Extrair para use cases

### A4: Sem Transações no Banco
- **Endpoints Afetados**: 7
- **Exemplos**:
  - `/api/orders` - criar pedido + itens + atualizar estoque
  - `/api/customers/:id/credit-limit` - atualizar limite + log
  - `/api/orders/complete-flow` - múltiplas operações
- **Problema**: Operações que deveriam ser atômicas são feitas em sequência
- **Impacto**: Race conditions possíveis
- **Solução**: Implementar transaction wrapper

### A5: Formatos de Erro Inconsistentes
- **Endpoints Afetados**: 12+
- **Exemplos**:
  ```bash
  # GET /api/products
  {"error": "message"}
  
  # GET /api/products/:id
  {"status": "error", "message": "..."}
  
  # POST /api/customers
  {"error": "...", "errorCode": "DUPLICATE"}
  
  # PUT /api/customers/:id/credit-limit
  {"ok": false, "err": "...", "stack_trace": "..."}
  ```
- **Impacto**: Cliente deve tratar múltiplos formatos
- **Solução**: Centralizar error response format

### A6: Formatação Inline (CPF, Telefone, Preço)
- **Endpoints Afetados**: 4
- **Locações**:
  - `app.ts:~875` (customer create - CPF/telefone)
  - `app.ts:~514` (products list - preço)
  - `app.ts:~1002` (customers get - documento mascarado)
- **Problema**:
  ```typescript
  const formattedCpf = req.body.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  const formattedPhone = phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  price: `R$ ${parseFloat(product.price).toFixed(2).replace('.', ',')}`
  ```
- **Impacto**: Lógica de apresentação misturada com business logic
- **Solução**: Usar formatters/presenters

### A7: Autorização Espalhada
- **Endpoints Afetados**: 15
- **Locações**:
  - Middleware de autenticação
  - Handlers de endpoints
  - Serviços de negócio
- **Problema**:
  ```typescript
  // Middleware verifica role
  app.post('/api/customers', authenticate, requireAnyRole('ADMIN', 'SALES'), ...
  
  // Handler verifica role NOVAMENTE
  if (user.role !== 'ADMIN' && user.role !== 'SALES') { ... }
  
  // Serviço faz query ao banco
  if (user.role === 'SALES') {
    const customer = await findByIdAndSalesRep(id, user.userId);
  }
  ```
- **Impacto**: Difícil de manter, duplicação
- **Solução**: Centralizar em middleware reutilizável

### A8: Múltiplos Middlewares de Autorização em Cadeia
- **Endpoints Afetados**: 6
- **Exemplo**:
  ```typescript
  app.post('/api/orders', 
    authenticate,                    // Middleware 1
    requirePermission('create_order'),  // Middleware 2
    validateCreateOrder,             // Middleware 3
    validateCoupon,                  // Middleware 4
    orderController.createOrder      // Handler
  );
  ```
- **Impacto**: Difícil de entender fluxo de autorização
- **Solução**: Combinar middlewares relacionados

### A9: Queries SQL Dinâmicas Complexas
- **Endpoints Afetados**: 3
- **Locações**:
  - `common/db/tables/products.ts` - getProductsWithDetails
  - `common/db/tables/customers.ts` - searchCustomers
  - `app.ts:~1345` - /api/reports/daily
- **Problema**: Queries construídas com IF/ELSE/concatenação
- **Impacto**: SQL injection risk, difícil debugar
- **Solução**: Usar query builder ou ORM

### A10: N+1 Query Problems
- **Endpoints Afetados**: 4
- **Exemplos**:
  - `/api/categories/:id` - busca categoria + 50 produtos em loop
  - `/api/orders` - busca pedido + cliente para cada uma
  - `/api/profile` - busca user + customer em queries separadas
- **Impacto**: Performance ruim com muitos registros
- **Solução**: Usar JOIN ou eager loading

### A11: Sem Paginação
- **Endpoints Afetados**: 6
- **Problema**: LIMIT 100 hardcoded
  ```typescript
  'LIMIT 100'  // ← Onde está a paginação?
  ```
- **Impacto**: Não escalável para grandes datasets
- **Solução**: Implementar paginação com offset/limit

### A12: Soft Deletes sem Reversão
- **Endpoints Afetados**: 4
- **Problema**: Marca como inativo mas não permite reativar
  ```typescript
  UPDATE users SET active = false
  // Sem método para reverter!
  ```
- **Impacto**: Dados nunca são removidos, apenas ocultos
- **Solução**: Implementar soft delete com reversão

### A13: Regex Inconsistentes
- **Problema**: 4 validações de email diferentes
- **Impacto**: Usuário registrado em um lugar pode falhar em outro
- **Solução**: Centralizar em função única

### A14: Sem Abstração de APIs Externas
- **Afetados**: 3
- **Exemplos**: Stripe, SendGrid, ViaCEP
- **Problema**: Axios chamado diretamente
- **Solução**: Criar interfaces/adapters

### A15: Sem Transações - Complete Flow Crítico
- **Endpoint**: `/api/orders/complete-flow`
- **Impacto**: SEVERIDADE MÁXIMA
- **Solução**: Usar transaction wrapper

### A16: Lógica de Crédito Inline
- **Endpoint**: `/api/customers/:id/credit-limit`
- **Problema**: Regras de limite por categoria hardcoded
- **Solução**: Mover para entidade de domínio

---

## 🟡 MÉDIOS (9 problemas)

### M1: Sem Paginação Explícita
- **Endpoints**: GET /products, GET /customers, GET /orders
- **Severidade**: Média
- **Solução**: Implementar `page`, `limit`, `offset`

### M2: Validação Simples de Email
- **Endpoints**: /api/auth/register, /api/profile
- **Severidade**: Média
- **Problema**: Apenas valida `@`, não regex rigoroso
- **Solução**: Usar validação mais rigorosa

### M3: Sem Cache Headers
- **Endpoints**: GET /api/products, GET /api/categories
- **Severidade**: Média
- **Problema**: Sem ETags ou Cache-Control
- **Solução**: Adicionar headers de cache

### M4: Logging Disperso com console.log
- **Afetados**: 15+ endpoints
- **Severidade**: Média
- **Problema**: console.log espalhado, sem estrutura
- **Solução**: Usar logger estruturado

### M5: Sem Validação de CPF/CNPJ
- **Endpoints**: /api/customers
- **Severidade**: Média
- **Problema**: Aceita qualquer valor
- **Solução**: Implementar validação de CPF/CNPJ

### M6: Role Verificadas como Strings Mágicas
- **Afetados**: 10+ endpoints
- **Severidade**: Média
- **Problema**: `user.role === 'ADMIN'` sem enum
- **Solução**: Usar enum de roles

### M7: Sem Tipos para Extended Request
- **Endpoints**: Autenticação
- **Severidade**: Média
- **Problema**: `(req as any).user` sem tipagem
- **Solução**: Criar interface de Request tipado

### M8: Sem Validação de Valores Negativos
- **Endpoints**: /api/products/:id/stock, /api/customers/:id/credit-limit
- **Severidade**: Média
- **Problema**: Aceita quantidades negativas
- **Solução**: Validar min/max

### M9: Sem Auditoria de Quem Fez O Quê
- **Afetados**: Endpoints de alteração
- **Severidade**: Média
- **Problema**: Sem rastreamento de mudanças
- **Solução**: Implementar audit log com timestamp/user

---

## 📋 Tabela Consolidada

| # | Tipo | Problema | Endpoint | Impacto | Raiz de | Status |
|---|------|----------|----------|--------|--------|--------|
| F1 | FUNDAMENTAL | Sem Separação Apresentação/Negócio | Todos | Impossível testar/reutilizar | — | 🔴 Aberto |
| F2 | FUNDAMENTAL | Dados Acoplados à Apresentação | Todos | BD muda, quebra tudo | — | 🔴 Aberto |
| F3 | FUNDAMENTAL | Sem Camada de Negócio | Todos | Sem orquestração | — | 🔴 Aberto |
| F4 | FUNDAMENTAL | Regras Espalhadas | Vários | Manutenção complexa | — | 🔴 Aberto |
| F5 | FUNDAMENTAL | Sem Entidades de Domínio | Vários | Lógica espalhada | — | 🔴 Aberto |
| F6 | FUNDAMENTAL | Sem Abstrações Externas | Vários | Acoplamento a vendors | — | 🔴 Aberto |
| F7 | FUNDAMENTAL | Orquestração sem Isolamento | /orders/complete-flow | Impossível testar partes | — | 🔴 Aberto |
| F8 | FUNDAMENTAL | Sem Limites do Sistema | Todos | Tudo virou uma festa | — | 🔴 Aberto |
| C1 | CRÍTICO | SQL Injection | /reports/daily | Dados podem ser deletados | F3 | 🔴 Aberto |
| C2 | CRÍTICO | Sem Transação | /orders/complete-flow | Inconsistência de dados | F3, F7 | 🔴 Aberto |
| C3 | CRÍTICO | Acoplamento | /orders/complete-flow | Teste frágil | F3 | 🔴 Aberto |
| C4 | CRÍTICO | JWT Secret | /api/auth | Segurança | F6 | 🔴 Aberto |
| A1 | ALTO | Validação Dupla | 6 endpoints | Inconsistência | F1, F3, F4 | 🔴 Aberto |
| A2 | ALTO | Stack Trace | 9+ endpoints | Security | F1 | 🔴 Aberto |
| A3 | ALTO | Lógica Inline | 8 endpoints | Complexidade | F1, F3 | 🔴 Aberto |
| A4 | ALTO | Sem Transação | 7 endpoints | Race condition | F2, F3 | 🔴 Aberto |
| A5 | ALTO | Erro Format | 12+ endpoints | Cliente overhead | F1 | 🔴 Aberto |
| A6 | ALTO | Format Inline | 4 endpoints | MVC violation | F1 | 🔴 Aberto |
| A7 | ALTO | Auth Dispersa | 15 endpoints | Manutenção | F1, F4 | 🔴 Aberto |
| A8 | ALTO | Middleware Chain | 6 endpoints | Complexidade | F1 | 🔴 Aberto |
| A9 | ALTO | SQL Dinâmico | 3 endpoints | Injection risk | F2, F3 | 🔴 Aberto |
| A10 | ALTO | N+1 Queries | 4 endpoints | Performance | F2 | 🔴 Aberto |
| A11 | ALTO | Sem Paginação | 6 endpoints | Escalabilidade | F2 | 🔴 Aberto |
| A12 | ALTO | Soft Delete | 4 endpoints | Manutenção | F2 | 🔴 Aberto |
| A13 | ALTO | Regex Inconsist | 4 endpoints | Inconsistência | F4, F5 | 🔴 Aberto |
| A14 | ALTO | Sem Abstração | 3 endpoints | Acoplamento | F6 | 🔴 Aberto |
| A15 | ALTO | Transação Crítica | /orders/complete-flow | Dados | F3, F7 | 🔴 Aberto |
| A16 | ALTO | Lógica Hardcoded | /customers/credit-limit | Manutenção | F4, F5 | 🔴 Aberto |
| M1-M9 | MÉDIO | Vários | Vários | Vários | Vários | 🔴 Aberto |

---

## 🎯 Próximas Ações

### Fase 1: Entender as Fundações (Essencial)
- [ ] Identificar a violação de cada um dos 8 problemas fundacionais
- [ ] Entender como eles permitem que todos os outros 29 existam
- [ ] Mapear as conexões: qual problema fundacional causa qual problema específico

### Fase 2: Análise Arquitetural (Não incluída aqui)
- [ ] Estimar esforço de correção dos 8 fundacionais
- [ ] Notar que resolver F1-F8 elimina MUITOS dos 29 problemas
- [ ] Criar roadmap focado nas raízes, não nos sintomas

### Fase 3: Refatoração Fundacional (Não incluída aqui)
- [ ] Extrair camada de negócio (resolve F3)
- [ ] Criar abstrações para dados (resolve F2)
- [ ] Criar abstrações para dependências externas (resolve F6)
- [ ] Definir entidades de domínio (resolve F5)
- [ ] Centralizar regras de negócio (resolve F4)
- [ ] Separar apresentação de negócio (resolve F1)
- [ ] Isolar orquestradores (resolve F7)
- [ ] Definir limites claros com portas/adapters (resolve F8)

### Fase 4: Testes (Não incluída aqui)
- [ ] Testes unitários para camada de negócio
- [ ] Testes de integração para adapters
- [ ] Testes de aceitação para fluxos

---
