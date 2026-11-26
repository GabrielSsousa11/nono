#!/usr/bin/env bash
# Aplica todas as migrations em um Postgres descartável e roda supabase/tests/*.test.sql.
# Requer binários do PostgreSQL (initdb/pg_ctl/psql). Uso: npm run test:db
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
TMP="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
RUNAS=()
if [ "$(id -u)" = "0" ]; then chown -R postgres "$TMP" 2>/dev/null || true; RUNAS=(runuser -u postgres --); chmod 755 "$TMP"; fi
"${RUNAS[@]}" "$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
PSQL=("${RUNAS[@]}" "$PGBIN/psql" -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/supabase/tests/stub_supabase.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do echo "→ migration $(basename "$f")"; "${PSQL[@]}" -f "$f"; done
for f in $(ls "$ROOT"/supabase/tests/*.test.sql | sort -V); do echo "→ teste $(basename "$f")"; "${PSQL[@]}" -t -f "$f"; done
