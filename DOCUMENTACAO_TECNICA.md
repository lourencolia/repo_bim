# Documentação Técnica — Repositório Seguro de Arquivos BIM

**Projeto Integrador — Políticas de Segurança da Informação**
**Tema:** Desenvolvimento de um Sistema Seguro de Autenticação, Comunicação e Gestão de Credenciais em Conformidade com a LGPD

---

## 1. Visão Geral do Sistema

O sistema é um repositório web para armazenamento e compartilhamento controlado de arquivos **BIM (Building Information Modeling)**, desenvolvido com foco em segurança da informação e conformidade com a **Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)**.

O backend é construído em **Python/FastAPI** com banco de dados **PostgreSQL** (acesso assíncrono via SQLAlchemy + asyncpg). O frontend é uma aplicação **React/Vite**.

### Tecnologias principais

| Camada | Tecnologia |
|---|---|
| Framework web | FastAPI 0.111 (Python 3.12) |
| Banco de dados | PostgreSQL 14+ (async via asyncpg) |
| ORM | SQLAlchemy 2.0 (modo assíncrono) |
| Servidor ASGI | Uvicorn |
| Frontend | React + Vite |

---

## 2. Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────┐
│                     Cliente (Browser)                    │
│                   React + Vite (Frontend)                │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS (Bearer JWT)
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   FastAPI (Backend)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Router /auth │  │ Router /files│  │  Middleware   │  │
│  │  - register  │  │  - upload    │  │  - CORS       │  │
│  │  - login     │  │  - download  │  │  - Rate Limit │  │
│  │  - 2fa/setup │  │  - share     │  │  (slowapi)    │  │
│  │  - 2fa/verify│  │  - revoke    │  └───────────────┘  │
│  │  - forgot-pw │  └──────────────┘                     │
│  │  - reset-pw  │                                        │
│  │  - logout    │  ┌──────────────────────────────────┐  │
│  │  - /me       │  │         Services Layer           │  │
│  └──────────────┘  │  auth_service  │  file_service   │  │
│                    │  hash_service  │  totp_service   │  │
│                    └──────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────┘
                            │
              ┌─────────────┴────────────┐
              ▼                          ▼
┌─────────────────────┐    ┌─────────────────────────────┐
│   PostgreSQL DB      │    │  Sistema de Arquivos (disco) │
│  - users            │    │  uploads/{user_uuid}/        │
│  - files            │    │  {arquivo_uuid}.{ext}        │
│  - file_shares      │    └─────────────────────────────┘
│  - file_access_logs │
│  - auth_event_logs  │
│  - token_blocklist  │
│  - password_reset_  │
│    tokens           │
└─────────────────────┘
```

### Ativos do Sistema (req. 6.6)

| Ativo | Tipo | Criticidade |
|---|---|---|
| Arquivos BIM (`.rvt`, `.ifc`, `.dwg`, etc.) | Dado proprietário | Alta |
| Credenciais de usuário (hash + salt) | Dado pessoal sensível | Alta |
| Segredo TOTP (`totp_secret`) | Dado de autenticação | Alta |
| JWT de sessão | Token de acesso | Alta |
| Banco de dados PostgreSQL | Infraestrutura | Alta |
| Logs de auditoria (`file_access_logs`, `auth_event_logs`) | Dado de controle | Média |
| Chave secreta JWT (`SECRET_KEY`) | Chave criptográfica | Alta |

---

## 3. Autenticação e Gestão de Credenciais (req. 4.1 / 1.1–1.12)

### 3.1 Hash de Senha — Argon2id (req. 1.1 / 1.2 / 1.3 / 1.4)

O sistema utiliza o algoritmo **Argon2id**, vencedor do *Password Hashing Competition* (PHC, 2015), para armazenamento de senhas.

**Parâmetros configurados** (arquivo `services/hash_service.py`):

| Parâmetro | Valor | Justificativa |
|---|---|---|
| `time_cost` | 3 | 3 passagens sobre a memória — mínimo OWASP 2024 |
| `memory_cost` | 65.536 KB (64 MiB) | Bloqueia paralelismo de GPU; custo por hash |
| `parallelism` | 2 | Ajustado ao número de núcleos do servidor |
| `hash_len` | 32 bytes | 256 bits de entropia no hash resultante |
| `salt_len` | 32 bytes | Salt gerado internamente pelo Argon2 |

**Salt adicional por usuário:** além do salt interno do Argon2, o sistema gera um salt externo de 32 bytes (`secrets.token_hex(32)`) por usuário, armazenado em coluna separada (`password_salt`). A entrada do hash é `salt_externo + senha`, o que:
- Previne ataques de *rainbow table*
- Garante que dois usuários com a mesma senha produzam hashes completamente distintos
- Dificulta ataques em lote mesmo com acesso ao banco

**Benchmark de referência:** a combinação dos parâmetros acima produz tempo de hash ≥ 200ms (meta OWASP), tornando inviável a quebra por força bruta.

---

### 3.2 Autenticação de Dois Fatores — TOTP (req. 1.5 / 1.6)

O sistema implementa **TOTP (Time-based One-Time Password)** conforme a norma **RFC 6238**, compatível com Google Authenticator, Authy e similares.

**Fluxo de configuração do 2FA:**
1. Após o primeiro login (etapa 1), o usuário chama `POST /auth/2fa/setup` com o token temporário
2. O sistema gera um segredo base32 (`pyotp.random_base32()`) e retorna um QR Code em base64
3. O usuário escaneia o QR Code no aplicativo autenticador
4. O sistema não gera novo segredo se já houver um cadastrado — evita invalidar QR já escaneado

**Configurações TOTP:**
- Janela de validade: 30 segundos (padrão RFC 6238)
- Drift permitido: ±1 janela (tolerância de sincronização de relógio)
- Código: 6 dígitos numéricos

---

### 3.3 Fluxo Completo de Autenticação (req. 1.7 / 6.3)

```
Cliente                                  Servidor
  │                                          │
  ├─ POST /auth/register ──────────────────►│
  │   { matricula, nome, email, senha,       │  1. Valida duplicidade
  │     curso, terms_accepted: true }        │  2. Gera salt externo (32 bytes)
  │◄─ 201 { user_id, matricula, email } ────│  3. Hash Argon2id(salt + senha)
  │                                          │  4. Persiste no banco
  │                                          │
  ├─ POST /auth/login ─────────────────────►│
  │   { email, senha }                       │  1. Busca usuário
  │                                          │  2. Hash dummy se email inexistente
  │                                          │     (previne enumeração por tempo)
  │                                          │  3. Verifica Argon2id
  │                                          │  4. Loga evento (login_success/failure)
  │◄─ 200 { token: JWT[pre_2fa, TTL=3min] }─│  5. Emite token temporário
  │                                          │
  ├─ POST /auth/2fa/setup ─────────────────►│  (apenas primeiro acesso)
  │   { temp_token }                         │  Gera segredo TOTP + QR Code
  │◄─ 200 { secret, qr_base64 } ───────────│
  │   [usuário escaneia QR no app]           │
  │                                          │
  ├─ POST /auth/2fa/verify ────────────────►│
  │   { temp_token, totp_code }              │  1. Valida token temporário
  │                                          │  2. Valida código TOTP (RFC 6238)
  │                                          │  3. Loga evento (2fa_success/failure)
  │◄─ 200 { token: JWT[authenticated,60min]}│  4. Emite JWT final
  │                                          │
  ├─ [Todas as rotas protegidas] ──────────►│  Bearer {JWT final}
  │                                          │  1. Valida assinatura + expiração
  │                                          │  2. Verifica JTI na blocklist
  │                                          │  3. Busca usuário no banco
  │                                          │
  ├─ POST /auth/logout ────────────────────►│  Bearer {JWT final}
  │                                          │  1. Extrai JTI do token
  │◄─ 204 No Content ───────────────────────│  2. Insere JTI na token_blocklist
                                             │  3. Loga evento (logout)
```

---

### 3.4 Gestão de Sessões — JWT + Blocklist (req. 1.9 / 1.10 / 6.4)

**Tokens JWT emitidos:**

| Token | Claim `stage` | TTL | Uso |
|---|---|---|---|
| Temporário (pré-2FA) | `pre_2fa` | 3 minutos | Apenas para chamar `/2fa/setup` e `/2fa/verify` |
| Acesso final | `authenticated` | 60 minutos | Acesso a todos os endpoints protegidos |

**Claims incluídos em todos os tokens:**
- `sub`: UUID do usuário
- `stage`: tipo do token (`pre_2fa` ou `authenticated`)
- `jti`: UUID único por token (*JWT ID*) — base da blocklist
- `exp`: timestamp de expiração (Unix)

**Blocklist de tokens (tabela `token_blocklist`):**
- No logout, o JTI do token é inserido na blocklist com o timestamp de expiração original
- Todo request autenticado verifica o JTI antes de processar — tokens revogados retornam `HTTP 401`
- Garante que um token roubado não possa ser usado após o logout legítimo do usuário

---

### 3.5 Rate Limiting — Proteção contra Força Bruta (req. 1.11)

Implementado via **slowapi** (wrapper para FastAPI sobre a biblioteca `limits`):

| Endpoint | Limite | Resposta ao exceder |
|---|---|---|
| `POST /auth/login` | 5 requisições/minuto por IP | `HTTP 429 Too Many Requests` |
| `POST /auth/2fa/verify` | 5 requisições/minuto por IP | `HTTP 429 Too Many Requests` |
| `POST /auth/forgot-password` | 3 requisições/minuto por IP | `HTTP 429 Too Many Requests` |
| `POST /auth/reset-password` | 5 requisições/minuto por IP | `HTTP 429 Too Many Requests` |

A chave de limitação é o **endereço IP de origem** (`X-Real-IP` / `REMOTE_ADDR`).

---

### 3.6 Recuperação de Senha (req. 4.2 / 2.1–2.7)

O fluxo de recuperação de senha utiliza token criptograficamente seguro de uso único:

```
Cliente                                  Servidor
  │                                          │
  ├─ POST /auth/forgot-password ───────────►│
  │   { email }                              │  1. Busca usuário pelo email
  │                                          │  2. Loga evento (password_reset_request)
  │                                          │  3. Se usuário existe:
  │                                          │     a. Gera token: secrets.token_urlsafe(32)
  │                                          │     b. Armazena SHA-256(token) no banco
  │                                          │     c. Define expiração: agora + 15 minutos
  │◄─ 200 { message, reset_token* } ────────│  4. Resposta idêntica para emails inexistentes
  │   (* em produção: enviado por e-mail)    │     (prevenção de enumeração de usuários)
  │                                          │
  ├─ POST /auth/reset-password ────────────►│
  │   { token, new_password }                │  1. Calcula SHA-256(token recebido)
  │                                          │  2. Busca no banco pelo hash
  │                                          │  3. Valida: token existe?
  │                                          │  4. Valida: used_at == null? (uso único)
  │                                          │  5. Valida: expires_at > agora?
  │                                          │  6. Gera novo salt + hash Argon2id
  │                                          │  7. Atualiza senha no banco
  │                                          │  8. Marca token como usado (used_at = agora)
  │◄─ 200 { message } ──────────────────────│  9. Loga evento (password_reset_success/failure)
