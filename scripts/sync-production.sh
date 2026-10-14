#!/usr/bin/env bash
# Chép TRỌN source của staging sang nhánh production, để lại thành thay đổi CHƯA
# commit (đã stage) cho mình xem rồi tự commit + push. Dùng khi production lệch
# staging (sửa tay, gỡ đụng độ sai…) mà `npm run production` (git merge) không gỡ được:
# file nào khác bị ghi đè, file production có mà staging không có bị xoá.
#
#   npm run sync-production
#
# Không commit, không push. Kết thúc là ĐỨNG Ở nhánh production (thay đổi nằm ở đó).
# File untracked/ignored trên máy không bị đụng tới.
set -euo pipefail

STAGING_BRANCH="staging-cuoixinh.github.io"
PROD_BRANCH="cuoixinh.github.io"
REMOTE="origin"

SKIP_VERSION=0
for a in "$@"; do
  case "$a" in
    --skip-version-check) SKIP_VERSION=1 ;;
    *) echo "✗ Cờ lạ: $a" >&2; exit 1 ;;
  esac
done

die() { echo "" >&2; echo "✗ $1" >&2; exit 1; }

# Cây phải sạch: thay đổi sắp sinh ra phải là thay đổi của đợt đồng bộ, không trộn đồ dở.
[ -z "$(git status --porcelain)" ] || die "Còn thay đổi chưa commit. Commit hoặc \`git stash\` trước:
$(git status --short)"

echo "→ Lấy bản mới nhất từ $REMOTE..."
git fetch --quiet "$REMOTE"

# Staging local phải đúng là bản trên remote (bản đã chạy trên staging).
git rev-parse --verify --quiet "$STAGING_BRANCH" >/dev/null || die "Không có nhánh local '$STAGING_BRANCH'."
behind=$(git rev-list --count "$STAGING_BRANCH..$REMOTE/$STAGING_BRANCH")
ahead=$(git rev-list --count "$REMOTE/$STAGING_BRANCH..$STAGING_BRANCH")
[ "$behind" -eq 0 ] || die "'$STAGING_BRANCH' đang thiếu $behind commit so với $REMOTE — \`git pull\` trước."
[ "$ahead" -eq 0 ] || die "'$STAGING_BRANCH' có $ahead commit chưa push. Push trước để bản trên staging đúng là bản sắp lên production."

# CX_VERSION phải khác bản production đang chạy (xem "Phiên bản & cache" ở CLAUDE.md).
ver_of() {
  git show "$1:core/config.js" 2>/dev/null |
    sed -n 's/^const CX_VERSION = "\(.*\)";$/\1/p' | head -1
}
NEW_VER=$(ver_of "$STAGING_BRANCH")
OLD_VER=$(ver_of "$REMOTE/$PROD_BRANCH")

if [ "$(git rev-parse "$STAGING_BRANCH^{tree}")" = "$(git rev-parse "$REMOTE/$PROD_BRANCH^{tree}")" ]; then
  echo "✓ Source production đã giống 100% staging — không có gì để đồng bộ."
  exit 0
fi

if [ "$SKIP_VERSION" -eq 0 ] && [ -n "$OLD_VER" ] && [ "$NEW_VER" = "$OLD_VER" ]; then
  die "CX_VERSION vẫn là \"$NEW_VER\" như bản production đang chạy.
   Sửa core/config.js trên $STAGING_BRANCH rồi commit. Cố tình bỏ qua: thêm -- --skip-version-check"
fi

echo "→ Đối chiếu config môi trường..."
if ! git show "$STAGING_BRANCH:scripts/check-config-env.mjs" >/dev/null 2>&1; then
  echo "  (bỏ qua: $STAGING_BRANCH chưa có scripts/check-config-env.mjs)"
elif ! node scripts/check-config-env.mjs --ref "$STAGING_BRANCH"; then
  die "Config môi trường không khớp — xem danh sách ở trên. Sửa trên $STAGING_BRANCH rồi chạy lại."
fi

# Sang nhánh production, kéo cho khớp remote (--ff-only: local lệch thật thì dừng).
git rev-parse --verify --quiet "$PROD_BRANCH" >/dev/null || die "Không có nhánh local '$PROD_BRANCH'."
git checkout --quiet "$PROD_BRANCH"
if [ "$(git rev-list --count "$PROD_BRANCH..$REMOTE/$PROD_BRANCH")" -gt 0 ]; then
  echo "→ Cập nhật $PROD_BRANCH từ $REMOTE..."
  git merge --ff-only --quiet "$REMOTE/$PROD_BRANCH" || die "'$PROD_BRANCH' lệch $REMOTE — gỡ tay rồi chạy lại."
fi

# Index + cây làm việc = đúng cây của staging; path có ở production mà staging
# không có thì bị xoá.
git restore --source="$STAGING_BRANCH" --staged --worktree -- :/

echo ""
echo "  $PROD_BRANCH  ⇐  source của $STAGING_BRANCH   (CX_VERSION: ${OLD_VER:-?} → ${NEW_VER:-?})"
echo ""
git diff --cached --stat=100 | sed 's/^/  /'

GONE=$(git diff --cached --name-only --diff-filter=D)
if [ -n "$GONE" ]; then
  echo ""
  echo "  ⚠ File production có mà staging KHÔNG có — đã XOÁ:"
  echo "$GONE" | sed 's/^/     - /'
fi

CHANGED=$(git diff --cached --name-only)
sql=$(echo "$CHANGED" | grep -c '^changelogs/.*\.sql$' || true)
fns=$(echo "$CHANGED" | grep '^supabase/functions/' | cut -d/ -f3 | sort -u || true)
if [ "$sql" -gt 0 ] || [ -n "$fns" ]; then
  echo ""
  echo "  ⚠ Đợt này đụng tầng dưới — phải làm XONG trên production TRƯỚC khi push:"
  [ "$sql" -gt 0 ] && echo "     · $sql file changelog SQL → tự chạy trên Dashboard của project production"
  [ -n "$fns" ] && echo "     · Edge Function: $(echo "$fns" | tr '\n' ' ')→ npm run deploy:functions:all"
fi

echo ""
echo "✓ Thay đổi đã stage trên nhánh $PROD_BRANCH (chưa commit, chưa push)."
echo "  Xem lại rồi: git commit -m \"Đồng bộ production = staging\" && git push"
echo "  Bỏ đợt này: git reset --hard HEAD"
