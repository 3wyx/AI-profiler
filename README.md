# AI Competency Profiler

> Веб-приложение для комплексного тестирования студентов по ключевым IT-компетенциям с автоматической генерацией персональных рекомендаций и подбором команд с помощью ИИ.

---

## Возможности

- **Тестирование по 5 модулям компетенций:**
  - Алгоритмическое мышление (`algo`)
  - Код и программирование (`coding`)
  - Дизайн-мышление и UX/UI (`design`)
  - Предпринимательство и стартап-мышление (`entrepreneur`)
  - Командная работа и soft skills (`teamwork`)
- **Интерактивный профиль:** результаты визуализируются в виде радарной диаграммы (Recharts) с определением IT-роли (разработчик, аналитик, дизайнер, менеджер и др.)
- **ИИ-рекомендации:** анализ результатов через LLM (OpenRouter API) с персональными советами по развитию
- **Подбор команд:** автоматическое формирование сбалансированных команд из 4–5 человек на основе профилей студентов (с помощью ИИ)
- **Система аутентификации:** роли Студент / Преподаватель / Администратор
- **Отслеживание активности:** журнал действий пользователей, история попыток прохождения теста
- **Тёмная / светлая тема** и кастомные шрифты
- **Панель преподавателя:** просмотр результатов студентов, экспорт, формирование команд
- **Панель администратора:** управление пользователями

---

## Технологии

| Часть | Стек |
|---|---|
| **Frontend** | React 18, Vite, CSS Modules, Recharts, Lucide Icons |
| **Backend** | Python 3, Flask, Flask-CORS, Waitress (production) |
| **База данных** | SQLite (через собственный `database.py`) |
| **AI Engine** | OpenRouter API (LLM), модель `openrouter/auto` |
| **Email** | `email_sender.py` (уведомления) |

---

## Быстрый запуск (Windows)

### Вариант 1 — одной командой (dev-режим)

```cmd
start.bat
```

Скрипт автоматически найдёт Python, создаст виртуальное окружение, установит зависимости и откроет приложение по адресу `http://localhost:5000`.

### Вариант 2 — продакшн (Waitress)

```cmd
start-prod.bat
```

> Перед первым запуском `start-prod.bat` нужно один раз выполнить `start.bat`, чтобы создалось виртуальное окружение `backend/venv`.

---

## Ручная установка

### 1. Бэкенд

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt
cp .env.example .env       # заполни OPENROUTER_API_KEY
python app.py
```

Бэкенд запустится на `http://localhost:5000`.

### 2. Фронтенд (только для разработки)

```bash
cd frontend
npm install
npm run dev
```

### 3. Сборка фронтенда

```bash
cd frontend
npm run build
```

Собранные файлы автоматически попадают в `backend/static/` и раздаются Flask'ом.

---

## Переменные окружения

Создай файл `backend/.env` на основе `backend/.env.example`:

```env
# Ключ для OpenRouter (получить на https://openrouter.ai)
OPENROUTER_API_KEY=sk-or-v1-...

# Секретный ключ Flask (для сессий и JWT)
SECRET_KEY=your-secret-key
```

---

## Структура проекта

```
ai-profiler/
├── backend/
│   ├── app.py              # Flask-приложение, маршруты API
│   ├── auth.py             # Аутентификация, роли, JWT
│   ├── activity.py         # Журнал активности пользователей
│   ├── attempts.py         # История попыток прохождения теста
│   ├── ai_advisor.py       # ИИ-рекомендации и подбор команд
│   ├── scorer.py           # Подсчёт результатов и определение профиля
│   ├── database.py         # Инициализация и модели БД
│   ├── email_sender.py     # Отправка email-уведомлений
│   ├── serve.py            # Запуск через Waitress (production)
│   ├── questions.json      # Активный банк вопросов
│   ├── questions_bank.json # Расширенный банк вопросов
│   └── static/             # Собранный фронтенд
├── frontend/
│   ├── src/
│   │   ├── pages/          # Страницы (Auth, Testing, Results, Admin и др.)
│   │   ├── components/     # UI-компоненты (Navbar, Sidebar, Modal и др.)
│   │   ├── context/        # ThemeContext
│   │   ├── authFetch.js    # Fetch-обёртка с авторизацией
│   │   └── activity.js     # Трекинг активности на фронтенде
│   └── ...
├── start.bat               # Быстрый запуск (dev)
├── start-prod.bat          # Запуск через Waitress (production)
└── build.bat               # Сборка фронтенда
```
