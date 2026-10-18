#!/usr/bin/env bash
# Chạy MCP Supabase (chỉ ĐỌC) cho Claude Code. Token lấy từ .mcp.env ở gốc repo (file
# bị .gitignore, KHÔNG commit) — không có file thì dùng biến SUPABASE_ACCESS_TOKEN sẵn có.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$ROOT/.mcp.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.mcp.env"
  set +a
fi
exec npx -y @supabase/mcp-server-supabase@latest "$@"
