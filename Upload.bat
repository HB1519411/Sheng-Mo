@echo off
cls
echo ============================================================
echo  Git Auto Commit and Push Script
echo ============================================================
echo IMPORTANT: Run this script from the root directory of your
echo            local Sheng-Mo Git repository.
echo Repository Target: git@github.com:HB1519411/Sheng-Mo.git
echo ============================================================
echo.

echo Staging all changes (git add .)...
git add .
echo.

set "commit_message="
set /p commit_message="Enter your commit message: "

REM Check if the commit message is empty
if "%commit_message%"=="" (
    echo.
    echo ERROR: Commit message cannot be empty. Aborting.
    goto End
)

echo.
echo Committing changes (git commit -m "%commit_message%")...
git commit -m "%commit_message%"

REM Check if the commit command failed (e.g., nothing to commit)
if errorlevel 1 (
    echo.
    echo WARNING: Git commit may have failed or there were no changes to commit. Check messages above.
    echo Attempting to push anyway in case of amending or other scenarios...
    echo.
)

echo.
echo Pushing changes to remote repository (git push)...
git push

REM Check if the push command failed
if errorlevel 1 (
    echo.
    echo ERROR: Git push failed. Check your connection, permissions, and remote status.
    goto End
)

echo.
echo ============================================================
echo  Script finished. Check output above for success or errors.
echo ============================================================

:End
echo.
pause