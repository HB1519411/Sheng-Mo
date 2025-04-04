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

REM --- Space Check ---
set "check_space=%version_input: =%"
if not "%check_space%"=="%version_input%" (
    echo.
    echo WARNING: Spaces were detected in the input. Not recommended for branch names.
    set /p confirm_space="Continue anyway? (y/n): "
    if /i not "%confirm_space%"=="y" goto GetVersionInput
)
REM --- End of Space Check ---

echo.
echo Preparing to commit with message and create/overwrite branch: "%version_input%"
echo.

echo Attempting to commit changes (using message "%version_input%")...
git commit -m "%version_input%"
if errorlevel 1 (
    echo.
    echo WARNING: Git commit failed or there were no changes to commit. Branch will be based on current HEAD.
)

echo.
echo Forcing creation/update of local branch "%version_input%" to current commit...
echo WARNING: If local branch "%version_input%" already exists, it will be reset!
git branch -f "%version_input%"
REM Check for *other* branch creation errors, though less likely with -f
if errorlevel 1 (
    echo.
    echo ERROR: Failed to create/update local branch "%version_input%" for reasons other than existence.
    goto End
)


echo.
echo Force pushing branch "%version_input%" to origin...
echo WARNING: This will OVERWRITE the remote branch "%version_input%" if it exists!
git push --force -u origin "%version_input%"
if errorlevel 1 (
    echo.
    echo ERROR: Git force push failed for branch "%version_input%". Check connection, permissions, or remote status.
    goto End
)

echo.
echo ============================================================
echo  SUCCESS! Branch "%version_input%" forced pushed to GitHub.
echo          Local and remote branches (if existed) were overwritten.
echo ============================================================

:End
echo.
pause