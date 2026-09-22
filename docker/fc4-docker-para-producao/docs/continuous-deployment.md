Aqui está seu conteúdo formatado corretamente em **Markdown**:

# CD (Continuous Deployment)

## Etapas para o Compose

1. Parar os containers envolvidos (`stop`)
2. Publicar nova versão (`up`)
3. Mudar a tag manualmente no `compose.yaml`
4. Usar `latest`
5. Usar variável de ambiente:

```yaml
image: myuser/app:${TAG:-latest}
```

### Formas de fazer

- Rodar os comandos de forma manual
- Acessando servidor via **SSH** de forma automatizada

  - Possibilita rodar comandos no servidor

- Exposição do **Docker via TCP**

  - Permite fazer comandos remotos no Docker

- Usar ferramentas como:

  - [Watchtower](https://github.com/beatkind/watchtower) — (Compose)
  - [Shepherd](https://github.com/containrrr/shepherd) — (Swarm)
  - [Diun](https://github.com/crazy-max/diun) — (Compose ou Swarm)
  - [Renovate](https://github.com/renovatebot/renovate) — (atualizar versões nos arquivos)
  - **Portainer** — (gerenciar e atualizar os containers)
  - Outras ferramentas

---

## Etapas para o Swarm

1. Rodar:

```bash
   docker stack deploy
```

se mudamos a tag.

2. Rodar:

```bash
   docker service update
```

se usamos tag mutável, mas passando o **digest**.
