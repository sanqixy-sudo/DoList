@echo off
setlocal EnableExtensions

cd /d "%~dp0"
title DoList Git Sync

echo ========================================
echo   DoList Git Sync
echo ========================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git was not found.
  echo Please install Git first, then run this script again.
  echo.
  pause
  exit /b 1
)

if not exist ".git" (
  echo [ERROR] .git folder was not found in this directory.
  echo [INFO] Current directory: %cd%
  echo.
  pause
  exit /b 1
)

echo [INFO] Current directory: %cd%
echo [INFO] Current changes:
git status --short
echo.

set "COMMIT_MSG="
set /p COMMIT_MSG=Enter commit message (default: chore: update project): 
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=chore: update project"

echo.
echo [INFO] Staging changes...
git add .
if errorlevel 1 goto fail

git diff --cached --quiet
if errorlevel 1 (
  echo [INFO] Creating commit...
  git commit -m "%COMMIT_MSG%"
  if errorlevel 1 goto fail
) else (
  echo [INFO] No local file changes to commit.
)

echo.
echo [INFO] Pulling latest changes from origin/main...
git pull --rebase origin main
if errorlevel 1 goto fail

echo.
echo [INFO] Pushing to origin/main...
git push origin main
if errorlevel 1 goto fail

echo.
echo [SUCCESS] Git sync completed.
pause
exit /b 0

:fail
set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo [ERROR] Git sync failed. Exit code: %EXIT_CODE%
pause
exit /b %EXIT_CODE%
