#!/usr/bin/env bash
# Junta todas as migrations (em ordem) num único arquivo para colar no SQL Editor do Supabase.
# Uso: npm run db:bundle  → supabase/dist/schema.sql
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$ROOT/supabase/dist"
OUT="$ROOT/supabase/dist/schema.sql"
{
  echo "-- Gerado por scripts/db/bundle.sh em $(date -u +%Y-%m-%dT%H:%MZ). Execute uma única vez num projeto novo."
  for f in "$ROOT"/supabase/migrations/*.sql; do
    echo; echo "-- >>> $(basename "$f")"; cat "$f"
  done
} > "$OUT"
echo "✓ $OUT"
