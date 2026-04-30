@echo off
echo ========================================
echo Silent Stroke Detector - Setup Script
echo ========================================
echo.

echo [1/4] Creating virtual environment...
python -m venv .venv
if errorlevel 1 (
    echo ERROR: Failed to create virtual environment
    pause
    exit /b 1
)

echo [2/4] Activating virtual environment...
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment
    pause
    exit /b 1
)

echo [3/4] Installing Python dependencies...
pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo [4/4] Setup complete!
echo.
echo ========================================
echo Ready to run!
echo ========================================
echo.
echo To start the app, run:
echo   .venv\Scripts\activate
echo   streamlit run app_live.py
echo.
echo Or simply run: run.bat
echo.
pause
