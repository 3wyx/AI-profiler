from flask import Flask, request, jsonify, send_from_directory, g
from flask_cors import CORS
from scorer import calculate_scores, get_profile, get_recommendations, form_teams_without_ai, build_question_map
import json, os, uuid, threading, time
from datetime import datetime, timezone

def load_questions():
    with open("questions.json", "r", encoding="utf-8") as f:
        return json.load(f)

data = load_questions()

from ai_advisor import get_ai_recommendations, get_teams, generate_questions
from database import (init_db, verify_password, save_result, get_all_results,
                      add_user, get_all_users, get_connection,
                      add_portfolio_item, get_portfolio, get_portfolio_file, delete_portfolio_item,
                      add_support_request, get_all_support_requests, update_support_status, update_user_credentials, change_password,
                      add_pinned_team, get_pinned_teams, delete_pinned_team, get_ticket_with_user_email,
                      create_invite_token, verify_invite_token, mark_token_used, get_all_invite_tokens)
from email_sender import send_ticket_resolved_email
from activity import activity_bp, init_activity_table, record_event
from auth import create_token, login_required, roles_required, is_self_or_staff, sign_file_link, verify_file_link
from attempts import (
    init_attempts_table, create_attempt, claim_attempt, release_attempt, public_questions,
    recent_attempt_times, MAX_TESTS_PER_HOUR, TEST_SECONDS, LATE_GRACE, EARLY_TOLERANCE,
)

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)

init_db()
init_activity_table()
init_attempts_table()
app.register_blueprint(activity_bp)

# Если в .env задан ADMIN_PASSWORD, он заменяет стандартный пароль админа при каждом запуске.
_admin_password = os.getenv("ADMIN_PASSWORD")
if _admin_password:
    _conn = get_connection()
    _row = _conn.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()
    _conn.close()
    if _row:
        change_password(_row["id"], _admin_password)

TOTAL_QUESTIONS = 25

BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads", "portfolio")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {
    "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx",
    "png", "jpg", "jpeg", "gif", "webp", "zip", "rar"
}
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

# ВОПРОСЫ

BANK_FILE = "questions_bank.json"
_bank_lock = threading.Lock()


