@echo off
rem Updates every TokenForge copy on this PC (this one and live\):
rem git pull, cargo build --release, then swap the exe in place.
rem This is the Rust updater built into TokenForge.exe: --check to only look, --force to rebuild.
setlocal
cd /d "%~dp0"
if not exist "%~dp0TokenForge.exe" (
  echo FAILED: TokenForge.exe not found in %~dp0
  goto end
)
"%~dp0TokenForge.exe" --update %*
if errorlevel 1 (
  echo UPDATE FAILED: The build failed (build.ps1 exited with 1), so no new exe was installed. The reason is in the log, near the BUILD FAILED line and the end of the file: %~dp0logs\update-%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~-11,2%%time:~-8,2%%time:~-5,2%.log
  goto end
)
:end
echo.
pause
