@echo off
:: Production launch on Windows: waitress instead of the Flask dev server.
:: Run start.bat once first so the backend\venv environment exists.

if not exist "backend\venv" (
    echo [ERROR] Environment not found. Run start.bat once first.
    pause
    exit /b 1
)

call backend\venv\Scripts\activate.bat
cd backend
pip install -r requirements.txt --quiet

:: Locally listen on this computer only. On a hosting platform HOST is not needed.
set HOST=127.0.0.1
start http://localhost:5000
python serve.py
