import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash

DB_FILE = "profiler.db"

# Подключение к базе
def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row  # чтобы получать словари вместо кортежей
    return conn

# Создание таблиц при первом запуске
def init_db():
    conn = get_connection()
    cur = conn.cursor()

    # Таблица пользователей
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            login TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL  -- 'student', 'teacher', 'admin'
        )
    """)

    # Таблица результатов тестов
    cur.execute("""
        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            algo INTEGER,
            coding INTEGER,
            design INTEGER,
            entrepreneur INTEGER,
            teamwork INTEGER,
            profile TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    conn.commit()

    # Создаём тестовых пользователей если их ещё нет
    _create_default_users(cur, conn)
    conn.close()

def _create_default_users(cur, conn):
    # Проверяем есть ли уже пользователи
    cur.execute("SELECT COUNT(*) FROM users")
    count = cur.fetchone()[0]
    if count > 0:
        return

    # Добавляем тестовых пользователей
    default_users = [
        ("Студент Тест",   "student1", "1234", "student"),
        ("Преподаватель",  "teacher1", "1234", "teacher"),
        ("Администратор",  "admin",    "admin123", "admin"),
    ]
    for name, login, password, role in default_users:
        hashed = generate_password_hash(password)
        cur.execute(
            "INSERT INTO users (name, login, password, role) VALUES (?, ?, ?, ?)",
            (name, login, hashed, role)
        )
    conn.commit()

# Найти пользователя по логину
def find_user(login):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE login = ?", (login,))
    user = cur.fetchone()
    conn.close()
    return user

# Проверить пароль
def verify_password(login, password):
    user = find_user(login)
    if not user:
        return None
    if check_password_hash(user["password"], password):
        return dict(user)  # возвращаем словарь с данными пользователя
    return None

# Сохранить результат теста
def save_result(user_id, scores, profile):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO results (user_id, algo, coding, design, entrepreneur, teamwork, profile)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        user_id,
        scores.get("algo", 0),
        scores.get("coding", 0),
        scores.get("design", 0),
        scores.get("entrepreneur", 0),
        scores.get("teamwork", 0),
        profile
    ))
    conn.commit()
    conn.close()

# Получить все результаты (для преподавателя и админа)
def get_all_results():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.name, u.login, r.algo, r.coding, r.design,
               r.entrepreneur, r.teamwork, r.profile
        FROM results r
        JOIN users u ON r.user_id = u.id
        ORDER BY r.id DESC
    """)
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows

# Получить всех пользователей (только для админа)
def get_all_users():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, name, login, role FROM users")
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows

# Добавить нового пользователя (только для админа)
def add_user(name, login, password, role):
    conn = get_connection()
    cur = conn.cursor()
    try:
        hashed = generate_password_hash(password)
        cur.execute(
            "INSERT INTO users (name, login, password, role) VALUES (?, ?, ?, ?)",
            (name, login, hashed, role)
        )
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        # логин уже занят
        conn.close()
        return False