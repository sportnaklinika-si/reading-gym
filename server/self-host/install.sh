#!/bin/bash
# Installs or updates the friends' server in this folder (on the VPS: /opt/bralni-mentor). Safe to run again, for example
# after a new schema.sql: the data stays, the functions are replaced. Needs Docker with the compose plugin.
#   ./install.sh            containers + database + API on 127.0.0.1:$API_PORT
# HTTPS in front of it: see nginx-bralni-mentor.conf and cert.sh.
set -euo pipefail
cd "$(dirname "$0")"
SCHEMA=schema.sql; [ -f "$SCHEMA" ] || SCHEMA=../schema.sql
[ -f "$SCHEMA" ] || { echo "schema.sql is missing"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker with the compose plugin is missing (Ubuntu: apt install docker.io docker-compose-v2)"; exit 1; }

if [ ! -f .env ]; then
  ( umask 077
    { echo "DB_PASSWORD=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
      echo "API_PASSWORD=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
      echo "API_PORT=${API_PORT:-3000}"; } > .env )
  echo "Made .env with new passwords."
fi
set -a; . ./.env; set +a
mkdir -p backups

docker compose up -d db
for i in $(seq 60); do docker compose exec -T db pg_isready -U postgres -q 2>/dev/null && break; sleep 1; done
for i in $(seq 30); do docker compose exec -T db psql -U postgres -qtAc 'select 1' >/dev/null 2>&1 && break; sleep 1; done
docker compose exec -T db psql -U postgres -v ON_ERROR_STOP=1 -q -v api_pw="$API_PASSWORD" < roles.sql
docker compose exec -T db psql -U postgres -v ON_ERROR_STOP=1 -q < "$SCHEMA" 2>&1 | grep -v 'already exists, skipping' || true
docker compose up -d
docker compose exec -T db psql -U postgres -qc "notify pgrst, 'reload schema'"

for i in $(seq 30); do
  if [ "$(curl -fsS -X POST -H 'Content-Type: application/json' -d '{}' "http://127.0.0.1:$API_PORT/rpc/bm_ping" 2>/dev/null)" = '"ok"' ]; then
    echo "Friends' API is up on http://127.0.0.1:$API_PORT"; exit 0
  fi
  sleep 1
done
echo "The API did not answer. Look at: docker compose logs api"; exit 1
