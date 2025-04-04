@echo off
cls
git add .

set "version_input="
:GetVersionInput
set "version_input="
set /p version_input="Enter the version or name for the new branch (e.g., 1.3): "

if "%version_input%"=="" (
    echo.
    echo ERROR: Version/Branch name cannot be empty. Please try again.
    goto GetVersionInput
)

REM --- New Space Check ---
set "check_space=%version_input: =%"
if not "%check_space%"=="%version_input%" (
    echo.
    echo WARNING: Spaces were detected in the input. Not recommended for branch names.
    set /p confirm_space="Continue anyway? (y/n): "
    if /i not "%confirm_space%"=="y" goto GetVersionInput
)
REM --- End of New Space Check ---

echo.
echo Preparing to commit with message and create branch: "%version_input%"
echo.

echo Attempting to commit changes (using message "%version_input%")...
git commit -m "%version_input%"
if errorlevel 1 (
    echo.
    echo WARNING: Git commit failed or there were no changes to commit. Will create branch based on current state.
)

echo.
echo Creating new branch "%version_input%"...
git branch "%version_input%"
if errorlevel 1 (
    echo.
    echo ERROR: Failed to create branch "%version_input%". It might already exist.
    goto End
)

echo.
echo Pushing new branch "%version_input%" to origin...
git push -u origin "%version_input%"
if errorlevel 1 (
    echo.
    echo ERROR: Git push failed for the new branch. Check connection, permissions, or remote status.
    goto End
)

echo.
echo ============================================================
echo  SUCCESS! New branch "%version_input%" pushed to GitHub.
echo ============================================================

:End
echo.
pause