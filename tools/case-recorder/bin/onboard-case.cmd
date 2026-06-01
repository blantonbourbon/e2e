@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
call "%SCRIPT_DIR%env.cmd"

for %%I in ("%SCRIPT_DIR%..\..\..") do set "REPO_ROOT=%%~fI"

node "%REPO_ROOT%\tools\case-recorder\src\onboard.mjs" --repo-root "%REPO_ROOT%" %*
exit /b %ERRORLEVEL%
