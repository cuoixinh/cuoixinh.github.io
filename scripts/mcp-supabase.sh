#!/usr/bin/env bash
# Chạy MCP Supabase (chỉ ĐỌC) cho Claude Code. Token lấy từ .mcp.env ở gốc repo (file
# bị .gitignore, KHÔNG commit) — không có file thì dùng biến SUPABASE_ACCESS_TOKEN sẵn có.
# Phiên cloud không có cả hai: token thật là secret của môi trường, proxy tự gắn vào mọi
# request tới api.supabase.com, nên ở đây chỉ cần một giá trị giả cho server chịu chạy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$ROOT/.mcp.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.mcp.env"
  set +a
fi
: "${SUPABASE_ACCESS_TOKEN:=proxy-injected}"
export SUPABASE_ACCESS_TOKEN
exec npx -y @supabase/mcp-server-supabase@latest "$@"
