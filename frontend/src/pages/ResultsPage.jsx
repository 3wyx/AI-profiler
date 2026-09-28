import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, PolarRadiusAxis } from 'recharts';
import styles from './ResultsPage.module.css';

const MODULE_NAMES = {
  algo:         'Алгоритмы',
  coding:       'Кодинг',
  design:       'Дизайн',
  entrepreneur: 'Бизнес',
  teamwork:     'Команда',
};

const ResultsPage = ({ results }) => {
  if (!results) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Анализ результатов</h1>
        <div className={styles.card} style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Вы ещё не прошли тест.</p>
          <p>Перейдите во вкладку <strong>Тестирование</strong> и завершите тест — результаты появятся здесь.</p>
        </div>
      </div>
    );
  }

  const chartData = Object.entries(results.scores).map(([key, value]) => ({
    subject: MODULE_NAMES[key] || key,
    value,
  }));

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Анализ результатов</h1>
      <div className={styles.layout}>
        <div className={styles.card}>
          <h3>Интерактивная карта компетенций</h3>
          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="subject" stroke="var(--text-main)" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="var(--text-muted)" />
                <Radar name="Баллы" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: '1rem' }}>
            {chartData.map((item) => (
              <div key={item.subject} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '14px' }}>
                <span>{item.subject}</span>
                <strong>{item.value}%</strong>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.recommendations}>
          <div className={styles.card}>
            <h3>Профиль: {results.profile}</h3>
            {results.timeTaken && (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                ⏱ Время прохождения: {results.timeTaken}
              </p>
            )}
            <h3 style={{ marginTop: '1rem' }}>Рекомендации ИИ:</h3>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.7', marginTop: '0.5rem' }}>
              {results.recommendations}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;