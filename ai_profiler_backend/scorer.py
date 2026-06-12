import json

# Загружаем вопросы из файла
with open("questions.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Строим удобный словарь: id вопроса -> правильный ответ и модуль
question_map = {}
for module in data["modules"]:
    for q in module["questions"]:
        question_map[q["id"]] = {
            "correct": q["correct"],
            "points": q["points"],
            "module_id": module["id"],
            "weight": module["weight"]
        }

# Считаем баллы по каждому модулю
def calculate_scores(answers):
    # answers — словарь вида {"algo_1": 0, "algo_2": 2, ...}
    # значение — индекс выбранного ответа (0, 1, 2 или 3)

    raw_scores = {
        "algo": 0,
        "coding": 0,
        "design": 0,
        "entrepreneur": 0,
        "teamwork": 0
    }
    max_scores = {
        "algo": 0,
        "coding": 0,
        "design": 0,
        "entrepreneur": 0,
        "teamwork": 0
    }

    for q_id, chosen in answers.items():
        if q_id not in question_map:
            continue
        q = question_map[q_id]
        mod = q["module_id"]
        max_scores[mod] += q["points"]
        if chosen == q["correct"]:
            raw_scores[mod] += q["points"]

    # Переводим в проценты (0-100)
    final_scores = {}
    for mod in raw_scores:
        if max_scores[mod] > 0:
            final_scores[mod] = round(raw_scores[mod] / max_scores[mod] * 100)
        else:
            final_scores[mod] = 0

    return final_scores

# Определяем тип профиля по баллам
def get_profile(scores):
    profile = "Универсальный участник"

    if scores.get("coding", 0) > 80:
        profile = "Разработчик (Developer)"
    elif scores.get("algo", 0) > 80:
        profile = "Аналитик (Problem Solver)"
    elif scores.get("design", 0) > 75:
        profile = "Дизайнер (UX/UI)"
    elif scores.get("entrepreneur", 0) > 75:
        profile = "Стартап-мышление (Startup Mindset)"
    elif scores.get("teamwork", 0) > 80:
        profile = "Командный лидер (Leader)"

    return profile

# Даём рекомендации на основе профиля
def get_recommendations(scores):
    recommendations = []

    if scores.get("algo", 0) >= 60:
        recommendations.append("Участвуй в олимпиадах по программированию")
    if scores.get("coding", 0) >= 60:
        recommendations.append("Попробуй роль Backend или Full-stack разработчика")
    if scores.get("design", 0) >= 60:
        recommendations.append("Развивай навыки UI/UX — Figma, прототипирование")
    if scores.get("entrepreneur", 0) >= 60:
        recommendations.append("Участвуй в хакатонах и стартап-конкурсах")
    if scores.get("teamwork", 0) >= 60:
        recommendations.append("Попробуй роль тимлида в следующем проекте")

    if not recommendations:
        recommendations.append("Попробуй углубиться в любое одно направление IT")

    return recommendations