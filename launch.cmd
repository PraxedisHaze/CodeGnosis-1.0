@echo off
setlocal

echo Launching CodeGnosis_1.0 (Project Analyzer)...

:: Change to the directory where this script is located
cd /d "%~dp0"

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH. Please install Node.js.
    echo See https://nodejs.org/
    pause
    exit /b 1
)

:: Check if npm dependencies are installed, and install if not
if not exist "node_modules" (
    echo Node_modules directory not found. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo Error: npm install failed.
        pause
        exit /b 1
    )
)

:: Set environment variables for Tauri (based on previous context for Hub)
:: These might not be strictly necessary if the system PATH is correctly configured,
:: but it's safer to include if there were previous issues.
set "PATH=C:\Program Files\nodejs;C:\Users\phaze\.cargo\bin;%PATH%"
set "NPM_CONFIG_OFFLINE=false"

:: Launch the Tauri development server
echo Starting CodeGnosis_1.0 development server...
call npm run tauri:dev

echo CodeGnosis_1.0 launch script finished.
pause
endlocal
exit /b 0
