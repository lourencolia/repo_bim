# Repositório BIM — Backend de Autenticação

Backend de autenticação seguro e pronto para produção para um repositório de projetos BIM (Building Information Modeling), desenvolvido com **FastAPI** + **PostgreSQL**.

---

## Arquitetura de Segurança

| Funcionalidade | Implementação | Justificativa |
|---|---|---|
| Hash de senha | **Argon2id** (`argon2-cffi`) | Vencedor do PHC; resistente a GPU; acesso à memória independente de dados |
| Salt por usuário | 32 bytes via `secrets.token_hex` | Previne rainbow tables e ataques em lote |
| 2FA | **TOTP** (`pyotp`) — RFC 6238 | Compatível com Google Authenticator e Authy |
| Token temporário (Etapa 1) | JWT (TTL de 3 min) com `stage: pre_2fa` | Etapa de 2FA obrigatória antes do acesso completo |
| Token de acesso final | JWT (TTL de 60 min) com `stage: authenticated` | Stateless; rotacione `SECRET_KEY` para invalidar todos |
| Prevenção de enumeração de usuários | Mesma resposta + tempo para usuários inexistentes | Verificação dummy com tempo constante |

---

## Fluxo de Autenticação

```
Cliente                         Servidor
  │                               │
  ├─ POST /auth/register ────────►│  Hash da senha (Argon2id + salt) → Banco
  │◄─ 201 { user_id, email } ─────┤
  │                               │
  ├─ POST /auth/login ───────────►│  Verifica hash Argon2id
  │◄─ 200 { temp_token (5 min) } ─┤  ← stage: "pre_2fa"
  │                               │
  ├─ POST /auth/2fa/setup ───────►│  Gera segredo TOTP → Banco
  │◄─ 200 { secret, qr_base64 } ──┤  ← Usuário escaneia QR no app autenticador
  │                               │
  ├─ POST /auth/2fa/verify ──────►│  Valida código TOTP
  │◄─ 200 { access_token } ───────┤  ← stage: "authenticated" (60 min)
  │                               │
```

---

## Estrutura do Projeto

```
backend/
├── main.py                # App FastAPI, CORS, registro de rotas
├── config.py              # pydantic-settings (carrega .env)
├── .env                   # Segredos do ambiente (NÃO versionar no git)
├── requirements.txt       # Dependências Python
├── database/
│   └── db.py              # Engine SQLAlchemy assíncrono + fábrica de sessões
├── models/
│   └── user.py            # Modelo ORM do usuário (UUID, hash, salt, colunas TOTP)
├── routers/
│   └── auth.py            # Endpoints HTTP + schemas Pydantic de requisição/resposta
└── services/
    ├── auth_service.py    # Lógica de negócio: registro, login, setup/verificação 2FA
    ├── hash_service.py    # Hash Argon2id + geração de salt
    └── totp_service.py    # Geração de segredo TOTP, QR code e verificação de código
```

---

## Pré-requisitos

- **Python 3.11+**
- **PostgreSQL 14+** rodando localmente (ou via Docker)

---

## Configuração

### 1. Criar e ativar ambiente virtual

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
```

### 2. Instalar dependências

```bash
pip install -r requirements.txt
```

### 3. Configurar variáveis de ambiente

Copie o `.env` de exemplo (já presente) e preencha com seus valores:

```bash
# .env
SECRET_KEY=<gere com: python -c "import secrets; print(secrets.token_hex(64))">
DATABASE_URL=postgresql+asyncpg://postgres:suasenha@localhost:5432/bim_auth
```

### 4. Criar o banco de dados PostgreSQL

```bash
psql -U postgres -c "CREATE DATABASE bim_auth;"
```

Ou com Docker:

```bash
docker run --name bim-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=bim_auth \
  -p 5432:5432 \
  -d postgres:16-alpine
