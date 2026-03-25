@echo off
setlocal

cd /d "%~dp0"
title DoList Test Launcher

echo ========================================
echo   DoList Test Launcher
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Please install Node.js first, then run this script again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found.
  echo Please make sure Node.js is installed correctly.
  echo.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [ERROR] package.json was not found in this folder.
  echo.
  pause
  exit /b 1
)

echo [INFO] Starting the development test environment...
echo [INFO] Working directory: %cd%
echo.

call npm.cmd run dev
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] Startup failed. Exit code: %EXIT_CODE%
  pause
)

exit /b %EXIT_CODE%
