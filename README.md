# Prumo

Repositório seguro de projetos BIM para escritórios de arquitetura. Os arquivos são cifrados antes de serem gravados, o acesso exige autenticação em duas etapas e o compartilhamento é controlado por pessoa, com trilha de auditoria.

> Projeto Integrador da UMC (Políticas de Segurança da Informação, 2026), feito por Liandra Lourenço e Nader El Khechen e orientado pelo Prof. Dr. Fabiano Menegidio. Foi entregue com o nome **RASA** e depois redesenhado para portfólio.

## O que tem

- **Senhas** com Argon2id e salt por usuário
- **2FA obrigatório** via TOTP (Google Authenticator, Authy)
- **Arquivos cifrados** com AES-256-GCM antes de ir para o armazenamento
- **Compartilhamento** por matrícula, com consentimento LGPD e revogação a qualquer momento
- **Logs imutáveis**: um trigger no PostgreSQL impede apagar ou alterar registros de acesso
- **LGPD**: exportação dos dados pessoais e exclusão da conta pelo próprio usuário

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite |
| API | FastAPI (Python 3.12) |
| Banco | PostgreSQL (SQLAlchemy assíncrono) |
| Arquivos | Supabase Storage em produção, disco local em desenvolvimento |

Detalhes de arquitetura e segurança em [`DOCUMENTACAO_TECNICA.md`](DOCUMENTACAO_TECNICA.md).

## Rodar localmente

Não precisa de Docker, Homebrew nem conta em serviço externo. O banco roda embutido (pacote `pgserver`) e os arquivos ficam em `backend/uploads/`.

**Pré-requisitos:** Node 18+ e o [`uv`](https://docs.astral.sh/uv/) (`pip install --user uv`), que baixa o Python 3.12 sozinho.

### 1. Ambiente Python (uma vez)

```bash
uv python install 3.12
uv venv --python 3.12 backend/.venv
uv pip install --python backend/.venv/bin/python -r backend/requirements.txt pgserver
```

### 2. Arquivo `backend/.env` (uma vez)

```env
SECRET_KEY=<gere com: python3 -c "import secrets;print(secrets.token_urlsafe(48))">
DATABASE_URL=postgresql+asyncpg://postgres@/postgres?host=<caminho absoluto>/backend/.pgdata
STORAGE_BACKEND=local
ALLOWED_ORIGINS=http://localhost:5173
```

### 3. Subir tudo

```bash
./dev.sh
```

- **Frontend:** http://localhost:5173
- **API:** http://localhost:8000 (documentação interativa em `/docs`)

Crie uma conta em `/register` e escaneie o QR Code com o app autenticador do celular no primeiro login.

O `Ctrl+C` encerra a API e o frontend. O banco continua rodando em segundo plano e é reaproveitado na próxima vez. Para pará-lo:

```bash
backend/.venv/bin/python -c "import pgserver; pgserver.get_server('backend/.pgdata', cleanup_mode='stop')"
```

## Design

Baseado no design system **FutureUI**:
- **Página como card:** o app inteiro fica num card grande e arredondado, solto sobre um fundo cinza. Em telas menores, ocupa a tela toda.
- **Cores:** cinzas neutros, com laranja de destaque (`#FB923C` nos cards, `#EA580C` em links e ícones).
- **Tipografia:** Oswald nos títulos, Space Grotesk no texto, rótulos pequenos em caixa-alta e mono nos dados.
- **Botões:** pílulas com volume.
- **Painel:** os números ficam em cards escuros em grade (bento), com um card de destaque laranja.
- **Arquivos:** cada tipo tem sua cor.
- **Login:** foto com desfoque progressivo atrás do texto.

Em **Configurações › Aparência**, cada pessoa escolhe:
- **Tema:** claro, escuro ou igual ao do sistema operacional.
- **Cor de destaque:** laranja (padrão), azul, verde, turquesa, roxo, rosa ou amarelo, com prévia ao vivo.

No escuro, o card vira grafite e o botão principal inverte para uma pílula clara. A escolha fica salva no navegador e é aplicada antes da página aparecer, sem piscar. As cores ficam em `[data-accent]` no `index.css` e a lógica em `src/aparencia.js`.
