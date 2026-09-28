@echo off
chcp 65001 > nul
title AI Competency Profiler

echo ========================================================
echo   Запуск AI Competency Profiler
echo ========================================================
echo.

:: 1. Поиск установленного интерпретатора Python
set SYS_PYTHON=
where py >nul 2>nul
if %errorlevel% equ 0 (
    set SYS_PYTHON=py -3
) else (
    where python >nul 2>nul
    if %errorlevel% equ 0 (
        set SYS_PYTHON=python
    )
)

if "%SYS_PYTHON%"=="" (
    echo [ОШИБКА] Python не обнаружен в вашей системе!
    echo Скачайте и установите Python с официального сайта:
    echo https://www.python.org/downloads/
    echo При установке ОБЯЗАТЕЛЬНО отметьте галочку:
    echo "Add python.exe to PATH"
    echo.
    pause
    exit /b 1
)

:: 2. Создание изолированного виртуального окружения (.venv), если его еще нет
if not exist ".venv\Scripts\activate.bat" (
    echo [1/3] Создание локального виртуального окружения (.venv)...
    %SYS_PYTHON% -m venv .venv
    if %errorlevel% neq 0 (
        echo [ОШИБКА] Не удалось создать виртуальное окружение.
        pause
        exit /b 1
    )
    echo     Виртуальное окружение успешно создано.
) else (
    echo [1/3] Локальное окружение (.venv) готово.
)

:: 3. Проверка и установка зависимостей в виртуальное окружение
echo [2/3] Проверка и установка библиотек...
call .venv\Scripts\activate.bat
if exist "backend\requirements.txt" (
    python -m pip install -r backend\requirements.txt --quiet
) else (
    python -m pip install flask flask-cors openai werkzeug python-dotenv --quiet
)

:: 4. Запуск бэкенда в отдельном окне
echo [3/3] Запуск сервера Flask...
start "AI-Profiler Backend" cmd /k "cd backend && call ..\.venv\Scripts\activate.bat && python app.py"

:: 5. Ожидание запуска и открытие веб-интерфейса
timeout /t 3 /nobreak > nul
echo.
echo Открытие веб-интерфейса в браузере...
start http://localhost:5000

echo.
echo Проект успешно запущен!
exit