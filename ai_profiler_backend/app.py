from flask import Flask, request, jsonify
from flask_cors import CORS
from scorer import calculate_scores, get_profile, get_recommendations, data
from database import init_db, verify_password, save_result, get_all_results, get_all_users, add_user
from ai_advisor import get_ai_recommendations, get_teams
from database import init_db, verify_password, save_result, get_all_results, get_all_users, add_user, get_connection

app = Flask(__name__)
CORS(app)

init_db()

TOTAL_QUESTIONS = sum(len(m["questions"]) for m in data["modules"])

@app.route("/")
def index():
    return "AI Competency Profiler работает!"

@app.route("/api/questions")
def get_questions():
    return jsonify(data)

# ─────────────────────────────────────
# РЕГИСТРАЦИЯ
# ─────────────────────────────────────

@app.route("/api/register", methods=["POST"])
def register():
    body = request.get_json()
    name     = body.get("name", "").strip()
    login    = body.get("login", "").strip()
    password = body.get("password", "").strip()
    role     = body.get("role", "student")

    # Только студент может регистрироваться сам
    if role != "student":
        return jsonify({"error": "Самостоятельная регистрация доступна только для студентов"}), 403

    # Проверяем что все поля заполнены
    if not name or not login or not password:
        return jsonify({"error": "Заполните все поля"}), 400

    # Минимальная длина пароля
    if len(password) < 4:
        return jsonify({"error": "Пароль должен быть не менее 4 символов"}), 400

    success = add_user(name, login, password, role)
    if success:
        return jsonify({"message": "Аккаунт создан! Теперь войдите в систему."})
    else:
        return jsonify({"error": "Этот логин уже занят"}), 400

# ─────────────────────────────────────
# АВТОРИЗАЦИЯ
# ─────────────────────────────────────

@app.route("/api/login", methods=["POST"])
def login():
    body = request.get_json()
    login_val = body.get("login", "")
    password = body.get("password", "")

    selected_role = body.get("role", "")

    user = verify_password(login_val, password)
    if not user:
        return jsonify({"error": "Неверный логин или пароль"}), 401

    if selected_role and user["role"] != selected_role:
        return jsonify({"error": "Неверная роль для этого аккаунта"}), 403

    return jsonify({
        "id": user["id"],
        "name": user["name"],
        "login": user["login"],
        "role": user["role"]
    })

# ─────────────────────────────────────
# СТУДЕНТ — сдать тест
# ─────────────────────────────────────

@app.route("/api/submit", methods=["POST"])
def submit():
    body = request.get_json()

    user_id = body.get("user_id")
    name = body.get("name", "Студент")
    answers = body.get("answers", {})
    time_spent = body.get("time_spent", None)

    if len(answers) < TOTAL_QUESTIONS:
        unanswered = TOTAL_QUESTIONS - len(answers)
        return jsonify({
            "error": f"Ответ не на все вопросы. Пропущено: {unanswered} из {TOTAL_QUESTIONS}"
        }), 400

    scores = calculate_scores(answers)
    profile = get_profile(scores)
    basic_recommendations = get_recommendations(scores)

    try:
        ai_recommendations = get_ai_recommendations(name, scores, profile, time_spent)
    except Exception as e:
        ai_recommendations = "\n".join(basic_recommendations)
        print(f"OpenAI ошибка: {e}")

    if user_id:
        save_result(user_id, scores, profile)

    return jsonify({
        "scores": scores,
        "profile": profile,
        "recommendations": ai_recommendations
    })

# ─────────────────────────────────────
# ПРЕПОДАВАТЕЛЬ — просмотр результатов
# ─────────────────────────────────────

@app.route("/api/results", methods=["GET"])
def results():
    rows = get_all_results()
    return jsonify(rows)

@app.route("/api/teams", methods=["GET"])
def generate_teams():
    rows = get_all_results()

    if not rows:
        return jsonify({"error": "Нет данных о студентах"}), 404

    try:
        teams = get_teams(rows)
    except Exception as e:
        return jsonify({"error": f"Ошибка генерации: {e}"}), 500

    return jsonify({"teams": teams})
    
# Получить последние результаты студента
@app.route("/api/results/my/<int:user_id>", methods=["GET"])
def my_results(user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT algo, coding, design, entrepreneur, teamwork, profile
        FROM results
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 1
    """, (user_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "Результатов пока нет"}), 404

    return jsonify(dict(row))

# ─────────────────────────────────────
# АДМИН — управление пользователями
# ─────────────────────────────────────

@app.route("/api/users", methods=["GET"])
def users():
    rows = get_all_users()
    return jsonify(rows)

@app.route("/api/users/add", methods=["POST"])
def create_user():
    body = request.get_json()
    name     = body.get("name", "")
    login    = body.get("login", "")
    password = body.get("password", "")
    role     = body.get("role", "student")

    if role not in ("student", "teacher", "admin"):
        return jsonify({"error": "Неверная роль"}), 400

    success = add_user(name, login, password, role)
    if success:
        return jsonify({"message": "Пользователь создан"})
    else:
        return jsonify({"error": "Логин уже занят"}), 400

if __name__ == "__main__":
    app.run(debug=True)