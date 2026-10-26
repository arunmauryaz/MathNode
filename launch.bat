@echo off
setlocal
title Math Node

:: Navigate to script directory
cd /d "%~dp0"

echo ======================================================
echo                  MATH NODE PLATFORM
echo ======================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in your system PATH.
    echo Please download and install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Install dependencies if not already installed
if not exist "node_modules" (
    echo [SETUP] node_modules not found. Installing dependencies...
    call npm.cmd install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
    echo.
)

echo [START] Starting dev server and opening Math Node...
echo Local URL: http://localhost:3000
echo (Keep this window open while using Math Node. Press Ctrl+C to exit.)
echo.

:: Launch Vite dev server and automatically open the default browser
call npm.cmd run dev -- --open

if %errorlevel% neq 0 (
    echo.
    echo [INFO] Server stopped.
)

pause
