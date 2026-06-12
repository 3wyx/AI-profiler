from openai import OpenAI

# Вставь свой ключ сюда
client = OpenAI(api_key="...")

# Норма времени на модуль в секундах (5 вопросов × ~20 секунд)
NORMAL_TIME = {
    "algo": 100,
    "coding": 100,
    "design": 100,
    "entrepreneur": 100,
    "teamwork": 100
}

MODULE_NAMES = {
    "algo": "Алгоритмическое мышление",
    "coding": "Кодинг",
    "design": "Дизайн-мышление",
    "entrepreneur": "Предпринимательство",
    "teamwork": "Командная работа"
}

def get_ai_recommendations(name, scores, profile, time_spent=None):
    # Формируем описание результатов
    scores_text = "\n".join([
        f"- {MODULE_NAMES[k]}: {v}%" for k, v in scores.items()
    ])

    # Формируем описание времени если передано
    time_text = ""
    if time_spent:
        slow_modules = []
        for mod, seconds in time_spent.items():
            normal = NORMAL_TIME.get(mod, 100)
            if seconds > normal * 1.5:  # потратил в 1.5 раза больше нормы
                slow_modules.append(MODULE_NAMES.get(mod, mod))

        if slow_modules:
            time_text = f"\nСтудент долго думал над модулями: {', '.join(slow_modules)}. Это может говорить о трудностях в этих областях."

    prompt = f"""
Ты — карьерный советник в сфере IT. Студент {name} прошёл тест на IT-компетенции.

Результаты:
{scores_text}
Профиль: {profile}
{time_text}

Дай персональные рекомендации на русском языке:
1. Что у студента получается хорошо (сильные стороны)
2. Что стоит развить (слабые стороны)
3. Какую IT-роль стоит рассмотреть
4. Конкретные ресурсы для обучения (курсы, книги, платформы)

Если были модули где студент долго думал — упомяни их отдельно и дай конкретный совет.
Пиши дружелюбно, как наставник. Не более 250 слов.
"""

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": prompt}
        ],
        max_tokens=600,
        temperature=0.7
    )

    return response.choices[0].message.content

def get_teams(students):
    students_text = "\n".join([
        f"- {r['name']} (профиль: {r['profile']}, алго: {r['algo']}%, кодинг: {r['coding']}%, дизайн: {r['design']}%, бизнес: {r['entrepreneur']}%, команда: {r['teamwork']}%)"
        for r in students
    ])

    prompt = f"""
Ты — HR-специалист. Распредели студентов на сбалансированные команды по 4-5 человек для хакатона.

Студенты и их компетенции:
{students_text}

Правила:
1. Каждая команда сбалансирована — разные профили в одной команде
2. В каждой команде желательно иметь разработчика, аналитика, и человека с сильной командной работой
3. Размер команды: 4-5 человек

Ответь строго в формате:
Команда 1:
- Имя — роль в команде
Обоснование: ...

Команда 2:
- Имя — роль в команде
Обоснование: ...

Пиши на русском языке.
"""

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1000,
        temperature=0.7
    )

    return response.choices[0].message.content