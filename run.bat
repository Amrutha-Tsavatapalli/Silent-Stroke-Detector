@echo off
echo ========================================
echo Silent Stroke Detector - Starting...
echo ========================================
echo.

if not exist .venv (
    echo Virtual environment not found!
    echo Please run setup.bat first
    pause
    exit /b 1
)

echo Activating virtual environment...
call .venv\Scripts\activate.bat

echo Starting Streamlit app...
echo.
echo The app will open in your browser at http://localhost:8501
echo Press Ctrl+C to stop the server
echo.

streamlit run app_live.py
