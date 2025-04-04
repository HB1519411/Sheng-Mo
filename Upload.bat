@echo off
cls
echo ============================================================
echo  Git Commit and Push New Version Branch Script
echo ============================================================
echo This script will:
echo 1. Stage all changes.
echo 2. Commit changes with your provided message (used as version).
echo 3. Create a NEW branch named after that version/message.
echo 4. Push the NEW branch to GitHub (origin).
echo ============================================================
echo IMPORTANT: Run this script from the root directory of your
echo            local Sheng-Mo Git repository.
echo Repository Target: git@github.com:HB1519411/Sheng-Mo.git
echo ============================================================
echo WARNING: Please use a version identifier suitable for a branch name
echo          (e.g., 'v1.3', 'release-2.0', '1.3.1'). Avoid spaces
echo          and special characters like \, /, :, *, ?, ", <, >, |.
echo ============================================================
echo.

echo Staging all changes (git add .)...
git add .
echo.

set "version_message="
:GetVersionMessage
set "version_message="
set /p version_message="Enter the version or name for the new branch (e.g., 1.3): "

REM Check if the version message is empty
if "%version_message%"=="" (
    echo.
    echo ERROR: Version/Branch name cannot be empty. Please try again.
    goto GetVersionMessage
)
REM Basic check for spaces (optional, but recommended)
echo "%version_message%" | findstr /C:" " > nul
if not errorlevel 1 (
    echo.
    echo WARNING: Spaces are not recommended in branch names.
    set /p confirm_space="Continue anyway? (y/n): "
    if /i not "%confirm_space%"=="y" goto GetVersionMessage
)


set "new_branch_name=%version_message%"
echo.
echo Preparing to commit with message and create branch: "%new_branch_name%"
echo.

echo Committing changes on the current branch (git commit -m "%version_message%")...
git commit -m "%version_message%"

REM Check if the commit command failed (e.g., nothing to commit)
if errorlevel 1 (
    echo.
    echo WARNING: Git commit may have failed or there were no changes to commit.
    echo          If there were no changes, no new branch will be created or pushed.
    echo          Check messages above.
    goto End
)

echo.
echo Creating new branch named "%new_branch_name%"...
git branch "%new_branch_name%"

REM Check if branch creation failed (e.g., branch already exists)
if errorlevel 1 (
    echo.
    echo ERROR: Failed to create branch "%new_branch_name%". It might already exist.
    echo        You may need to delete the existing local/remote branch or choose a different name.
    goto End
)

echo.
echo Pushing the new branch "%new_branch_name%" to remote repository (origin)...
REM The -u flag sets the upstream branch for the new local branch to origin/<new_branch_name>
git push -u origin "%new_branch_name%"

REM Check if the push command failed
if errorlevel 1 (
    echo.
    echo ERROR: Git push failed for the new branch. Check connection, permissions, or remote status.
    goto End
)

echo.
echo ============================================================
echo  SUCCESS! New branch "%new_branch_name%" pushed to GitHub.
echo ============================================================
echo REMINDER: To make "%new_branch_name%" the default branch,
echo           you MUST manually change it in your repository
echo           settings on the GitHub website:
echo           Settings -> Branches -> Default branch -> Switch branch
echo ============================================================

:End
echo.
pause