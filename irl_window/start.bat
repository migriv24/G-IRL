@echo off
echo Starting IRL_Window...

:: Start backend
start "IRL_Window Backend" cmd /k "cd /d %~dp0 && python -m uvicorn backend.main:app --reload --port 8000"

:: Wait a moment then start frontend dev server
timeout /t 2 /nobreak >nul
start "IRL_Window Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

:: Wait for frontend dev server to be ready, then open browser
timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"
