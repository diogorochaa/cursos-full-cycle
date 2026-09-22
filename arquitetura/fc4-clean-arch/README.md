# ShopHub API — Projeto Didático com Anti-Patterns

> ⚠️ Projeto propositalmente ruim para fins educacionais. Não use em produção.

## Visão Geral
- Monólito Express centralizado em [app.ts](app.ts), carregando tudo em um único processo.
- Código repleto de más práticas para serem analisadas ao longo do curso (veja [PROBLEMS_MAP.md](PROBLEMS_MAP.md)).
- Sem fronteiras claras entre camadas; lógica de negócio, HTTP e acesso a dados se misturam.

## Como Rodar (para fins de estudo)

### Pré-requisitos
- Node.js 24+ (veja [package.json](package.json))
- Docker e Docker Compose (para o banco PostgreSQL)

### Passo a Passo

1. **Instalar dependências**
   ```bash
   npm install
   ```

2. **Configurar variáveis de ambiente**
   ```bash
   cp .env.example .env
   ```
   
   Edite o `.env` e configure:
   ```env
   # Banco de dados
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=postgres
   DB_NAME=shophub
   
   # Segurança
   JWT_SECRET=your-super-secret-jwt-key-here
   
   # APIs Externas (opcional para testes)
   STRIPE_SECRET_KEY=sk_test_your_stripe_key
   SENDGRID_API_KEY=SG.your_sendgrid_key
   
   # App
   PORT=3000
   ENABLE_JOBS=false
   ```

3. **Subir o banco de dados PostgreSQL**
   ```bash
   docker compose up -d
   ```
   
   O schema SQL será aplicado automaticamente de `database/schema.sql` (volume montado em `/docker-entrypoint-initdb.d/`).
   
   Para verificar se o banco está rodando:
   ```bash
   docker compose ps
   docker compose logs postgres
   ```

4. **Rodar a aplicação**
   ```bash
   npm run dev
   ```
   
   O monólito estará disponível em `http://localhost:3000`.
   
5. **Testar os endpoints**
   
   Use o arquivo [api.http](api.http) com a extensão REST Client do VS Code:
   
   - Primeiro, execute o request de login para obter o token
   - Depois, use os outros endpoints com autenticação

   Ou use curl:
   ```bash
   # Login
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}'
   
   # Health check
   curl http://localhost:3000/health
   
   # Produtos (público)
   curl http://localhost:3000/api/products
   ```

### Comandos Úteis

```bash
# Ver logs do banco
docker compose logs -f postgres

# Parar o banco
docker compose down

# Limpar banco e recomeçar
docker compose down -v
docker compose up -d

# Verificar conexão do banco
docker compose exec postgres psql -U postgres -d shophub -c "SELECT COUNT(*) FROM users;"
```

## Estrutura Real do Projeto
```
problem-project/
├── app.ts                         # Monólito Express com rotas, lógica e SQL inline
├── common/
│   ├── db/
│   │   ├── connection.ts         # Acesso direto ao PostgreSQL
│   │   └── tables/               # Queries diretas (customers, orders, products)
│   └── middleware/               # Autenticação/validação espalhadas
├── services/
│   ├── order-service/
│   │   ├── controllers/orderController.ts
│   │   └── services/emailService.ts
│   ├── customer-service/business/CustomerService.ts
│   └── notification-service/jobs/ (cron jobs no mesmo processo)
├── database/schema.sql            # DDL do banco
├── PROBLEMS_MAP.md                # Lista completa dos problemas
├── SETUP_AND_TEST.md
├── package.json
└── tsconfig.json
```

## Principais Problemas (resumo; detalhes em [PROBLEMS_MAP.md](PROBLEMS_MAP.md))
- **Fundacionais**: sem separação apresentação/negócio, dados acoplados a HTTP, ausência de camada de negócio, regras espalhadas, inexistência de entidades de domínio, nenhuma abstração para serviços externos, orquestração acoplada, limites do sistema indefinidos.
- **Críticos**: SQL injection em `/api/reports/daily`; fluxo `/api/orders/complete-flow` sem transação; acoplamento entre endpoints (chamada direta de controller); fallback inseguro do JWT secret.
- **Altos/Médios**: SQL dinâmico concatenado (orders/products/customers), formatos de erro inconsistentes, validações duplicadas e divergentes, formatação inline (preço/CPF/telefone), autorização duplicada em middleware + handlers, N+1 queries e ausência de paginação.

## Rotas (todas declaradas em [app.ts](app.ts))
- Autenticação: `/api/auth/login`, `/api/auth/register`, `/api/auth/me`
- Pedidos: `/api/orders` (CRUD parcial) e `/api/orders/complete-flow` (orquestração frágil)
- Produtos: `/api/products`, `/api/products/:id`, `/api/products/:id/stock`
- Clientes: `/api/customers` e variações (id, credit-limit)
- Relatórios: `/api/reports/daily`
- Health: `/health`

## Aviso
Este repositório serve para estudar e refatorar más práticas. Muitos problemas de segurança, consistência e arquitetura estão presentes de propósito. Consulte [PROBLEMS_MAP.md](PROBLEMS_MAP.md) antes de qualquer alteração.
