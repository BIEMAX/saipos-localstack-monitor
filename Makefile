# =========================
# � Makefile - saipos-localstack-monitor
# =========================

# Detecta automaticamente se é "docker-compose" (v1) ou "docker compose" (v2)
DOCKER_COMPOSE_CMD := $(shell \
	if docker compose version >/dev/null 2>&1; then \
		echo "docker compose"; \
	elif docker-compose --version >/dev/null 2>&1; then \
		echo "docker-compose"; \
	else \
		echo "ERROR: Nem 'docker compose' nem 'docker-compose' encontrados. Instale o Docker Compose." >&2; \
		exit 1; \
	fi \
)

# Define o compose completo com o arquivo
DOCKER_COMPOSE = $(DOCKER_COMPOSE_CMD) -f ./docker-compose.yml
DOCKER_COMPOSE_AWS = $(DOCKER_COMPOSE_CMD) -f ./docker-compose.localstack.yml -p localstack

.PHONY: help build up down restart logs rebuild clean

help:
	@echo ""
	@echo "� Comandos disponíveis:"
	@echo "  make build     → builda as imagens do Docker"
	@echo "  make up        → builda e sobe os containers"
	@echo "  make down      → derruba todos os containers"
	@echo "  make restart   → reinicia os containers"
	@echo "  make logs      → exibe logs em tempo real"
	@echo "  make rebuild   → rebuilda tudo do zero"
	@echo "  make clean     → remove containers, imagens e volumes órfãos"
	@echo ""
	@echo "� Docker Compose detectado: $(DOCKER_COMPOSE_CMD)"
	@echo ""

network:
	docker network create app_network

build:
	$(DOCKER_COMPOSE) build

up:
	$(DOCKER_COMPOSE) up -d --build

down:
	$(DOCKER_COMPOSE) down

up-aws:
	$(DOCKER_COMPOSE_AWS) up -d --build

down-aws:
	$(DOCKER_COMPOSE_AWS) down

restart: down up

logs:
	$(DOCKER_COMPOSE) logs -f

rebuild:
	$(DOCKER_COMPOSE) down
	$(DOCKER_COMPOSE) build --no-cache
	$(DOCKER_COMPOSE) up -d

clean:
	docker system prune -f