def load_bank():
    try:
        with open(BANK_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {"modules": []}


def save_bank(bank):
    # Пишем во временный файл и подменяем целиком: если что-то сломается, банк не повредится.
    tmp = BANK_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(bank, f, ensure_ascii=False, indent=2)
    os.replace(tmp, BANK_FILE)


# Новые вопросы через ИИ создаём не чаще, чем раз в AI_GENERATION_COOLDOWN секунд на весь сервер.
# В остальное время берём вопросы из накопленного банка. Так расходы на ИИ ограничены
# при любом числе пользователей.
AI_GENERATION_COOLDOWN = int(os.getenv("AI_GENERATION_COOLDOWN", "60"))
_gen_lock = threading.Lock()
_last_generation = 0.0


def generation_allowed():
    global _last_generation
    with _gen_lock:
        now = time.monotonic()
        if _last_generation and now - _last_generation < AI_GENERATION_COOLDOWN:
            return False
        _last_generation = now
        return True


@app.route("/api/questions")
@login_required
def get_questions():
    import random

    # Лимит запусков теста на человека (считается до обращения к ИИ).
    starts = recent_attempt_times(g.user["id"])
    if len(starts) >= MAX_TESTS_PER_HOUR:
        wait = starts[0].timestamp() + 3600 - time.time()
        minutes = max(1, int(wait // 60) + 1)
        return jsonify({
            "error": f"Слишком много запусков теста. Попробуйте снова через {minutes} мин.",
            "code": "rate_limited"
        }), 429

    bank = None
    if generation_allowed():
        try:
            new_questions = generate_questions()
            record_event("ai_request", g.user["id"])
            # Банк читаем и пишем под замком: два студента одновременно не затрут друг другу вопросы.
            with _bank_lock:
                bank = load_bank()
                for new_mod in new_questions["modules"]:
                    existing = next((m for m in bank["modules"] if m["id"] == new_mod["id"]), None)
                    if existing:
                        existing["questions"].extend(new_mod["questions"])
                    else:
                        bank["modules"].append(new_mod)
                save_bank(bank)

        except Exception as e:
            import traceback
            print(f"Ошибка генерации: {e}")
            traceback.print_exc()
            bank = None

    if bank is None:
        bank = load_bank()

    if bank["modules"]:
        result = {"modules": []}
        for mod in bank["modules"]:
            questions = mod["questions"]
            picked = random.sample(questions, min(5, len(questions)))
            for i, q in enumerate(picked):
                q["id"] = f"{mod['id']}_{i+1}"
            result["modules"].append({**mod, "questions": picked})
    else:
        result = data  # запасной набор из questions.json, если банк пуст

    # Каждому прохождению теста свой набор вопросов. Правильные ответы остаются на сервере.
    attempt_id = create_attempt(g.user["id"], result)
    response = public_questions(result)
    response["attempt_id"] = attempt_id
    return jsonify(response)

# РЕГИСТРАЦИЯ

@app.route("/api/register", methods=["POST"])
def register():
    body        = request.get_json()
    role        = body.get("role", "student")
    password    = body.get("password", "").strip()
    email       = body.get("email", "").strip()
    first_name  = body.get("first_name", "").strip()
    last_name   = body.get("last_name", "").strip()
    middle_name = body.get("middle_name", "").strip()

    if role not in ("student", "teacher"):
        return jsonify({"error": "Самостоятельная регистрация доступна только для студентов и преподавателей"}), 403

    invite_token = body.get("invite_token", "").strip()
    if role == "teacher":
        if not invite_token:
            return jsonify({"error": "Для регистрации преподавателя нужен код приглашения от администратора"}), 403

        token_info = verify_invite_token(invite_token, email)
        if not token_info:
            return jsonify({"error": "Неверный код приглашения или он уже использован"}), 403
    
    if not first_name or not last_name or not email:
        return jsonify({"error": "Заполните все обязательные поля"}), 400

    if len(password) < 4:
        return jsonify({"error": "Пароль должен быть не менее 4 символов"}), 400

    group_number = None
    group_name   = None
    course_year  = None
    if role == "student":
        group_number = body.get("group_number", "").strip().upper() 
        group_name   = body.get("group_name", "").strip()
        course_year  = body.get("course_year", "").strip()
        if not group_number or not group_name or not course_year:
            return jsonify({"error": "Заполните данные учебной группы и курс"}), 400

    name_parts = [last_name, first_name]
    if middle_name:
        name_parts.append(middle_name)
    full_name = " ".join(name_parts)
    login = email

    success = add_user(
        name=full_name, login=login, password=password, role=role,
        first_name=first_name, last_name=last_name, middle_name=middle_name,
        email=email, group_number=group_number, group_name=group_name, course_year=course_year,
    )

    if success:
        if role == "teacher":
            mark_token_used(token_info["id"])
        # записываем дату регистрации для статистики
        conn = get_connection()
        conn.execute("UPDATE users SET created_at = ? WHERE login = ?",
                     (datetime.now(timezone.utc).isoformat(), login))
        conn.commit()
        conn.close()
        return jsonify({"message": "Аккаунт создан! Теперь войдите в систему."})
    else:
        return jsonify({"error": "Этот email уже зарегистрирован"}), 400

# АВТОРИЗАЦИЯ

@app.route("/api/login", methods=["POST"])
def login():
    body          = request.get_json()
    login_val     = body.get("login", "")
    password      = body.get("password", "")
    selected_role = body.get("role", "")

    user = verify_password(login_val, password)
    if not user:
        return jsonify({"error": "Неверный логин или пароль"}), 401

    if selected_role and user["role"] != selected_role:
        return jsonify({"error": "Неверная роль для этого аккаунта"}), 403

    record_event("visit", user["id"])

    return jsonify({
        "id":           user["id"],
        "name":         user["name"],
        "login":        user["login"],
        "role":         user["role"],
        "email":        user.get("email"),
        "group_number": user.get("group_number"),
        "group_name":   user.get("group_name"),
        "course_year":  user.get("course_year"),
        "token":        create_token(user["id"]),
    })

@app.route("/api/change-password", methods=["POST"])
@login_required
def change_pwd():
    body         = request.get_json() or {}
    user_id      = g.user["id"]
    old_password = body.get("old_password", "")
    new_password = body.get("new_password", "")

    if not user_id or not old_password or not new_password:
        return jsonify({"error": "Заполните все поля"}), 400

    if len(new_password) < 4:
        return jsonify({"error": "Пароль должен быть не менее 4 символов"}), 400

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT password FROM users WHERE id = ?", (user_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "Пользователь не найден"}), 404

    from werkzeug.security import check_password_hash
    if not check_password_hash(row["password"], old_password):
        return jsonify({"error": "Старый пароль неверен"}), 401

    change_password(user_id, new_password)
    return jsonify({"message": "Пароль успешно изменён!"})

# Отправка ответов студента.

@app.route("/api/submit", methods=["POST"])
@login_required
def submit():
    body       = request.get_json() or {}
    user_id    = g.user["id"]
    answers    = body.get("answers", {})
    time_spent = body.get("time_spent", None)
    timed_out  = body.get("timed_out") is True
    attempt_id = body.get("attempt_id", "")

    if not isinstance(answers, dict):
        return jsonify({"error": "Неверный формат ответов"}), 400

    # Вопросы и правильные ответы берём из попытки на сервере, а не от браузера.
    attempt = claim_attempt(attempt_id, user_id)
    if not attempt:
        return jsonify({
            "error": "Попытка теста не найдена, уже отправлена или устарела. Начните тест заново.",
            "code": "attempt_invalid"
        }), 400
    questions = attempt["questions"]

    # Время проверяем на сервере, а не верим браузеру.
    elapsed = (datetime.now(timezone.utc) - attempt["started_at"]).total_seconds()
    if elapsed > TEST_SECONDS + LATE_GRACE:
        return jsonify({
            "error": "Время теста истекло, ответы не приняты. Начните тест заново.",
            "code": "attempt_invalid"
        }), 400
    if timed_out and elapsed < TEST_SECONDS - EARLY_TOLERANCE:
        timed_out = False  # время ещё не вышло: неполные ответы принимать нельзя
    spent_seconds = int(min(elapsed, TEST_SECONDS))
    time_taken = f"{spent_seconds // 60} мин {spent_seconds % 60} сек"

    try:
        question_map = build_question_map(questions)
        # Берём только ответы на вопросы этой попытки.
        clean_answers = {qid: answers[qid] for qid in question_map if qid in answers}

        if len(clean_answers) < len(question_map) and not timed_out:
            release_attempt(attempt_id)
            unanswered = len(question_map) - len(clean_answers)
            return jsonify({
                "error": f"Ответ не на все вопросы. Пропущено: {unanswered} из {len(question_map)}"
            }), 400

        # Неотвеченные вопросы (при таймауте) дают 0 баллов, но входят в максимум.
        scoring_answers = {qid: clean_answers.get(qid) for qid in question_map}
        scores  = calculate_scores(scoring_answers, question_map)
        profile = get_profile(scores)
        basic_recommendations = get_recommendations(scores)

        try:
            ai_recommendations = get_ai_recommendations(g.user["name"], scores, profile, time_spent)
        except Exception as e:
            ai_recommendations = "\n".join(basic_recommendations)
            print(f"ИИ ошибка: {e}")

        record_event("ai_request", user_id)

        save_result(
            user_id, scores, profile, ai_recommendations,
            questions_snapshot=json.dumps(questions, ensure_ascii=False),
            answered_questions=json.dumps(clean_answers),
            time_taken=time_taken
        )
    except Exception:
        # Что-то сломалось у нас: возвращаем попытку, чтобы студент мог отправить ещё раз.
        release_attempt(attempt_id)
        raise

    return jsonify({
        "scores":          scores,
        "profile":         profile,
        "recommendations": ai_recommendations,
        "time_taken":      time_taken,
        # После сдачи теста правильные ответы можно показать для разбора.
        "review":          questions
    })

# РЕЗУЛЬТАТЫ

@app.route("/api/results", methods=["GET"])
@roles_required("teacher", "admin")
def results():
    rows = get_all_results()
    return jsonify(rows)

@app.route("/api/results/my/<int:user_id>", methods=["GET"])
@login_required
def my_results(user_id):
    if not is_self_or_staff(user_id):
        return jsonify({"error": "Недостаточно прав"}), 403
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("""
        SELECT algo, coding, design, entrepreneur, teamwork, profile,
               recommendations, questions_snapshot, answered_questions, time_taken
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

# КОМАНДЫ

@app.route("/api/teams", methods=["GET"])
@roles_required("teacher", "admin")
def generate_teams():
    rows = get_all_results()
    if not rows:
        return jsonify({"error": "Нет данных о студентах"}), 404
    try:
        teams = get_teams(rows)
        record_event("ai_request")
    except Exception as e:
        return jsonify({"error": f"Ошибка генерации: {e}"}), 500
    return jsonify({"teams": teams})

@app.route("/api/teams/no-ai", methods=["GET"])
@roles_required("teacher", "admin")
def generate_teams_no_ai():
    rows = get_all_results()
    if not rows:
        return jsonify({"error": "Нет данных о студентах"}), 404
    teams = form_teams_without_ai(rows, team_size=5)
    return jsonify({"teams": teams})

@app.route("/api/teams/pin", methods=["POST"])
@roles_required("teacher", "admin")
def pin_team():
    body    = request.get_json() or {}
    user_id = g.user["id"]
    team    = body.get("team")

    if not user_id or not team:
        return jsonify({"error": "Укажите user_id и team"}), 400

    team_id = add_pinned_team(user_id, team)
    return jsonify({"id": team_id, "message": "Команда закреплена"})

@app.route("/api/teams/pinned/<int:user_id>", methods=["GET"])
@roles_required("teacher", "admin")
def get_user_pinned_teams(user_id):
    if user_id != g.user["id"] and g.user["role"] != "admin":
        return jsonify({"error": "Недостаточно прав"}), 403
    pinned = get_pinned_teams(user_id)
    return jsonify({"pinned": pinned})

@app.route("/api/teams/pin/<int:team_id>", methods=["DELETE"])
@roles_required("teacher", "admin")
def unpin_team(team_id):
    user_id = g.user["id"]

    ok = delete_pinned_team(team_id, user_id)
    if not ok:
        return jsonify({"error": "Команда не найдена или нет доступа"}), 404

    return jsonify({"message": "Команда откреплена"})

# ПОРТФОЛИО

@app.route("/api/portfolio/<int:user_id>", methods=["GET"])
@login_required
def portfolio_get(user_id):
    if not is_self_or_staff(user_id):
        return jsonify({"error": "Недостаточно прав"}), 403
    items = get_portfolio(user_id)
    for item in items:
        if item.get("file_path"):
            # Подписанная ссылка: без неё файл не откроется.
            item["file_url"] = f"/api/portfolio/file/{item['file_path']}?sig={sign_file_link(item['file_path'])}"
    return jsonify(items)

@app.route("/api/portfolio", methods=["POST"])
@login_required
def portfolio_add():
    user_id     = g.user["id"]
    type_       = (request.form.get("type") or "").strip()
    title       = (request.form.get("title") or "").strip()
    description = (request.form.get("description") or "").strip()
    url         = (request.form.get("url") or "").strip()

    if not user_id or not type_ or not title:
        return jsonify({"error": "Укажите тип и название"}), 400

    if type_ not in ("certificate", "diploma", "article", "project"):
        return jsonify({"error": "Неверный тип"}), 400

    file_path = None
    file_name = None

    uploaded = request.files.get("file")
    if uploaded and uploaded.filename:
        if not allowed_file(uploaded.filename):
            return jsonify({"error": "Недопустимый формат файла. Разрешены: " + ", ".join(sorted(ALLOWED_EXTENSIONS))}), 400
        ext         = uploaded.filename.rsplit(".", 1)[1].lower()
        stored_name = f"{user_id}_{uuid.uuid4().hex}.{ext}"
        uploaded.save(os.path.join(UPLOAD_FOLDER, stored_name))
        file_path = stored_name
        file_name = uploaded.filename
        url = ""

    item_id = add_portfolio_item(user_id, type_, title, description, url, file_path, file_name)
    return jsonify({"id": item_id, "message": "Добавлено"})

@app.route("/api/portfolio/add", methods=["POST"])
@login_required
def portfolio_add_json():
    body        = request.get_json() or {}
    user_id     = g.user["id"]
    type_       = body.get("type", "project")
    title       = body.get("title", "")
    description = body.get("description", "")
    link        = body.get("link", body.get("url", ""))
    file_data   = body.get("file_data", None)
    file_name   = body.get("file_name", None)

    add_portfolio_item(user_id, type_, title, description, link, None, file_name, file_data)
    return jsonify({"message": "Добавлено в портфолио"})

# Файл открывается обычной ссылкой (без заголовка Authorization), поэтому доступ
# проверяется подписью ?sig=..., которую сервер выдаёт в списке портфолио.
@app.route("/api/portfolio/file/<path:filename>", methods=["GET"])
def portfolio_file(filename):
    if not verify_file_link(request.args.get("sig", ""), filename):
        return jsonify({"error": "Ссылка недействительна или устарела. Обновите страницу."}), 403
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route("/api/portfolio/file-data/<int:item_id>", methods=["GET"])
@login_required
def get_portfolio_file_endpoint(item_id):
    conn  = get_connection()
    owner = conn.execute("SELECT user_id FROM portfolio WHERE id = ?", (item_id,)).fetchone()
    conn.close()
    if not owner:
        return jsonify({"error": "Файл не найден"}), 404
    if not is_self_or_staff(owner["user_id"]):
        return jsonify({"error": "Недостаточно прав"}), 403
    result = get_portfolio_file(item_id)
    if not result:
        return jsonify({"error": "Файл не найден"}), 404
    return jsonify(result)

@app.route("/api/portfolio/<int:item_id>", methods=["DELETE"])
@login_required
def portfolio_delete(item_id):
    user_id = g.user["id"]

    found, file_path = delete_portfolio_item(item_id, user_id)
    if not found:
        return jsonify({"error": "Не найдено или нет доступа"}), 404

    if file_path:
        try:
            os.remove(os.path.join(UPLOAD_FOLDER, file_path))
        except OSError:
            pass

    return jsonify({"message": "Удалено"})

@app.route("/api/portfolio/delete/<int:item_id>", methods=["DELETE"])
@login_required
def portfolio_delete_alias(item_id):
    user_id = g.user["id"]
    delete_portfolio_item(item_id, user_id)
    return jsonify({"message": "Удалено"})

# ПОДДЕРЖКА

ALLOWED_SUPPORT_STATUSES = ("open", "in_progress", "completed")

@app.route("/api/support", methods=["POST"])
@login_required
def support_create():
    body    = request.get_json() or {}
    user_id = g.user["id"]
    subject = (body.get("subject") or "").strip()
    message = (body.get("message") or "").strip()

    if not user_id or not subject or not message:
        return jsonify({"error": "Укажите тему и текст запроса"}), 400

    req_id = add_support_request(user_id, subject, message)
    return jsonify({"id": req_id, "message": "Запрос отправлен"})

@app.route("/api/support", methods=["GET"])
@roles_required("admin")
def support_list():
    rows = get_all_support_requests()
    return jsonify(rows)

@app.route("/api/support/<int:request_id>", methods=["PATCH"])
@roles_required("admin")
def support_update(request_id):
    body        = request.get_json() or {}
    status      = body.get("status")
    admin_reply = body.get("admin_reply", "")

    if status not in ALLOWED_SUPPORT_STATUSES:
        return jsonify({"error": "Неверный статус"}), 400

    ok = update_support_status(request_id, status, admin_reply)
    if not ok:
        return jsonify({"error": "Запрос не найден"}), 404

    if status == "completed":
        ticket_info = get_ticket_with_user_email(request_id)
        if ticket_info and ticket_info.get("email"):
            send_ticket_resolved_email(
                ticket_info["email"], ticket_info["name"],
                ticket_info["subject"], admin_reply
            )

    return jsonify({"message": "Статус обновлён"})

# Совместимость с интерфейсом администратора (/api/tickets).
@app.route("/api/tickets", methods=["GET"])
@roles_required("admin")
def get_tickets():
    rows = get_all_support_requests()
    return jsonify(rows)

@app.route("/api/tickets/create", methods=["POST"])
@login_required
def create_support_ticket():
    body      = request.get_json() or {}
    user_id   = g.user["id"]
    subject   = (body.get("subject") or "").strip()
    message   = (body.get("message") or "").strip()

    if not user_id or not subject or not message:
        return jsonify({"error": "Укажите тему и текст запроса"}), 400

    req_id = add_support_request(user_id, subject, message)
    return jsonify({"id": req_id, "message": "Запрос отправлен"})

@app.route("/api/tickets/status/<int:ticket_id>", methods=["PATCH"])
@roles_required("admin")
def update_ticket_status_alias(ticket_id):
    body        = request.get_json() or {}
    status      = body.get("status", "")
    admin_reply = body.get("admin_reply", "")

    if status not in ALLOWED_SUPPORT_STATUSES:
        return jsonify({"error": "Неверный статус"}), 400

    ok = update_support_status(ticket_id, status, admin_reply)
    if not ok:
        return jsonify({"error": "Запрос не найден"}), 404

    if status == "completed":
        ticket_info = get_ticket_with_user_email(ticket_id)
        if ticket_info and ticket_info.get("email"):
            send_ticket_resolved_email(
                ticket_info["email"], ticket_info["name"],
                ticket_info["subject"], admin_reply
            )

    return jsonify({"message": "Статус обновлён"})

# Приглашения преподавателей.
@app.route("/api/invite/create", methods=["POST"])
@roles_required("admin")
def create_invite():
    body  = request.get_json()
    email = body.get("email", "").strip()
    role  = body.get("role", "teacher")

    if not email:
        return jsonify({"error": "Укажите email"}), 400

    token = create_invite_token(email, role)

    try:
        from email_sender import send_invite_email
        send_invite_email(email, token, role)
    except Exception as e:
        print(f"Не удалось отправить письмо: {e}")

    return jsonify({"message": "Инвайт создан и отправлен", "token": token})

@app.route("/api/invite/list", methods=["GET"])
@roles_required("admin")
def list_invites():
    rows = get_all_invite_tokens()
    return jsonify(rows)

# АДМИН — управление пользователями

@app.route("/api/users", methods=["GET"])
@roles_required("admin")
def users():
    rows = get_all_users()
    return jsonify(rows)

@app.route("/api/users/add", methods=["POST"])
@roles_required("admin")
def create_user():
    body     = request.get_json()
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
    
@app.route("/api/users/<int:user_id>/credentials", methods=["PATCH"])
@roles_required("admin")
def update_credentials(user_id):
    body         = request.get_json() or {}
    new_login    = body.get("login", "").strip() or None
    new_password = body.get("password", "").strip() or None

    if not new_login and not new_password:
        return jsonify({"error": "Укажите новый логин или пароль"}), 400

    ok = update_user_credentials(user_id, new_login, new_password)
    if not ok:
        return jsonify({"error": "Логин уже занят"}), 400

    return jsonify({"message": "Данные обновлены"})

@app.route("/<path:path>")
def serve_react(path):
    full_path = os.path.join(app.static_folder, path)
    if os.path.exists(full_path):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")

if __name__ == "__main__":
    # Режим отладки включается только если в .env задано FLASK_DEBUG=1
    app.run(debug=os.getenv("FLASK_DEBUG") == "1")