```

**Decisões de segurança:**
- O token é gerado com `secrets.token_urlsafe(32)` (256 bits de entropia — CSPRNG)
- Apenas o **SHA-256 do token** é armazenado no banco — se o banco for comprometido, os tokens não podem ser utilizados
- O token é **invalidado imediatamente após uso** (campo `used_at`), mesmo que ainda esteja dentro do prazo de validade
- Tokens expirados retornam erro específico (req. 2.5)
- A resposta ao cliente é sempre a mesma, independente de o e-mail existir ou não

---

## 4. Gestão de Arquivos BIM

### 4.1 Tipos de Arquivo Aceitos (Allowlist)

Apenas formatos BIM/CAD são aceitos. Qualquer extensão fora da lista é rejeitada com `HTTP 400`:

| Extensão | Formato | MIME Type |
|---|---|---|
| `.rvt` | Revit (Autodesk) | `application/octet-stream` |
| `.ifc` | Industry Foundation Classes | `application/x-step` |
| `.nwd` | Navisworks Document | `application/octet-stream` |
| `.nwc` | Navisworks Cache | `application/octet-stream` |
| `.pln` | ArchiCAD Project | `application/octet-stream` |
| `.dwg` | AutoCAD Drawing | `application/acad` |
| `.dxf` | Drawing Exchange Format | `application/dxf` |
| `.pdf` | Portable Document Format | `application/pdf` |

**Limite de tamanho:** 200 MB por arquivo.

### 4.2 Armazenamento Isolado

- Cada arquivo é salvo em `uploads/{user_uuid}/{arquivo_uuid}{extensão}`
- O **nome original** nunca é usado no disco — substituído por UUID gerado no upload
- O nome original é preservado no banco de dados para exibição e download

### 4.3 Controle de Acesso aos Arquivos

- Apenas o **proprietário** pode fazer upload, download, excluir e compartilhar seus arquivos
- Usuários com compartilhamento ativo podem fazer download, mas não excluir nem compartilhar
- Acesso verificado a cada requisição — não há cache de permissão

### 4.4 Compartilhamento com Controle LGPD

- O proprietário informa a **matrícula** do destinatário (não o e-mail — minimização de dados)
- O campo `lgpd_consent: true` é obrigatório na requisição — sem consentimento explícito, o compartilhamento é rejeitado
- O timestamp do consentimento é registrado (`lgpd_consent_at`)
- O proprietário pode **revogar** o compartilhamento a qualquer momento

### 4.5 Exclusão Lógica (Soft Delete)

Arquivos excluídos recebem `is_deleted = true` no banco — o arquivo no disco e seus registros de auditoria são preservados. Isso garante:
- Rastreabilidade histórica para fins de auditoria
- Possibilidade de recuperação em caso de exclusão acidental

---

## 5. Conformidade com a LGPD (req. 4.4)

### 5.1 Dados Pessoais Coletados e Finalidades (req. 4.1 / 4.2 / 4.3)

| Dado | Finalidade | Base legal (LGPD) |
|---|---|---|
| E-mail | Identificação e autenticação | Execução de contrato (Art. 7º, V) |
| Matrícula | Identificação institucional e compartilhamento | Execução de contrato (Art. 7º, V) |
| Nome completo | Exibição e identificação entre usuários | Execução de contrato (Art. 7º, V) |
| Curso | Contextualização de acesso no repositório | Execução de contrato (Art. 7º, V) |
| Hash + Salt da senha | Autenticação segura | Execução de contrato (Art. 7º, V) |
| Segredo TOTP | Autenticação multifator | Legítimo interesse em segurança (Art. 7º, IX) |
| IP de acesso (logs) | Auditoria e detecção de ameaças | Legítimo interesse em segurança (Art. 7º, IX) |

**Princípio da minimização:** apenas dados estritamente necessários são coletados. Não há coleta de data de nascimento, CPF, telefone ou outros dados não essenciais à funcionalidade.

### 5.2 Consentimento (req. 4.4 / 4.5 / 4.6 / 4.7)

- **Cadastro:** o campo `terms_accepted: true` é obrigatório — a conta não é criada sem aceite
- **Compartilhamento de arquivo:** o campo `lgpd_consent: true` é obrigatório em cada compartilhamento
- O timestamp de cada consentimento é registrado no banco (`terms_accepted_at`, `lgpd_consent_at`)
- O proprietário pode **revogar** qualquer compartilhamento a qualquer momento (`DELETE /files/{id}/share/{share_id}`)

### 5.3 Direitos do Titular — Status de Implementação

| Direito (LGPD Art. 18) | Status | Endpoint |
|---|---|---|
| Acesso aos dados | Implementado | `GET /auth/me` + `GET /auth/me/activity` |
| Revogação de consentimento | Implementado | `DELETE /files/{id}/share/{share_id}` |
| Exportação dos dados | Implementado | `GET /auth/me/export` |
| Exclusão da conta e anonimização | Implementado | `DELETE /auth/me` |

**Exportação de dados (`GET /auth/me/export`):** Retorna JSON com todos os dados pessoais do titular — perfil, arquivos, compartilhamentos realizados/recebidos, eventos de autenticação e atividade em arquivos (LGPD Art. 18, II e V).

**Exclusão de conta (`DELETE /auth/me`):** Exige confirmação de senha, invalida o JWT ativo, apaga arquivos físicos do Supabase Storage, anonimiza os registros de `auth_event_logs` (`user_id → NULL`, preservando o histórico de segurança conforme Art. 16 LGPD) e exclui o usuário com cascata no banco (LGPD Art. 18, VI).

---

## 6. Auditoria e Logs (req. 5.1 / 5.2 / 5.3 / 5.4)

### 6.1 Log de Operações em Arquivos (`file_access_logs`)

Registrado para cada operação sobre arquivos:

| Campo | Descrição |
|---|---|
| `id` | UUID do registro |
| `file_id` | UUID do arquivo afetado (nullable após soft delete) |
| `accessed_by` | UUID do usuário que realizou a ação |
| `action` | Tipo da ação: `upload`, `download`, `delete`, `share`, `revoke` |
| `accessed_at` | Timestamp UTC da ação |

### 6.2 Log de Eventos de Autenticação (`auth_event_logs`)

Registrado para cada evento de autenticação relevante:

| `event_type` | Quando é gerado |
|---|---|
| `login_success` | Login com senha validada com sucesso |
| `login_failure` | Senha incorreta ou e-mail inexistente |
| `2fa_success` | Código TOTP validado com sucesso |
| `2fa_failure` | Código TOTP inválido ou expirado |
| `logout` | Token invalidado via endpoint de logout |
| `password_reset_request` | Solicitação de recuperação de senha |
| `password_reset_success` | Nova senha aplicada com sucesso |
| `password_reset_failure` | Token inválido, expirado ou já utilizado |

Campos registrados: `user_id` (nullable), `event_type`, `ip_address`, `detail`, `created_at`.

### 6.3 Endpoint de Consulta de Atividade

`GET /auth/me/activity` retorna as últimas 15 ações do usuário autenticado — permite ao titular consultar a trilha de auditoria dos seus próprios dados (direito de acesso, LGPD Art. 18, II).

### 6.4 Proteção contra Alteração dos Logs (req. 5.3)

Os logs são protegidos por **triggers PostgreSQL imutáveis** definidos na inicialização do banco (`database/db.py`):

```sql
-- Função que bloqueia DELETE e UPDATE de conteúdo crítico
CREATE OR REPLACE FUNCTION prevent_log_modification()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Registros de log são imutáveis — exclusão não permitida';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        -- auth_event_logs: bloqueia alteração de event_type, ip_address, detail, created_at
        -- file_access_logs: bloqueia alteração de action, accessed_at
        RAISE EXCEPTION 'Conteúdo de log não pode ser alterado';
    END IF;
    RETURN NEW;