```

### 5. Iniciar o servidor

A partir do **diretório raiz** (pai de `backend/`):

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

> **Importante:** Execute a partir do diretório pai para que o Python resolva corretamente o pacote `backend`.

As tabelas do banco são criadas automaticamente na primeira inicialização via `init_db()`.

---

## Referência da API

Documentação interativa disponível em:
- **Swagger UI** → http://localhost:8000/docs

### POST `/auth/register`

Cria uma nova conta de usuário.

```json
// Requisição
{
  "email": "arquiteto@bim-studio.com",
  "password": "Arq!2024SenhaSegura"
}

// Resposta 201
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "arquiteto@bim-studio.com",
  "message": "Conta criada com sucesso. Prossiga para /auth/login."
}
```

### POST `/auth/login`

Autenticação Etapa 1 — retorna um token temporário de 5 minutos.

```json
// Requisição
{ "email": "arquiteto@bim-studio.com", "password": "Arq!2024SenhaSegura" }

// Resposta 200
{
  "token": "<JWT pre_2fa>",
  "token_type": "bearer",
  "message": "Senha verificada. Use este token com /auth/2fa/verify."
}
```

### POST `/auth/2fa/setup`

Gera um segredo TOTP e QR code. Escaneie o QR com o Google Authenticator.

```json
// Requisição
{ "temp_token": "<JWT pre_2fa de /login>" }

// Resposta 200
{
  "secret": "BASE32SECRETOAQUI",
  "qr_base64": "<PNG em base64>",
  "message": "Escaneie o QR code e depois chame /auth/2fa/verify."
}
```

**Renderizar o QR code em HTML:**
```html
<img src="data:image/png;base64,{{ qr_base64 }}" alt="QR Code TOTP" />
```

### POST `/auth/2fa/verify`

Etapa 2 — valida o código TOTP de 6 dígitos e retorna o JWT final.

```json
// Requisição
{
  "temp_token": "<JWT pre_2fa>",
  "totp_code": "123456"
}

// Resposta 200
{
  "token": "<JWT de acesso final>",
  "token_type": "bearer",
  "message": "2FA verificado. Autenticação concluída."
}
```

---

## Ajuste dos Parâmetros do Argon2

Os parâmetros de hash estão definidos em `services/hash_service.py`:

| Parâmetro | Valor | Efeito |
|---|---|---|
| `time_cost` | 3 | 3 passagens sobre a memória (mais = mais lento = mais seguro) |
| `memory_cost` | 65536 (64 MiB) | RAM necessária por hash (bloqueia paralelismo de GPU) |
| `parallelism` | 2 | Ajuste conforme o número de núcleos do seu CPU |

**Benchmark no seu hardware:**
```bash
python -c "
from argon2 import PasswordHasher
import timeit
ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2)
t = timeit.timeit(lambda: ph.hash('teste_benchmark'), number=5) / 5
print(f'Tempo médio de hash: {t*1000:.0f}ms')
"
```
Meta: **≥ 200ms** por hash (recomendação OWASP). Aumente `time_cost` ou `memory_cost` se for mais rápido.

---

## Checklist de Produção

- [ ] Definir `SECRET_KEY` com valor aleatório de 64+ caracteres hex
- [ ] Usar HTTPS (TLS) — nunca servir via HTTP puro em produção
- [ ] Adicionar rate limiting (ex: `slowapi`) em `/auth/login` e `/auth/2fa/verify`
- [ ] Implementar prevenção de replay do TOTP (rastrear códigos usados no Redis com TTL de 90s)
- [ ] Usar Alembic para migrações de banco em vez de `create_all`
- [ ] Considerar criptografar `totp_secret` em repouso com uma chave KMS
- [ ] Definir `ACCESS_TOKEN_EXPIRE_MINUTES` para ≤ 60 em ambientes sensíveis
- [ ] Remover `http://localhost:3000` do `allow_origins` do CORS em produção
- [ ] Monitorar tentativas de autenticação falhas e alertar em picos

---

## Executando Testes

```bash
pytest tests/ -v
```

*(Diretório de testes não incluído neste scaffold — adicione pytest + httpx para testes assíncronos de endpoints.)*

---

## Licença

Uso interno — Repositório BIM do Escritório de Arquitetura e Urbanismo.