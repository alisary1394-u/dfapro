#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# DFA Pro — سكريبت التحديث التلقائي للسيرفر المحلي
# الاستخدام: bash update.sh
# ═══════════════════════════════════════════════════════════════

set -e

# ── الألوان ──────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

step() { echo -e "\n${CYAN}${BOLD}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✔ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
err()  { echo -e "${RED}✘ $1${NC}"; exit 1; }

echo -e "\n${BOLD}═══════════════════════════════════════════════"
echo -e "     DFA Pro — تحديث السيرفر المحلي"
echo -e "═══════════════════════════════════════════════${NC}"

# ── 1. جلب آخر التحديثات من GitHub ──────────────────────────
step "جلب آخر التحديثات من GitHub..."
if [ -d ".git" ]; then
  git fetch origin
  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "")

  if [ -z "$REMOTE" ]; then
    warn "لا يوجد branch بعيد باسم: $BRANCH — تخطي git pull"
  elif [ "$LOCAL" = "$REMOTE" ]; then
    ok "الكود محدّث بالفعل (لا توجد تحديثات جديدة)"
  else
    git pull origin "$BRANCH"
    ok "تم تحديث الكود من الفرع: $BRANCH"
  fi
else
  warn "هذا المجلد ليس git repo — تخطي git pull"
fi

# ── 2. تثبيت الحزم إن وجدت تغييرات ─────────────────────────
step "التحقق من حزم npm..."
if [ -f "package-lock.json" ]; then
  npm ci --prefer-offline 2>/dev/null || npm install
  ok "تم تحديث الحزم"
else
  npm install
  ok "تم تثبيت الحزم"
fi

# ── 3. بناء التطبيق ──────────────────────────────────────────
step "بناء التطبيق (npm run build)..."
npm run build
ok "تم البناء بنجاح → مجلد dist/"

# ── 4. إيقاف السيرفر القديم إن كان يعمل ─────────────────────
step "التحقق من السيرفر القديم على المنفذ 8080..."
OLD_PID=$(lsof -ti:8080 2>/dev/null || true)
if [ -n "$OLD_PID" ]; then
  kill "$OLD_PID" 2>/dev/null || true
  sleep 1
  ok "تم إيقاف السيرفر القديم (PID: $OLD_PID)"
else
  ok "لا يوجد سيرفر قديم على المنفذ 8080"
fi

# ── 5. تشغيل السيرفر الجديد ──────────────────────────────────
step "تشغيل السيرفر على المنفذ 8080..."
PORT=8080 node server/index.js &
NEW_PID=$!
echo $NEW_PID > /tmp/dfapro.pid
sleep 2

# التحقق من أن السيرفر يعمل
if kill -0 "$NEW_PID" 2>/dev/null; then
  ok "السيرفر يعمل على: http://localhost:8080"
  echo -e "\n${GREEN}${BOLD}═══════════════════════════════════════════════"
  echo -e "  ✔ تم التحديث بنجاح!"
  echo -e "  🌐 افتح: http://localhost:8080"
  echo -e "  🛑 للإيقاف: kill $NEW_PID   أو: bash stop.sh"
  echo -e "═══════════════════════════════════════════════${NC}"
else
  err "فشل تشغيل السيرفر — راجع الأخطاء أعلاه"
fi
