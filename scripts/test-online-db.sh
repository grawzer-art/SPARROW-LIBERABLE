#!/usr/bin/env bash
# Teste le schéma SPARROW ONLINE (tables, RLS, fonctions serveur) sur un PostgreSQL 16 local jetable.
# Usage : bash scripts/test-online-db.sh   (nécessite les binaires PostgreSQL 16)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
DIR="$(mktemp -d)"
PORT="${PG_PORT:-54329}"
RUN=""
if [ "$(id -u)" = "0" ]; then chown postgres "$DIR"; RUN="su postgres -s /bin/bash -c"; fi
run() { if [ -n "$RUN" ]; then $RUN "$*"; else bash -c "$*"; fi; }
cleanup() { run "$BIN/pg_ctl -D $DIR/data -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT
run "$BIN/initdb -D $DIR/data -U postgres -A trust" >/dev/null
run "$BIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR -c listen_addresses=' -l $DIR/log -w start" >/dev/null
PSQL="psql -h $DIR -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -t -o /dev/null"
$PSQL -c "create database online"
$PSQL -d online -f "$ROOT/supabase/tests/00_emulate_supabase.sql"
$PSQL -d online -f "$ROOT/supabase/migrations/20261018000000_sparrow_online.sql"
$PSQL -d online -f "$ROOT/supabase/tests/10_rls_test.sql" 2>&1 | sed 's/^psql:[^:]*:[0-9]*: //'
