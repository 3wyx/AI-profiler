import React, { useState, useEffect, useRef } from 'react';
import styles from './TestingPage.module.css';

const API = '';
const TOTAL_SECONDS = 60 * 60;

const TestingPage = ({ user, onResultsReady }) => {
  const [modules, setModules] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const timerRef = useRef(null);
  const moduleStartTime = useRef({});
  const testStartTime = useRef(null);

  useEffect(() => {
    if (!user?.id) return;
    const checkExistingResults = async () => {
      try {
        const res = await fetch(`${API}/api/results/my/${user.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.questions_snapshot && data.answered_questions) {
            const savedQuestions = JSON.parse(data.questions_snapshot);
            const savedAnswers = JSON.parse(data.answered_questions);
            const flat = [];
            savedQuestions.modules.forEach((mod) => {
              mod.questions.forEach((q) => {
                flat.push({ ...q, module_id: mod.id });
              });
            });
            setAllQuestions(flat);
            setModules(savedQuestions.modules);
            setResults({
              scores: {
                algo:         data.algo,
                coding:       data.coding,
                design:       data.design,
                entrepreneur: data.entrepreneur,
                teamwork:     data.teamwork,
              },
              profile:         data.profile,
              recommendations: data.recommendations,
              userAnswers:     savedAnswers,
              timeTaken:       data.time_taken || null,
              timeout:         false,
            });
            setFinished(true);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
      }
      loadQuestions();
    };
    checkExistingResults();
  }, [user]);

  const loadQuestions = () => {
    fetch(`${API}/api/questions`)
      .then((res) => res.json())
      .then((data) => {
        const mods = data.modules;
        setModules(mods);
        const flat = [];
        mods.forEach((mod) => {
          mod.questions.forEach((q) => {
            flat.push({ ...q, module_id: mod.id });
          });
        });
        setAllQuestions(flat);
        setLoading(false);
      })
      .catch(() => {
        setError('Не удалось загрузить вопросы. Проверьте что бэкенд запущен.');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (finished || loading || !started) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleFinish(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [finished, loading, started]);

  const formatTime = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const isWarning = secondsLeft <= 60;

  const handleAnswer = (optionIndex) => {
    if (finished) return;
    const q = allQuestions[currentQuestion];
    setAnswers((prev) => ({ ...prev, [q.id]: optionIndex }));
  };

  // Фиксируем начало теста и время прохождения модулей.
  const handleStart = () => {
    modules.forEach((mod) => {
      moduleStartTime.current[mod.id] = Date.now();
    });
    testStartTime.current = Date.now();
    setStarted(true);
  };

  const handleFinish = async (timeout = false) => {
    clearInterval(timerRef.current);
    setSubmitting(true);

    const totalSeconds = Math.round((Date.now() - testStartTime.current) / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const timeLabel = `${mins} мин ${secs} сек`;

    const timeSpent = {};
    modules.forEach((mod) => {
      const elapsed = Math.round((Date.now() - moduleStartTime.current[mod.id]) / 1000);
      timeSpent[mod.id] = elapsed;
    });

    try {
      const res = await fetch(`${API}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:            user?.id || null,
          name:               user?.name || 'Студент',
          answers,
          time_spent:         timeSpent,
          questions_snapshot: JSON.stringify({ modules }),
          time_taken:         timeLabel,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ошибка отправки результатов');
        setSubmitting(false);
        return;
      }

      setResults({ ...data, timeout, userAnswers: { ...answers }, timeTaken: timeLabel });
      if (onResultsReady) onResultsReady(data);

    } catch (err) {
      setError('Не удалось отправить результаты');
    }

    setSubmitting(false);
    setFinished(true);
  };

  const handleRetry = () => {
    setAnswers({});
    setCurrentQuestion(0);
    setSecondsLeft(TOTAL_SECONDS);
    setFinished(false);
    setResults(null);
    setError('');
    setStarted(false);
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Загружаем вопросы...</div>;
  if (error && !finished) return <div style={{ padding: '2rem', color: 'red' }}>{error}</div>;

  // Экран перед началом теста.
  if (!finished && !started) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Тестирование</h1>
        <div className={styles.card} style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ fontSize: '16px', marginBottom: '8px' }}>
            Вам предстоит ответить на <strong>{allQuestions.length}</strong> вопросов.
          </p>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            На прохождение теста отводится <strong>{formatTime(TOTAL_SECONDS)}</strong>.
            Таймер запустится сразу после нажатия кнопки ниже.
          </p>
          <button className={styles.finishBtn} onClick={handleStart}>
            Начать тест
          </button>
        </div>
      </div>
    );
  }

  if (finished && results) {
    const letters = ['А', 'Б', 'В', 'Г'];

    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Результаты теста</h1>

        {results.timeout && (
          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '10px 16px', marginBottom: '1rem', fontSize: '14px' }}>
            ⏰ Время вышло! Тест завершён автоматически.
          </div>
        )}

        <div className={styles.card} style={{ marginBottom: '1rem' }}>
          <h3>Профиль: <strong>{results.profile}</strong></h3>
          {results.timeTaken && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              ⏱ Время прохождения: {results.timeTaken}
            </p>
          )}
          <div style={{ marginTop: '0.75rem' }}>
            {Object.entries(results.scores).map(([mod, score]) => (
              <div key={mod} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '14px', borderBottom: '1px solid var(--border)' }}>
                <span>{mod}</span>
                <strong>{score}%</strong>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
          <h3>Рекомендации ИИ:</h3>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.7', marginTop: '0.5rem' }}>
            {results.recommendations}
          </p>
        </div>

        <h2 style={{ marginBottom: '1rem' }}>Разбор ответов</h2>
        {allQuestions.map((q, idx) => {
          const userAnswer = results.userAnswers[q.id];
          const isCorrect = userAnswer === q.correct;

          return (
            <div key={q.id} className={styles.card} style={{ marginBottom: '0.75rem', borderLeft: `4px solid ${isCorrect ? '#22c55e' : '#ef4444'}` }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Вопрос {idx + 1} {isCorrect ? '' : ''}
              </p>
              <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>{q.text}</p>

              {q.options.map((opt, oi) => {
                let bg = 'transparent';
                let border = '1px solid var(--border)';
                let fontWeight = 'normal';

                if (oi === q.correct) {
                  bg = 'rgba(34,197,94,0.15)';
                  border = '1px solid #22c55e';
                  fontWeight = '600';
                }
                if (oi === userAnswer && !isCorrect) {
                  bg = 'rgba(239,68,68,0.15)';
                  border = '1px solid #ef4444';
                }

                return (
                  <div key={oi} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '6px 10px', borderRadius: '6px', background: bg, border, marginBottom: '4px', fontSize: '13px', fontWeight }}>
                    <span style={{ minWidth: '16px', color: 'var(--text-muted)' }}>{letters[oi]}</span>
                    <span>{opt}</span>
                    {oi === q.correct && <span style={{ marginLeft: 'auto', color: '#22c55e' }}>✓ правильно</span>}
                    {oi === userAnswer && !isCorrect && <span style={{ marginLeft: 'auto', color: '#ef4444' }}>✗ ваш ответ</span>}
                  </div>
                );
              })}
            </div>
          );
        })}

        <button className={styles.retryBtn} onClick={handleRetry} style={{ marginTop: '1rem' }}>
          Пройти заново
        </button>
      </div>
    );
  }

  const q = allQuestions[currentQuestion];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Модуль тестирования</h1>
        <div className={`${styles.timer} ${isWarning ? styles.timerWarning : ''}`}>
          ⏱ {formatTime(secondsLeft)}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.progressContainer}>
          {allQuestions.map((_, idx) => (
            <div
              key={idx}
              className={`${styles.dot}
                ${idx < currentQuestion ? styles.doneDot : ''}
                ${idx === currentQuestion ? styles.activeDot : ''}
                ${answers[allQuestions[idx].id] !== undefined && idx !== currentQuestion ? styles.answeredDot : ''}`}
              onClick={() => setCurrentQuestion(idx)}
            >
              {idx + 1}
            </div>
          ))}
        </div>

        <div className={styles.questionBlock}>
          <h2>Вопрос {currentQuestion + 1}: {q.text}</h2>
          <div className={styles.options}>
            {q.options.map((opt, idx) => (
              <button
                key={idx}
                className={`${styles.optionBtn} ${answers[q.id] === idx ? styles.selectedOption : ''}`}
                onClick={() => handleAnswer(idx)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.navBtns}>
            <button className={styles.navBtn} disabled={currentQuestion === 0} onClick={() => setCurrentQuestion((p) => p - 1)}>
              ← Назад
            </button>
            <button className={styles.navBtn} disabled={currentQuestion === allQuestions.length - 1} onClick={() => setCurrentQuestion((p) => p + 1)}>
              Вперёд →
            </button>
          </div>
          <button className={styles.finishBtn} onClick={() => handleFinish(false)} disabled={submitting}>
            {submitting ? 'Отправляем...' : 'Завершить'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestingPage;