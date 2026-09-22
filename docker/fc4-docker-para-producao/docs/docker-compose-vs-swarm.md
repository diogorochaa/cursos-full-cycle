# Docker Compose vs Docker Swarm

## O que são?

**Docker Compose**: Roda múltiplos containers em **um único servidor**.

**Docker Swarm**: Roda containers em **cluster de múltiplos servidores**.

---

## Comparação Rápida

| Característica | Docker Compose | Docker Swarm |
|----------------|----------------|--------------|
| Servidores | 1 | 3+ (cluster) |
| Alta Disponibilidade | Não | Sim |
| Escalabilidade | Manual | Automática |
| Load Balancing | Sim, mas limitado | Sim |
| Deploy sem Downtime | Não | Sim |
| Rollback Automático | Não | Sim |
| Secrets | Variáveis de ambiente | Criptografados |
| Complexidade | Baixa | Média |
| Custo | Baixo (1 servidor) | Maior (3+ servidores) |

---

## Quando Usar

### Docker Compose
- Desenvolvimento local
- Testes e CI/CD
- MVP/projeto pequeno
- Baixo tráfego
- Orçamento limitado
- Downtime aceitável

### Docker Swarm
- Produção profissional
- Alta disponibilidade necessária
- Tráfego médio/alto
- Zero downtime obrigatório
- SLA 99.5%+
- Precisa escalar

---

## Diferenças Principais

### Secrets
**Compose**: Variáveis de ambiente em texto plano (inseguro)  
**Swarm**: Secrets criptografados e distribuídos

### Escalabilidade
**Compose**: Uma instância por serviço  
**Swarm**: N instâncias distribuídas entre nodes

### Deploy
**Compose**: Requer downtime (down/up)  
**Swarm**: Rolling updates sem downtime, com rollback automático

### Networking
**Compose**: Bridge local (mesmo servidor)  
**Swarm**: Overlay multi-host com load balancing

---
