import os
import secrets
from functools import wraps

from dotenv import load_dotenv
from flask import request, jsonify, g
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from database import get_connection

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SECRET_FILE = os.path.join(BASE_DIR, ".secret_key")

# Сколько часов действует вход. Потом нужно войти заново.
TOKEN_MAX_AGE = 12 * 60 * 60

STAFF_ROLES = ("teacher", "admin")


def _get_secret_key():
    """Секретный ключ для подписи токенов.
    Берём из .env (SECRET_KEY). Если там нет, создаём файл .secret_key один раз,
    чтобы входы не слетали при каждом перезапуске сервера."""
    key = os.getenv("SECRET_KEY")
    if key:
        return key
    if os.path.exists(SECRET_FILE):
        with open(SECRET_FILE, "r", encoding="utf-8") as f:
            saved = f.read().strip()
            if saved:
                return saved
    key = secrets.token_hex(32)
    with open(SECRET_FILE, "w", encoding="utf-8") as f:
        f.write(key)
    return key


def _serializer():
    return URLSafeTimedSerializer(_get_secret_key(), salt="ai-profiler-auth")


def create_token(user_id):
    """Создаёт подписанный токен для пользователя."""
    return _serializer().dumps({"id": user_id})


def _load_user_from_request():
    """Достаёт пользователя по заголовку Authorization: Bearer <token>.
    Роль берём из базы, а не из токена, поэтому смена роли действует сразу."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header[7:].strip()
    if not token:
        return None
    try:
        payload = _serializer().loads(token, max_age=TOKEN_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None

    conn = get_connection()
    row = conn.execute(
        "SELECT id, name, login, role FROM users WHERE id = ?", (payload.get("id"),)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_optional_user():
    """Возвращает пользователя или None (для эндпоинтов, где вход не обязателен)."""
    return _load_user_from_request()


def login_required(f):
    """Доступ только для вошедших пользователей."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        user = _load_user_from_request()
        if not user:
            return jsonify({"error": "Требуется вход в систему", "code": "auth_required"}), 401
        g.user = user
        return f(*args, **kwargs)
    return wrapper


def roles_required(*roles):
    """Доступ только для указанных ролей, например @roles_required("admin")."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            user = _load_user_from_request()
            if not user:
                return jsonify({"error": "Требуется вход в систему", "code": "auth_required"}), 401
            if user["role"] not in roles:
                return jsonify({"error": "Недостаточно прав"}), 403
            g.user = user
            return f(*args, **kwargs)
        return wrapper
    return decorator


def is_self_or_staff(user_id):
    """True, если это сам пользователь или преподаватель/админ. Вызывать после login_required."""
    try:
        same = int(user_id) == g.user["id"]
    except (TypeError, ValueError):
        same = False
    return same or g.user["role"] in STAFF_ROLES


# --- Ссылки на файлы портфолио ---
# Обычная ссылка <a href> не умеет передавать токен, поэтому сервер выдаёт
# подписанную ссылку на конкретный файл. Она живёт столько же, сколько вход.

def _file_serializer():
    return URLSafeTimedSerializer(_get_secret_key(), salt="ai-profiler-file-link")


def sign_file_link(filename):
    return _file_serializer().dumps(filename)


def verify_file_link(sig, filename):
    try:
        return _file_serializer().loads(sig, max_age=TOKEN_MAX_AGE) == filename
    except (BadSignature, SignatureExpired):
        return False