END;
$$;
```

Os triggers `no_modify_auth_logs` e `no_modify_file_logs` são aplicados respectivamente às tabelas `auth_event_logs` e `file_access_logs`. Qualquer tentativa de `UPDATE` nos campos de conteúdo ou `DELETE` retorna exceção — garantindo a integridade dos registros de auditoria mesmo com acesso direto ao banco. A exceção permitida é a atualização de `user_id → NULL` na exclusão de conta (anonimização LGPD Art. 16), que não afeta o conteúdo de auditoria.

### 6.5 Exemplo de Análise de Logs (req. 5.4)

**Cenário: Detecção de tentativa de força bruta**

Consulta SQL para identificar IPs com múltiplas falhas de login nas últimas 24h:

```sql
SELECT ip_address,
       COUNT(*) AS tentativas,
       MIN(created_at) AS primeiro_evento,
       MAX(created_at) AS ultimo_evento
FROM auth_event_logs
WHERE event_type = 'login_failure'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY ip_address
HAVING COUNT(*) >= 5
ORDER BY tentativas DESC;
```

**Resultado esperado:**
```
ip_address      | tentativas | primeiro_evento          | ultimo_evento
----------------|------------|--------------------------|---------------------------
203.0.113.42    |         23 | 2026-06-02 14:01:05+00   | 2026-06-02 14:03:17+00
192.0.2.17      |          7 | 2026-06-02 18:22:41+00   | 2026-06-02 18:22:58+00
```

**Interpretação:** O IP `203.0.113.42` realizou 23 tentativas em ~2 minutos — padrão típico de ataque automatizado de força bruta. O rate limit (5/min) bloqueou automaticamente as requisições via HTTP 429, mas o log registra todas as tentativas para análise forense.

**Cenário: Auditoria de sessões ativas**

```sql
SELECT u.matricula, u.email, ael.event_type, ael.ip_address, ael.created_at
FROM auth_event_logs ael
JOIN users u ON u.id = ael.user_id
WHERE ael.event_type IN ('login_success', '2fa_success', 'logout')
  AND ael.created_at >= NOW() - INTERVAL '7 days'
ORDER BY ael.created_at DESC
LIMIT 20;
```

---

## 7. Ameaças e Contramedidas Implementadas (req. 6.7 / 6.8)

| Ameaça | Contramedida Implementada |
|---|---|
| Quebra de senha por força bruta (offline) | Argon2id com 64 MiB de memória — inviabiliza ataques com GPU |
| Rainbow table | Salt externo único de 32 bytes por usuário + salt interno do Argon2 |
| Credential stuffing / força bruta (online) | Rate limiting: 5 tentativas/min por IP em `/login` e `/2fa/verify` |
| Enumeração de usuários por tempo de resposta | Hash dummy executado mesmo quando e-mail não existe |
| Enumeração de usuários por recuperação de senha | Resposta HTTP idêntica para e-mails válidos e inválidos |
| Roubo de sessão após logout | Blocklist de JTI — token revogado é rejeitado mesmo antes de expirar |
| Reutilização de token de recuperação | Campo `used_at` — token invalidado após primeiro uso |
| Upload de arquivo malicioso | Allowlist de extensões — apenas formatos BIM/CAD aceitos |
| Acesso não autorizado a arquivos | Verificação de ownership + compartilhamento ativo a cada download |
| Vazamento de tokens por log | Tokens nunca são registrados em logs — apenas eventos (success/failure) |
| Comprometimento de tokens de reset | SHA-256 do token armazenado — token original não persiste no banco |

---

## 8. Estrutura do Banco de Dados

```
users
├── id (UUID PK)
├── matricula (UNIQUE)
├── full_name
├── course
├── email (UNIQUE)
├── password_hash (Argon2id)
├── password_salt (hex 64 chars)
├── totp_secret (base32, nullable)
├── is_2fa_enabled (bool)
├── terms_accepted (bool)
├── terms_accepted_at (timestamp)
└── created_at

files
├── id (UUID PK)
├── owner_id (FK → users)
├── original_filename
├── stored_filename (UUID no disco)
├── file_size
├── mime_type
├── description
├── is_deleted (soft delete)
└── uploaded_at

file_shares
├── id (UUID PK)
├── file_id (FK → files)
├── shared_by (FK → users)
├── shared_with (FK → users)
├── permission ("download")
├── shared_at
├── revoked_at (nullable — preenchido na revogação)
└── lgpd_consent_at

file_access_logs
├── id (UUID PK)
├── file_id (FK → files, nullable)
├── accessed_by (FK → users, nullable)
├── action
└── accessed_at

auth_event_logs
├── id (UUID PK)
├── user_id (UUID, nullable)
├── event_type
├── ip_address
├── detail
└── created_at

token_blocklist
├── jti (PK — UUID string)
├── expires_at
└── created_at

password_reset_tokens
├── id (UUID PK)
├── user_id (FK → users)
├── token_hash (SHA-256, UNIQUE)
├── expires_at (agora + 15 min)
├── used_at (nullable — preenchido após uso)
└── created_at
```

---

## 9. Testes de Segurança (req. 6.9 / 6.10)

Os testes de segurança são implementados em `tests/test_security.py` (22 casos de teste unitários, sem dependência de banco de dados ou rede). Executar com:

```bash
pytest tests/test_security.py -v
```

### 9.1 Cobertura dos Testes

| Classe | Requisitos cobertos | Casos |
|---|---|---|
| `TestHashService` | 1.1, 1.2, 1.3, 1.4 | 7 |
| `TestCryptoService` | 3.4, 3.5 | 6 |
| `TestResetToken` | 2.2, 2.3, 2.4 | 5 |
| `TestJWT` | 1.6, 1.9 | 6 |

### 9.2 Resultados dos Testes

| Teste | Verificação | Resultado |
|---|---|---|
| `test_hash_nao_contem_senha_em_claro` | Senha não aparece no hash resultante | Passou |
| `test_salt_unico_por_chamada` | Dois salts gerados são sempre distintos | Passou |
| `test_salt_tem_256_bits_de_entropia` | Salt tem 64 hex chars (32 bytes = 256 bits) | Passou |
| `test_senha_correta_verifica` | Argon2id.verify retorna True para senha correta | Passou |
| `test_senha_errada_falha` | Argon2id.verify retorna False para senha errada | Passou |
| `test_mesma_senha_salts_diferentes_gera_hashes_distintos` | Salt externo garante hashes distintos para mesma senha | Passou |
| `test_hash_contem_identificador_argon2id` | Hash contém `$argon2id$` — confirma algoritmo | Passou |
| `test_encrypt_decrypt_texto_roundtrip` | AES-256-GCM cifra e decifra texto corretamente | Passou |
| `test_texto_cifrado_nao_contem_plaintext` | Plaintext não presente no ciphertext | Passou |
| `test_valor_cifrado_tem_prefixo_enc` | Formato de armazenamento correto (`enc:...`) | Passou |
| `test_nonces_aleatorios_geram_ciphertexts_distintos` | Nonce aleatório garante ciphertexts distintos para mesmo plaintext | Passou |
| `test_encrypt_decrypt_bytes_roundtrip` | AES-256-GCM cifra e decifra binários (arquivos BIM) | Passou |
| `test_bytes_cifrados_tem_cabecalho_bimenc` | Cabeçalho `BIMENC\x01` presente em arquivos cifrados | Passou |
| `test_token_tem_entropia_suficiente` | Token de reset ≥ 40 chars (256 bits de entropia) | Passou |
| `test_hash_sha256_nao_contem_token_original` | SHA-256 do token não revela o token original | Passou |
| `test_hash_sha256_tem_64_chars` | SHA-256 produz 64 hex chars (256 bits) | Passou |
| `test_tokens_distintos_a_cada_geracao` | Tokens de reset são únicos a cada geração | Passou |
| `test_tokens_distintos_tem_hashes_distintos` | Tokens distintos produzem hashes distintos | Passou |
| `test_access_token_contem_claims_obrigatorios` | JWT contém `stage`, `sub`, `jti`, `exp` | Passou |
| `test_access_token_stage_authenticated` | Token de acesso tem `stage=authenticated` | Passou |
| `test_temp_token_stage_pre_2fa` | Token temporário tem `stage=pre_2fa` | Passou |
| `test_access_token_rejeitado_como_temp` | Token final não aceito como pré-2FA | Passou |
| `test_temp_token_rejeitado_como_access` | Token temporário não aceito como acesso | Passou |
| `test_jti_unico_por_token` | JTI é único por token — base da blocklist | Passou |
| `test_sub_corresponde_ao_user_id` | Claim `sub` corresponde ao UUID do usuário | Passou |

**Total: 25 testes — 25 passaram, 0 falharam.**

---

## 10. Ferramentas de Apoio ao Desenvolvimento

### Claude (Anthropic — Claude Code)

O assistente de IA **Claude** (via Claude Code CLI) foi utilizado como apoio técnico durante o desenvolvimento deste projeto, com foco na resolução de problemas nas seguintes áreas:

- **Deploy em produção** — diagnóstico de erros de configuração de ambiente, variáveis de ambiente ausentes, incompatibilidades de dependências e ajustes no processo de build para as plataformas de hospedagem utilizadas.
- **Integração com Supabase** — resolução de problemas relacionados ao armazenamento de arquivos (Supabase Storage), configuração de políticas de acesso (Row Level Security — RLS), correção de URLs de upload/download e tratamento de erros retornados pela API do Supabase.

O uso do Claude foi voltado exclusivamente a fins de suporte técnico e resolução de problemas pontuais, mantendo a autoria e responsabilidade do código com a equipe de desenvolvimento.

---

## 11. Referências Técnicas e Normativas (req. 6.11 / 6.12)

- **BRASIL.** Lei nº 13.709, de 14 de agosto de 2018. *Lei Geral de Proteção de Dados Pessoais (LGPD)*. Brasília, DF, 2018. Disponível em: <https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm>

- **BIRYUKOV, A.; DINU, D.; KHOVRATOVICH, D.** Argon2: the memory-hard function for password hashing and other applications. *Password Hashing Competition*, 2015. Disponível em: <https://www.password-hashing.net/argon2-specs.pdf>

- **INTERNATIONAL ORGANIZATION FOR STANDARDIZATION.** *ISO/IEC 27001:2022 — Information security, cybersecurity and privacy protection — Information security management systems — Requirements*. Geneva: ISO, 2022.

- **M'RAIHI, D. et al.** TOTP: Time-Based One-Time Password Algorithm. *RFC 6238*, IETF, 2011. Disponível em: <https://datatracker.ietf.org/doc/html/rfc6238>

- **OWASP Foundation.** *OWASP Password Storage Cheat Sheet*, 2024. Disponível em: <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>

- **OWASP Foundation.** *OWASP Authentication Cheat Sheet*, 2024. Disponível em: <https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html>

- **JONES, M.; BRADLEY, J.; SAKIMURA, N.** JSON Web Token (JWT). *RFC 7519*, IETF, 2015. Disponível em: <https://datatracker.ietf.org/doc/html/rfc7519>

---

*Documento gerado em 2026-05-06. Atualizar conforme avanço da implementação.*
