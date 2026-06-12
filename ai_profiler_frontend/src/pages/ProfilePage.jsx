import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import styles from './ProfilePage.module.css';

const MODULE_NAMES = {
  algo: 'Алгоритмы',
  coding: 'Кодинг',
  design: 'Дизайн',
  entrepreneur: 'Бизнес',
  teamwork: 'Команда',
};

// Пустой чарт если тест ещё не пройден
const emptyData = Object.values(MODULE_NAMES).map((name) => ({ subject: name, A: 0 }));

const ProfilePage = ({ user, results }) => {
  // Если есть результаты — строим чарт по ним, иначе пустой
  const chartData = results
    ? Object.entries(results.scores).map(([key, value]) => ({
        subject: MODULE_NAMES[key] || key,
        A: value,
      }))
    : emptyData;

  return (
    <div className={styles.page} id="skills">
      <h1 className={styles.title}>Профиль студента</h1>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h3>Информация</h3>
          <p><strong>Студент:</strong> {user?.name || '—'}</p>
          <p><strong>Логин:</strong> {user?.login || '—'}</p>
          <p><strong>Роль:</strong> {user?.role === 'student' ? 'Студент' : user?.role === 'teacher' ? 'Преподаватель' : 'Админ'}</p>
          {results && <p><strong>Профиль:</strong> {results.profile}</p>}
        </div>

        <div className={styles.card}>
          <h3>Актуальный срез навыков</h3>
          {!results && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Пройдите тест чтобы увидеть результаты
            </p>
          )}
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="subject" stroke="var(--text-main)" fontSize={12} />
                <Radar name="Навыки" dataKey="A" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${styles.card} ${styles.fullWidth}`}>
          <h3>Последние рекомендации ИИ</h3>
          {results ? (
            <p className={styles.aiText} style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7' }}>
              {results.recommendations}
            </p>
          ) : (
            <p className={styles.aiText}>
              Рекомендации появятся после прохождения теста.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
