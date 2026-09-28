@echo off

set PYTHON="C:\Users\Zeynezhan\AppData\Local\Programs\Python\Python313\python.exe"

cd backend
if exist requirements.txt (
    %PYTHON% -m pip install -r requirements.txt --quiet
) else (
    %PYTHON% -m pip install flask flask-cors openai werkzeug python-dotenv --quiet
)
cd ..

start "Backend" cmd /k "cd backend && %PYTHON% app.py"

timeout /t 3 /nobreak > nul

start http://localhost:5000

exit