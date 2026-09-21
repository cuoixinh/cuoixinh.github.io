#!/usr/bin/env bash
# Đưa nhánh staging lên production: merge staging-cuoixinh.github.io vào
# cuoixinh.github.io rồi push. Kết thúc là quay về đúng nhánh lúc bắt đầu.
#
#   npm run production                 → hỏi lại trước khi merge
#   npm run production -- --yes        → không hỏi (CI, hoặc đã biết chắc)
#   npm run production -- --no-ff      → ép tạo commit merge để lịch sử thấy rõ đợt đẩy
#
# Ba cửa CHẶN trước khi đụng tới nhánh production, đều là thứ sai một lần là
# khách gặp lỗi thật:
#   1. Cây làm việc bẩn — đổi nhánh sẽ kéo theo file đang sửa dở sang production.
#   2. Nhánh staging lệch remote — merge bản thiếu commit, hoặc push đè lên người
#      khác. (Riêng nhánh production thiếu commit thì script tự pull cho.)
#   3. CX_VERSION không đổi — người dùng nhận bản TRỘN (partial mới + script cũ),
#      trang vỡ chứ không phải chỉ trông cũ. Xem mục "Phiên bản & cache" ở CLAUDE.md.
#
# Script CHỈ lo phần git. Thứ tự khi một thay đổi đụng nhiều tầng vẫn là
# SQL → Edge Function → web, nên nó liệt kê những thay đổi thuộc hai tầng đầu
# để mình xác nhận đã chạy chúng trước khi web production đổi.
set -euo pipefail

STAGING_BRANCH="staging-cuoixinh.github.io"
PROD_BRANCH="cuoixinh.github.io"
REMOTE="origin"

YES=0
MERGE_FLAGS=()
SKIP_VERSION=0
for a in "$@"; do
  case "$a" in
    --yes|-y) YES=1 ;;
    --no-ff) MERGE_FLAGS+=("--no-ff") ;;
    --skip-version-check) SKIP_VERSION=1 ;;
    *) echo "✗ Cờ lạ: $a" >&2; exit 1 ;;
  esac
done

die() { echo "" >&2; echo "✗ $1" >&2; exit 1; }

# ── 1. Cây làm việc phải sạch ────────────────────────────────────────────────
[ -z "$(git status --porcelain)" ] || die "Còn thay đổi chưa commit. Commit hoặc \`git stash\` trước:
$(git status --short)"

START_BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "→ Lấy bản mới nhất từ $REMOTE..."
git fetch --quiet "$REMOTE"

# ── 2a. Kéo nhánh production về cho mới ──────────────────────────────────────
# Nhánh production hầu như không sửa tay ở local, nên nó thiếu commit chỉ là do
# chưa pull — tự kéo luôn thay vì bắt dừng. `--ff-only` để nếu local LỆCH thật
# (có commit riêng) thì fail ở đây chứ không đẻ ra merge commit ngoài ý muốn.
if [ "$(git rev-list --count "$PROD_BRANCH..$REMOTE/$PROD_BRANCH")" -gt 0 ]; then
  echo "→ Cập nhật $PROD_BRANCH từ $REMOTE..."
  if [ "$START_BRANCH" = "$PROD_BRANCH" ]; then
    git merge --ff-only "$REMOTE/$PROD_BRANCH" || die "'$PROD_BRANCH' lệch $REMOTE — gỡ tay rồi chạy lại."
  else
    git checkout --quiet "$PROD_BRANCH"
    if ! git merge --ff-only "$REMOTE/$PROD_BRANCH"; then
      git checkout --quiet "$START_BRANCH"
      die "'$PROD_BRANCH' lệch $REMOTE — gỡ tay rồi chạy lại. Đang ở lại nhánh $START_BRANCH."
    fi
    git checkout --quiet "$START_BRANCH"
  fi
fi

# ── 2. Hai nhánh local phải khớp remote ──────────────────────────────────────
# Merge từ nhánh LOCAL (không phải origin/) để thứ đẩy lên đúng là thứ vừa test;
# vì vậy local lệch remote là phải dừng, không tự đoán bên nào đúng.
for b in "$STAGING_BRANCH" "$PROD_BRANCH"; do
  git rev-parse --verify --quiet "$b" >/dev/null || die "Không có nhánh local '$b'."
  behind=$(git rev-list --count "$b..$REMOTE/$b")
  ahead=$(git rev-list --count "$REMOTE/$b..$b")
  [ "$behind" -eq 0 ] || die "'$b' đang thiếu $behind commit so với $REMOTE/$b — \`git pull\` trước."
  if [ "$b" = "$STAGING_BRANCH" ] && [ "$ahead" -gt 0 ]; then
    die "'$b' có $ahead commit chưa push. Push trước để bản trên staging đúng là bản sắp lên production."
  fi
