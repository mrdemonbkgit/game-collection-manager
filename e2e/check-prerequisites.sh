#!/bin/bash
# QA Prerequisites Check
# Run this before starting E2E tests to verify environment is ready

echo "Checking QA prerequisites..."
echo ""

ERRORS=0

# Check backend
echo -n "Backend (localhost:3001): "
if curl -s http://localhost:3001/api/health | grep -q "success"; then
    echo "[OK]"
else
    echo "[FAIL] - Start with: npm run dev:server"
    ERRORS=$((ERRORS + 1))
fi

# Check frontend
echo -n "Frontend (localhost:5173): "
if curl -s http://localhost:5173 2>/dev/null | grep -q "html"; then
    echo "[OK]"
else
    echo "[FAIL] - Start with: npm run dev:client"
    ERRORS=$((ERRORS + 1))
fi

# Check database has games
echo -n "Database: "
GAME_COUNT=$(curl -s http://localhost:3001/api/games/count 2>/dev/null | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
if [ -n "$GAME_COUNT" ] && [ "$GAME_COUNT" -gt 0 ]; then
    echo "[OK] - $GAME_COUNT games"
else
    echo "[WARN] - Empty or unavailable. Run: curl -X POST http://localhost:3001/api/sync/steam/quick"
fi

echo ""

if [ $ERRORS -eq 0 ]; then
    echo "Prerequisites met!"
    echo ""
    echo "To run QA tests:"
    echo "  1. Start Claude with Chrome: claude --chrome"
    echo "  2. Invoke the QA skill: /qa"
    exit 0
else
    echo "Prerequisites not met. Fix the issues above and try again."
    exit 1
fi
