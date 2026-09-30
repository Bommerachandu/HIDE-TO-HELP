@echo off
title Parasitic AI Launcher

echo.
echo ========================================
echo   Parasitic AI - Background Assistant
echo ========================================
echo.

REM Check if Ollama is running
echo Checking Ollama...
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Ollama not detected on localhost:11434
    echo Please start Ollama in a separate terminal:
    echo   ollama serve
    echo.
    echo Press any key to continue anyway, or Ctrl+C to exit...
    pause >nul
) else (
    echo [OK] Ollama is running
)

echo.
echo Starting Parasitic AI...
echo.

REM Start Python backend in background
echo Starting Python backend...
cd python
start "Parasitic AI Python Backend" cmd /k python main.py
cd ..

REM Wait a moment for Python to start
timeout /t 3 /nobreak >nul

REM Start Electron app
echo Starting Electron app...
npm run dev

echo.
echo Parasitic AI stopped.
pause