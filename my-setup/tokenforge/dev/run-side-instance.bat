@echo off
rem Run an extra TokenForge beside your live one: own data folder, own port.
rem Usage: run-side-instance.bat [port] [name]     (defaults: 4100 dev)
rem Uses the exe built in TokenForge\dist, never the live exe. Start page: http://127.0.0.1:PORT
set "PORT=%~1"
if "%PORT%"=="" set "PORT=4100"
set "NAME=%~2"
if "%NAME%"=="" set "NAME=dev"
set "TOKENFORGE_PORT=%PORT%"
rem Side instances stay headless so routine tests never pop a dashboard window.
set "TOKENFORGE_NO_WINDOW=1"
set "TOKENFORGE_HOME=%~dp0..\instances\%NAME%"
if not exist "%TOKENFORGE_HOME%" mkdir "%TOKENFORGE_HOME%"
start "" "%~dp0..\TokenForge\dist\TokenForge.exe"
echo Started "%NAME%" on http://127.0.0.1:%PORT%  (data: %TOKENFORGE_HOME%)
