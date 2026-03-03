@echo off
setlocal
title ShengMo Launcher

echo ====================================================================
echo  ShengMo Backend Launcher
echo ====================================================================
echo.

set PYTHONIOENCODING=utf-8

REM Step 1: Check for npm command
echo Checking for npm...
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] FATAL: 'npm' command not found.
    echo Please install Node.js from https://nodejs.org/ and ensure it is added to your system's PATH.
    echo.
    pause
    exit /b
)
echo Found npm.
echo.

REM Step 2: Check for node_modules and install if missing
echo Checking for dependencies (node_modules directory)...
if not exist "node_modules" (
    echo 'node_modules' directory not found. Running 'npm install'...
    echo This might take a moment...
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] 'npm install' failed. Please check the error messages above.
        echo.
        pause
        exit /b
    )
    echo 'npm install' completed successfully.
) else (
    echo 'node_modules' directory exists. Skipping install.
)
echo.

REM Step 3: Start the servers
echo Starting backend services...
echo The services will run in this window.
echo Press Ctrl+C to stop all services.
echo.

npm start