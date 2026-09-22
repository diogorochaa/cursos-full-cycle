# Tutorial de Configuração do Docker Swarm

Este guia apresenta **3 formas diferentes** de configurar um cluster Docker Swarm para desenvolvimento e produção.

## 📑 Índice

1. [Opção 1: Swarm com Docker-in-Docker (Local - Desenvolvimento)](#opção-1-swarm-com-docker-in-docker-local---desenvolvimento)
2. [Opção 2: Docker Desktop/Engine com Swarm (Mac/Windows/Linux)](#opção-2-docker-desktopengine-com-swarm-macwindowslinux)
3. [Opção 3: Cluster em Cloud (Produção - DigitalOcean/AWS/GCP)](#opção-3-cluster-em-cloud-produção)
4. [Verificação e Testes](#verificação-e-testes)
5. [Comandos Úteis](#comandos-úteis)

---

## Opção 1: Swarm com Docker-in-Docker (Local - Desenvolvimento)

Esta opção cria um cluster Swarm usando **containers Docker como nodes**. Perfeito para desenvolvimento e testes locais sem precisar de VMs ou servidores cloud.

### ✅ Vantagens
- 💰 **Gratuito** - roda totalmente local
- 🚀 **Rápido** - não precisa provisionar VMs
- 🧹 **Fácil cleanup** - deleta containers e pronto
- 🔄 **Reproduzível** - mesmo ambiente para toda equipe

### ⚠️ Limitações
- Todos os nodes compartilham recursos da máquina host
- Networking é simulado (não testa problemas reais de rede)
- Não recomendado para produção

### 📋 Pré-requisitos
- Docker instalado (Docker Engine ou Docker Desktop)
- Linux, macOS ou Windows com WSL2

### 🚀 Setup Passo a Passo

#### 1. Criar a rede para o cluster

```bash
docker network create --driver bridge swarm-net
```

**Por quê necessário:** Os containers Docker-in-Docker precisam se comunicar entre si para formar o cluster Swarm. A rede bridge permite que `swarm-manager`, `swarm-worker-1` e `swarm-worker-2` se resolvam por hostname.

#### 2. Criar o node manager

```bash
docker run -d \
  --name swarm-manager \
  --hostname swarm-manager \
  --network swarm-net \
  --privileged \
  -p 8080:80 \
  -p 5432:5432 \
  docker:dind
```

**Explicação:**
- `docker:dind` → Docker-in-Docker image
- `--privileged` → Necessário para rodar Docker dentro de Docker
- `--network swarm-net` → Conecta à rede compartilhada (essencial para comunicação)
- `-p 8080:80` → Mapeia porta 80 do swarm para 8080 do host
- `-p 5432:5432` → Mapeia porta do PostgreSQL (opcional, para acesso direto)

#### 3. Inicializar o Swarm no manager

```bash
# Entrar no container manager
docker exec -it swarm-manager sh

# Dentro do container, inicializar o Swarm
docker swarm init --advertise-addr eth0

# Copiar o token que aparece, exemplo:
# docker swarm join --token SWMTKN-1-xxxxx swarm-manager:2377

# Sair do container
exit
```

#### 4. Criar nodes workers

```bash
# Worker 1
docker run -d \
  --name swarm-worker-1 \
  --hostname swarm-worker-1 \
  --network swarm-net \
  --privileged \
  docker:dind

# Worker 2
docker run -d \
  --name swarm-worker-2 \
  --hostname swarm-worker-2 \
  --network swarm-net \
  --privileged \
  docker:dind
```

#### 5. Adicionar workers ao cluster

```bash
# Entrar no worker 1
docker exec -it swarm-worker-1 sh

# Colar o comando de join copiado anteriormente
docker swarm join --token SWMTKN-1-xxxxx swarm-manager:2377

exit

# Repetir para worker 2
docker exec -it swarm-worker-2 sh
docker swarm join --token SWMTKN-1-xxxxx swarm-manager:2377
exit
```

#### 6. Verificar o cluster

```bash
# No manager
docker exec swarm-manager docker node ls
```

Saída esperada:
```
ID                            HOSTNAME          STATUS    AVAILABILITY
xxxxx *  swarm-manager     Ready     Active         Leader
yyyyy    swarm-worker-1    Ready     Active
zzzzz    swarm-worker-2    Ready     Active
```

### 📦 Deploy de uma Stack

```bash
# Copiar compose file para o manager
docker cp compose.prod.swarm.yaml swarm-manager:/root/

# Criar secrets
docker exec swarm-manager sh -c 'echo "senha123" | docker secret create db_password -'
docker exec swarm-manager sh -c 'echo "appuser" | docker secret create db_user -'
docker exec swarm-manager sh -c 'echo "jwt_secret_key" | docker secret create jwt_secret -'

# Criar configs (se usar)
docker exec swarm-manager sh -c 'cd /root && docker config create nginx_conf ./nginx/nginx.conf'

# Criar label para database
docker exec swarm-manager docker node update --label-add database=true swarm-manager

# Deploy da stack
docker exec swarm-manager docker stack deploy -c /root/compose.prod.swarm.yaml myapp

# Verificar
docker exec swarm-manager docker service ls
```

### 🧹 Limpeza

```bash
# Remover stack (se houver)
docker exec swarm-manager docker stack rm myapp

# Parar e remover containers
docker stop swarm-manager swarm-worker-1 swarm-worker-2
docker rm swarm-manager swarm-worker-1 swarm-worker-2

# Remover rede
docker network rm swarm-net
```

---

## Opção 2: Docker Desktop/Engine com Swarm (Mac/Windows/Linux)

Docker Desktop ou Docker Engine permite usar Swarm no **mesmo daemon Docker**, sem containers adicionais. Simples mas limitado a 1 node.

### ✅ Vantagens
- 🎯 **Simplicidade máxima**
- 💾 **Menos overhead** - sem containers extras
- 🔌 **Acesso direto** - localhost funciona normalmente

### ⚠️ Limitações
- Apenas **1 node** (não testa distribuição multi-node)
- Não simula rede overlay real
- Bom apenas para testes básicos

### 🚀 Setup

#### 1. Inicializar o Swarm

```bash
docker swarm init
```

**Nota:** No Docker Desktop, pode aparecer erro de múltiplos IPs. Use:

```bash
# Mac/Linux
docker swarm init --advertise-addr 127.0.0.1

# Windows
docker swarm init --advertise-addr <seu-ip-local>
```

#### 2. Verificar

```bash
docker node ls
```

#### 3. Criar secrets

```bash
echo "senha123" | docker secret create db_password -
echo "appuser" | docker secret create db_user -
echo "jwt_secret_key" | docker secret create jwt_secret -
```

#### 4. Criar configs

```bash
# Assumindo que você está em src/production/
docker config create nginx_conf ./nginx/nginx.conf
docker config create nginx_default_conf ./nginx/conf.d/default.conf
```

#### 5. Adicionar label (se necessário)

```bash
# Pegar o node ID
NODE_ID=$(docker node ls -q)

# Adicionar label
docker node update --label-add database=true $NODE_ID
```

#### 6. Deploy da stack

```bash
docker stack deploy -c compose.prod.swarm.yaml myapp
```

#### 7. Verificar

```bash
docker service ls
docker stack ps myapp
```

### 🧹 Limpeza

```bash
# Remover stack
docker stack rm myapp

# Sair do Swarm
docker swarm leave --force
```

---

## Opção 3: Cluster em Cloud (Produção)

### 📋 Pré-requisitos

Antes de começar, você precisa ter:

1. **3 VPS (Virtual Private Servers)** em qualquer cloud provider:
   - **DigitalOcean** - Mais simples e barato para começar ($6/mês por droplet)
   - **AWS EC2** - Mais opções de configuração
   - **Google Cloud** - Boa integração com GKE
   - **Azure** - Boa integração com serviços Microsoft
   - **Linode/Vultr/Hetzner** - Alternativas econômicas

2. **Especificações mínimas recomendadas por VPS:**
   - 1 vCPU
   - 1GB RAM (2GB recomendado para produção)
   - Ubuntu 22.04 LTS ou Debian 11+

3. **Docker instalado em todas as 3 VPS:**
   - Docker Engine 20.10+
   - Acesso SSH configurado
   - Usuário com permissões docker

4. **Acesso SSH:**
   - Chaves SSH configuradas
   - Acesso root ou sudo

5. **Nomes sugeridos:**
   - `swarm-manager` (manager node)
   - `swarm-worker-1` (worker node)
   - `swarm-worker-2` (worker node)

### 🚀 Setup Passo a Passo

#### 1. Configurar Firewall

**No Manager:**

```bash
# Permitir portas do Swarm
sudo ufw allow 2377/tcp   # Cluster management
sudo ufw allow 7946/tcp   # Node communication
sudo ufw allow 7946/udp   # Node communication
sudo ufw allow 4789/udp   # Overlay network

# Reiniciar firewall para aplicar regras
sudo ufw reload
```

**Nos Workers:**

```bash
sudo ufw allow 7946/tcp
sudo ufw allow 7946/udp
sudo ufw allow 4789/udp
sudo ufw allow 22/tcp

# Reiniciar firewall para aplicar regras
sudo ufw reload
```

#### 2. Inicializar Swarm no Manager

```bash
# SSH no manager
ssh root@<manager-ip>

# Inicializar Swarm com IP privado (mais seguro)
docker swarm init --advertise-addr <manager-private-ip>

# Ou com IP público
docker swarm init --advertise-addr <manager-public-ip>
```

**Saída:**
```
Swarm initialized: current node (xxx) is now a manager.

To add a worker to this swarm, run the following command:

    docker swarm join --token SWMTKN-1-xxxxxxxxxxxx <manager-ip>:2377

To add a manager to this swarm, run 'docker swarm join-token manager'
```

**⚠️ Copie o comando `docker swarm join`!**

#### 3. Adicionar Workers ao Cluster

```bash
# SSH em cada worker e executar o comando copiado
ssh root@<worker-1-ip>
docker swarm join --token SWMTKN-1-xxxxxxxxxxxx <manager-ip>:2377

ssh root@<worker-2-ip>
docker swarm join --token SWMTKN-1-xxxxxxxxxxxx <manager-ip>:2377
```

#### 4. Verificar Cluster (no manager)

```bash
docker node ls
```

Saída esperada:
```
ID                            HOSTNAME          STATUS    AVAILABILITY   MANAGER STATUS
xxx *  swarm-manager     Ready     Active         Leader
yyy    swarm-worker-1    Ready     Active
zzz    swarm-worker-2    Ready     Active
```

#### 5. Configurar Labels

```bash
# Adicionar label para PostgreSQL
docker node update --label-add database=true swarm-manager

# Verificar
docker node inspect swarm-manager --format '{{.Spec.Labels}}'
```

#### 6. Criar Secrets

```bash
echo "sua_senha_forte_aqui" | docker secret create db_password -
echo "appuser" | docker secret create db_user -
echo "jwt_token_super_secreto" | docker secret create jwt_secret -

# Verificar
docker secret ls
```

#### 7. Criar Configs

```bash
# Upload dos arquivos de config
scp -r ./nginx root@<manager-ip>:/root/project/production/

# SSH no manager
ssh root@<manager-ip>

# Criar configs
cd /root/project/production
docker config create nginx_conf ./nginx/nginx.conf
docker config create nginx_default_conf ./nginx/conf.d/default.conf

# Verificar
docker config ls
```

#### 8. Deploy da Stack

```bash
# Upload do compose file
scp compose.prod.swarm.yaml root@<manager-ip>:/root/project/production/

# SSH no manager
ssh root@<manager-ip>
cd /root/project/production

# Deploy
docker stack deploy -c compose.prod.swarm.yaml myapp

# Verificar
docker service ls
docker stack ps myapp
```

#### 9. Testar Aplicação

```bash
# Acessar pelo IP público do manager
curl http://<manager-public-ip>

# Ou qualquer worker (routing mesh do Swarm)
curl http://<worker-1-public-ip>
curl http://<worker-2-public-ip>
```

---

## Verificação e Testes

### Verificar Status do Cluster

```bash
# Listar nodes
docker node ls

# Detalhes de um node
docker node inspect <node-name>

# Ver labels dos nodes
docker node inspect <node-name> --format '{{.Spec.Labels}}'
```

### Verificar Serviços

```bash
# Listar serviços
docker service ls

# Detalhes de um serviço
docker service inspect myapp_app

# Ver réplicas e em quais nodes estão
docker service ps myapp_app

# Logs de todas as réplicas
docker service logs -f myapp_app

# Logs de um container específico
docker logs -f <container-id>
```

### Verificar Redes

```bash
# Listar redes
docker network ls

# Detalhes da rede overlay
docker network inspect myapp_frontend
docker network inspect myapp_backend
```

### Verificar Secrets e Configs

```bash
# Listar secrets
docker secret ls

# Inspecionar (não mostra o valor)
docker secret inspect db_password

# Listar configs
docker config ls

# Ver conteúdo do config
docker config inspect --pretty nginx_conf
```

### Testar Healthchecks

```bash
# Ver status de health de um container
docker inspect --format='{{json .State.Health}}' <container-id> | jq

# Ver apenas o status
docker inspect --format='{{.State.Health.Status}}' <container-id>
```

### Testar Load Balancing

```bash
# Fazer várias requisições e ver qual container responde
for i in {1..10}; do
  curl http://<manager-ip> -s | grep -o "Container ID: [a-z0-9]*"
done
```

### Testar Failover

```bash
# Parar um container e ver se outro assume
docker stop <container-id>

# Verificar se nova réplica foi criada
docker service ps myapp_app
```

---

## Comandos Úteis

### Gerenciamento de Stack

```bash
# Deploy/atualizar
docker stack deploy -c compose.prod.swarm.yaml myapp

# Remover
docker stack rm myapp

# Listar stacks
docker stack ls

# Ver serviços da stack
docker stack services myapp

# Ver todas as tasks
docker stack ps myapp
```

### Gerenciamento de Serviços

```bash
# Escalar serviço
docker service scale myapp_app=5

# Atualizar imagem
docker service update --image argentinaluiz/docker-prod-test:v2 myapp_app

# Forçar re-deploy
docker service update --force myapp_app

# Rollback
docker service rollback myapp_app

# Ver histórico de updates
docker service inspect --pretty myapp_app
```

### Gerenciamento de Nodes

```bash
# Promover worker a manager
docker node promote <node-name>

# Rebaixar manager a worker
docker node demote <node-name>

# Drenar node (não aceita novos containers)
docker node update --availability drain <node-name>

# Reativar node
docker node update --availability active <node-name>

# Remover node do cluster
docker node rm <node-name>

# Sair do Swarm (executar no node)
docker swarm leave

# Forçar saída (manager)
docker swarm leave --force
```

### Monitoramento

```bash
# Ver recursos em tempo real
docker stats

# Ver eventos do Swarm
docker events

# Ver logs de sistema do Docker
sudo journalctl -u docker -f
```

---

## Troubleshooting

### Problemas Comuns

#### 1. Node não consegue entrar no cluster

```bash
# Verificar conectividade
ping <manager-ip>
telnet <manager-ip> 2377

# Verificar firewall
sudo ufw status

# Gerar novo token
docker swarm join-token worker
```

#### 2. Serviço não inicia

```bash
# Ver erros detalhados
docker service ps myapp_app --no-trunc

# Ver logs
docker service logs myapp_app

# Inspecionar
docker inspect <container-id>
```

#### 3. Problema com secrets/configs

```bash
# Verificar se existem
docker secret ls
docker config ls

# Recriar
docker secret rm db_password
echo "nova_senha" | docker secret create db_password -
```

#### 4. Networking não funciona

```bash
# Verificar redes
docker network ls

# Testar DNS
docker exec -it <container-id> nslookup postgres

# Testar conectividade
docker exec -it <container-id> ping postgres
```

#### 5. Certificados SSL expirados

```bash
# Renovar com certbot
sudo certbot renew

# Atualizar configs
docker config create nginx_conf_new ./nginx/nginx.conf
docker service update \
  --config-rm nginx_conf \
  --config-add source=nginx_conf_new,target=/etc/nginx/nginx.conf \
  myapp_nginx
```

---

## Próximos Passos

### Para Desenvolvimento
- ✅ Use Docker-in-Docker (Opção 1) para testes locais
- ✅ Experimente diferentes configurações de deploy
- ✅ Teste failover e recovery

### Para Staging
- ✅ Use cloud com 3 nodes pequenos
- ✅ Configure CI/CD pipeline
- ✅ Implemente monitoramento básico

### Para Produção
- ✅ Use cloud com nodes maiores
- ✅ Configure backup automatizado
- ✅ Implemente monitoramento completo (Prometheus + Grafana)
- ✅ Configure alertas
- ✅ Use registry privado para imagens
- ✅ Configure SSL/TLS
- ✅ Implemente log centralizado (ELK, Loki)
- ✅ Configure auto-scaling (se disponível)

---

## Recursos Adicionais

- [Docker Swarm Documentation](https://docs.docker.com/engine/swarm/)
- [Docker Swarm Tutorial](https://docs.docker.com/engine/swarm/swarm-tutorial/)
- [Best Practices](https://docs.docker.com/engine/swarm/stack-deploy/)
- [Networking Guide](https://docs.docker.com/network/overlay/)

---

## Conclusão

Você agora tem **3 opções** para configurar Docker Swarm:

1. **Docker-in-Docker** → Desenvolvimento local, testes rápidos
2. **Docker Desktop/Engine** → Testes básicos, 1 node
3. **Cloud** → Produção real, cluster completo

Escolha a opção adequada ao seu caso de uso e comece a orquestrar seus containers! 🚀
