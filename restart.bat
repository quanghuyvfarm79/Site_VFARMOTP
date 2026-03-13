@echo off
cd /d "%~dp0"
echo ============================================
echo  VFRAMOTP - Rebuild + Restart
echo ============================================

echo [1/4] Killing old processes...
taskkill /F /IM vframotp.exe >nul 2>&1
taskkill /F /IM worker.exe   >nul 2>&1
taskkill /F /IM main.exe     >nul 2>&1
timeout /t 1 /nobreak >nul

echo [2/4] Building API...
go build -o vframotp.exe ./cmd/api/
if %ERRORLEVEL% neq 0 (
    echo ERROR: API build failed!
    pause
    exit /b 1
)

echo [3/4] Building Worker...
go build -o worker.exe ./cmd/worker/
if %ERRORLEVEL% neq 0 (
    echo ERROR: Worker build failed!
    pause
    exit /b 1
)

echo [4/4] Starting services...
start "VFRAMOTP API" /min vframotp.exe
timeout /t 1 /nobreak >nul
start "VFRAMOTP Worker" /min worker.exe

timeout /t 2 /nobreak >nul

echo.
echo Checking health...
curl -s http://localhost:8080/health
echo.
echo ============================================
echo  Done! API + Worker are running.
echo ============================================
pause
