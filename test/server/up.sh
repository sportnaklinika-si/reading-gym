#!/bin/bash
# Starts a local Postgres 17 + PostgREST (the same API layer Supabase uses) on http://127.0.0.1:3000 with schema.sql loaded twice
# (the second run checks it is safe to repeat). Stop with: docker rm -f bm-db bm-api; docker network rm bm-test
set -e
cd "$(dirname "$0")"
W=$(cygpath -w "$PWD/../../server" 2>/dev/null || echo "$PWD/../../server"); T=$(cygpath -w "$PWD" 2>/dev/null || echo "$PWD")
docker rm -f bm-db bm-api >/dev/null 2>&1 || true
docker network create bm-test >/dev/null 2>&1 || true
MSYS_NO_PATHCONV=1 docker run -d --name bm-db --network bm-test --memory=256m -e POSTGRES_PASSWORD=pw -v "$W:/srv:ro" -v "$T:/t:ro" postgres:17-alpine >/dev/null
until docker exec bm-db pg_isready -U postgres -q 2>/dev/null; do sleep 1; done; sleep 2
until docker exec bm-db psql -U postgres -qtAc 'select 1' >/dev/null 2>&1; do sleep 1; done
MSYS_NO_PATHCONV=1 docker exec bm-db psql -U postgres -v ON_ERROR_STOP=1 -q -f /t/supabase-roles.sql
MSYS_NO_PATHCONV=1 docker exec bm-db psql -U postgres -v ON_ERROR_STOP=1 -q -f /srv/schema.sql
MSYS_NO_PATHCONV=1 docker exec bm-db psql -U postgres -v ON_ERROR_STOP=1 -q -f /srv/schema.sql
MSYS_NO_PATHCONV=1 docker run -d --name bm-api --network bm-test --memory=128m -p 127.0.0.1:3000:3000 -e PGRST_DB_URI=postgres://authenticator:pw@bm-db:5432/postgres -e PGRST_DB_ANON_ROLE=anon -e PGRST_DB_SCHEMAS=public postgrest/postgrest:v12.2.12 >/dev/null
until curl -s -o /dev/null http://127.0.0.1:3000/; do sleep 1; done
echo "API up on http://127.0.0.1:3000"
