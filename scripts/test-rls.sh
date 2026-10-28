#!/usr/bin/env bash
# Roda a migração num Postgres local com um "stub" mínimo do Supabase
# e executa os cenários de permissão (equipe, cliente, coluna só da equipe).
# Uso: PGHOST=... PGPORT=... PGUSER=postgres scripts/test-rls.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-trametrello_test}
psql -v ON_ERROR_STOP=1 -q -c "drop database if exists $DB" -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/supabase_stub.sql
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"; done
psql -d "$DB" -f supabase/tests/rls_scenarios.sql
