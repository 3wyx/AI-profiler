"""Боевой запуск: python serve.py

Вместо встроенного сервера Flask (он только для разработки) используется waitress.
Он надёжнее держит много одновременных пользователей.
"""
import os

# Код использует относительные пути (profiler.db, questions.json), поэтому работаем из папки backend.
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from waitress import serve  # noqa: E402
from app import app  # noqa: E402

if __name__ == "__main__":
    # На хостинге порт выдаётся через переменную PORT, адрес должен быть 0.0.0.0.
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "5000"))
    print(f"AI-profiler запущен: http://{host}:{port} (остановить: Ctrl+C)")
    # Один процесс и несколько потоков: замки и лимиты в приложении работают внутри одного процесса.
    serve(app, host=host, port=port, threads=8)
