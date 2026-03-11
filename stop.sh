#!/bin/bash
# إيقاف سيرفر DFA Pro المحلي

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -f /tmp/dfapro.pid ]; then
  PID=$(cat /tmp/dfapro.pid)
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    rm /tmp/dfapro.pid
    echo -e "${GREEN}✔ تم إيقاف السيرفر (PID: $PID)${NC}"
  else
    echo -e "${YELLOW}⚠ السيرفر لم يكن يعمل${NC}"
    rm -f /tmp/dfapro.pid
  fi
else
  # try by port
  PID=$(lsof -ti:8080 2>/dev/null || true)
  if [ -n "$PID" ]; then
    kill "$PID"
    echo -e "${GREEN}✔ تم إيقاف السيرفر على المنفذ 8080 (PID: $PID)${NC}"
  else
    echo -e "${YELLOW}⚠ لا يوجد سيرفر يعمل على المنفذ 8080${NC}"
  fi
fi
