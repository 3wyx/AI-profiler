import React, { useState } from 'react';
import styles from './AuthPage.module.css';

const API = 'http://localhost:5000';

const AuthPage = ({ onLogin }) => {
  const [role, setRole] = useState('student');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ошибка входа');
        return;
      }

      // Передаём роль и данные пользователя наверх
      onLogin(data.role, data);

    } catch (err) {
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>Авторизация</h2>
        <p className={styles.subtitle}>Выберите статус для входа в систему</p>
        
        <div className={styles.roleSelector}>
          <button 
            type="button"
            className={`${styles.roleBtn} ${role === 'student' ? styles.activeRole : ''}`}
            onClick={() => setRole('student')}
          >
            ⭐ Студент
          </button>
          <button 
            type="button"
            className={`${styles.roleBtn} ${role === 'teacher' ? styles.activeRole : ''}`}
            onClick={() => setRole('teacher')}
          >
            🌟 Преподаватель
          </button>
          <button 
            type="button"
            className={`${styles.roleBtn} ${role === 'admin' ? styles.activeRole : ''}`}
            onClick={() => setRole('admin')}
          >
            🔥 Админ
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            placeholder="Логин"
            required
            className={styles.input}
            value={login}
            onChange={(e) => setLogin(e.target.value)}
          />
          <input
            type="password"
            placeholder="Пароль"
            required
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p style={{ color: 'red', fontSize: '13px', margin: '4px 0' }}>{error}</p>}
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;
