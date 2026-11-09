import json
import os
import uuid
from datetime import datetime, timezone, timedelta

from database import get_connection

# Длительность теста в секундах. Должна совпадать с TOTAL_SECONDS в TestingPage.jsx.
TEST_SECONDS = 60 * 60
# Сколько секунд после конца теста ещё принимаем ответы (медленный интернет, задержка запроса).
LATE_GRACE = 180
# Если браузер говорит «время вышло» раньше, чем прошло время теста минус этот допуск, ему не верим.
EARLY_TOLERANCE = 60
# Сколько раз один человек может начать тест за час. Для демо можно поднять в .env: MAX_TESTS_PER_HOUR=50
MAX_TESTS_PER_HOUR = int(os.getenv("MAX_TESTS_PER_HOUR", "5"))

# Попытка живёт чуть дольше теста.
ATTEMPT_MAX_AGE = timedelta(seconds=TEST_SECONDS + LATE_GRACE + 600)
# Старые попытки удаляем, чтобы таблица не росла бесконечно.
ATTEMPT_KEEP = timedelta(days=7)


def _now():
    return datetime.now(timezone.utc)


def init_attempts_table():
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS test_attempts (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            questions_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            used INTEGER NOT NULL DEFAULT 0
        )
    """)
    conn.commit()
    conn.close()


def create_attempt(user_id, questions):
    """Сохраняет набор вопросов вместе с правильными ответами на сервере.
    Возвращает id попытки: его получает браузер, а ответы остаются у нас."""
    attempt_id = uuid.uuid4().hex
    conn = get_connection()
    conn.execute("DELETE FROM test_attempts WHERE created_at < ?",
                 ((_now() - ATTEMPT_KEEP).isoformat(),))
    conn.execute(
        "INSERT INTO test_attempts (id, user_id, questions_json, created_at) VALUES (?, ?, ?, ?)",
        (attempt_id, user_id, json.dumps(questions, ensure_ascii=False), _now().isoformat()),
    )
    conn.commit()
    conn.close()
    return attempt_id


def recent_attempt_times(user_id, window=timedelta(hours=1)):
    """Время запусков теста этим пользователем за последний час (от старых к новым)."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT created_at FROM test_attempts WHERE user_id = ? AND created_at >= ? ORDER BY created_at",
        (user_id, (_now() - window).isoformat()),
    ).fetchall()
    conn.close()
    return [datetime.fromisoformat(r["created_at"]) for r in rows]


def claim_attempt(attempt_id, user_id):
    """Забирает попытку для проверки. Сработает только один раз, только для её владельца
    и только пока она не устарела. Возвращает вопросы (с правильными ответами)
    и время начала теста, либо None."""
    if not attempt_id or not isinstance(attempt_id, str):
        return None
    conn = get_connection()
    cur = conn.execute(
        "UPDATE test_attempts SET used = 1 "
        "WHERE id = ? AND user_id = ? AND used = 0 AND created_at >= ?",
        (attempt_id, user_id, (_now() - ATTEMPT_MAX_AGE).isoformat()),
    )
    conn.commit()
    if cur.rowcount != 1:
        conn.close()
        return None
    row = conn.execute(
        "SELECT questions_json, created_at FROM test_attempts WHERE id = ?", (attempt_id,)
    ).fetchone()
    conn.close()
    return {
        "questions": json.loads(row["questions_json"]),
        "started_at": datetime.fromisoformat(row["created_at"]),
    }


def release_attempt(attempt_id):
    """Возвращает попытку, если проверка не удалась по нашей вине (чтобы можно было отправить снова)."""
    conn = get_connection()
    conn.execute("UPDATE test_attempts SET used = 0 WHERE id = ?", (attempt_id,))
    conn.commit()
    conn.close()


def public_questions(questions):
    """Копия вопросов без правильных ответов: именно её получает браузер."""
    return {
        **{k: v for k, v in questions.items() if k != "modules"},
        "modules": [
            {
                **{k: v for k, v in mod.items() if k != "questions"},
                "questions": [
                    {k: v for k, v in q.items() if k not in ("correct", "explanation")}
                    for q in mod["questions"]
                ],
            }
            for mod in questions["modules"]
        ],
    }