done

COUNT=$(git rev-list --count "$PROD_BRANCH..$STAGING_BRANCH")
[ "$COUNT" -gt 0 ] || { echo "✓ Production đã có mọi commit của staging — không có gì để merge."; exit 0; }

# ── 3. CX_VERSION phải khác bản đang chạy ở production ───────────────────────
ver_of() {
  git show "$1:core/config.js" 2>/dev/null |
    sed -n 's/^const CX_VERSION = "\(.*\)";$/\1/p' | head -1
}
NEW_VER=$(ver_of "$STAGING_BRANCH")
OLD_VER=$(ver_of "$PROD_BRANCH")
if [ "$SKIP_VERSION" -eq 0 ] && [ -n "$OLD_VER" ] && [ "$NEW_VER" = "$OLD_VER" ]; then
  die "CX_VERSION vẫn là \"$NEW_VER\" như bản production đang chạy.
   Sửa core/config.js trên $STAGING_BRANCH rồi commit, nếu không khách có thể
   nhận partial mới đi với script cũ. Cố tình bỏ qua: thêm -- --skip-version-check"
fi

# ── 3b. Bản override môi trường phải còn khớp config.js ──────────────────────
# Đọc từ nhánh STAGING (thứ sắp đẩy), không phải cây làm việc. Bắt hai ca: thêm
# khoá vào config.js mà quên khai lại bên staging (override gán đè trọn object
# nên staging lặng lẽ mất khoá), và staging còn trỏ vào project/worker của
# production. Cả hai đều chỉ lộ ra khi đã chạy thật.
echo "→ Đối chiếu config môi trường..."
if ! git show "$STAGING_BRANCH:scripts/check-config-env.mjs" >/dev/null 2>&1; then
  echo "  (bỏ qua: $STAGING_BRANCH chưa có scripts/check-config-env.mjs)"
elif ! node scripts/check-config-env.mjs --ref "$STAGING_BRANCH"; then
  die "Config môi trường không khớp — xem danh sách ở trên. Sửa trên $STAGING_BRANCH rồi chạy lại."
fi

# ── 4. Cho xem sắp đẩy cái gì ────────────────────────────────────────────────
echo ""
echo "  $STAGING_BRANCH → $PROD_BRANCH   ($COUNT commit)"
echo "  CX_VERSION: ${OLD_VER:-?} → ${NEW_VER:-?}"
echo ""
git log --oneline --no-decorate "$PROD_BRANCH..$STAGING_BRANCH" | sed 's/^/  /'

CHANGED=$(git diff --name-only "$PROD_BRANCH...$STAGING_BRANCH")
sql=$(echo "$CHANGED" | grep -c '^changelogs/.*\.sql$' || true)
fns=$(echo "$CHANGED" | grep '^supabase/functions/' | cut -d/ -f3 | sort -u || true)
if [ "$sql" -gt 0 ] || [ -n "$fns" ]; then
  echo ""
  echo "  ⚠ Đợt này đụng tầng dưới — phải làm XONG trên production TRƯỚC khi web đổi:"
  [ "$sql" -gt 0 ] && echo "     · $sql file changelog SQL → tự chạy trên Dashboard của project production"
  [ -n "$fns" ] && echo "     · Edge Function: $(echo "$fns" | tr '\n' ' ')→ npm run deploy:functions:all"
fi

# ── 5. Xác nhận ──────────────────────────────────────────────────────────────
if [ "$YES" -eq 0 ]; then
  [ -t 0 ] || die "Không có bàn phím (không phải terminal) — chạy lại với -- --yes nếu thật sự muốn đẩy."
  echo ""
  read -r -p "Merge và push lên $PROD_BRANCH? [y/N] " ans
  case "$ans" in [yY]*) ;; *) echo "Đã huỷ."; exit 0 ;; esac
fi

# ── 6. Merge + push ──────────────────────────────────────────────────────────
# Đụng độ thì DỪNG ngay ở nhánh production cho mình xử lý tay — tự nhảy về nhánh
# cũ lúc đang merge dở là mất trạng thái, khó gỡ hơn nhiều.
echo ""
git checkout "$PROD_BRANCH"
git merge "${MERGE_FLAGS[@]+"${MERGE_FLAGS[@]}"}" "$STAGING_BRANCH"
git push "$REMOTE" "$PROD_BRANCH"
git checkout "$START_BRANCH"

echo ""
echo "✓ Đã đẩy lên $PROD_BRANCH (Cloudflare Workers Builds tự build từ đây)."
echo "  Đang ở lại nhánh $START_BRANCH."
