#!/bin/bash
# Sobe o Prumo inteiro na máquina: banco (PostgreSQL embutido), API e frontend.
# Uso: ./dev.sh   (Ctrl+C encerra a API e o frontend; o banco continua rodando)
set -e
cd "$(dirname "$0")"

if [ ! -x backend/.venv/bin/python ]; then
  echo "Ambiente Python não encontrado. Veja a seção 'Rodar localmente' do README."
  exit 1
fi

echo "→ Banco de dados"
backend/.venv/bin/python -c "import pgserver; pgserver.get_server('backend/.pgdata', cleanup_mode=None)"

echo "→ API em http://localhost:8000 (docs em /docs)"
backend/.venv/bin/uvicorn backend.main:app --reload --reload-dir backend --port 8000 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT

echo "→ Frontend em http://localhost:5173"
cd frontend
[ -d node_modules ] || npm install
npx vite --port 5173
