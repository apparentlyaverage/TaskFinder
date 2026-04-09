@echo off
REM ─────────────────────────────────────────────────────────
REM TaskFinder — Windows Installer
REM Double-click this file or run: install.bat
REM ─────────────────────────────────────────────────────────

echo.
echo  TaskFinder - Frontend Installer
echo  ─────────────────────────────────
echo.

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed.
    echo  Please download and install Node.js 18+ from:
    echo  https://nodejs.org/en/download
    echo.
    pause
    exit /b 1
)

for /f "tokens=1 delims=v." %%i in ('node -v') do set NODE_MAJOR=%%i
echo  [OK] Node.js detected

REM Check npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] npm not found. Please reinstall Node.js.
    pause
    exit /b 1
)
echo  [OK] npm detected

REM Install dependencies
echo.
echo  Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo  [ERROR] npm install failed. Check your internet connection.
    pause
    exit /b 1
)
echo  [OK] Dependencies installed

REM Create .env if missing
if not exist .env (
    echo  Creating .env...
    (
        echo # TaskFinder Environment Variables
        echo # Fill in only when connecting to your live backend.
        echo VITE_API_URL=http://localhost:8080
        echo VITE_SOCKET_URL=http://localhost:3004
    ) > .env
    echo  [OK] .env created
)

echo.
echo  ─────────────────────────────────
echo  Installation complete!
echo.
echo  To start the app, run:
echo     npm run dev
echo.
echo  Then open: http://localhost:3000
echo.
echo  Demo login presets:
echo    Creator  -  creator@demo.com
echo    Earner   -  earner@demo.com
echo    Admin    -  admin@demo.com
echo  (any password works in demo mode)
echo.
pause
