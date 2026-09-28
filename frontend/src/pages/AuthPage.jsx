import React, { useState, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import styles from './AuthPage.module.css';
import RegisterPage from './RegisterPage';
import toggleLight from '../assets/toggle-light.png';
import toggleDark from '../assets/toggle-dark.png';
import bgImage from '../assets/cosmos_1567965016.jpeg';

const API = '';

const AuthPage = ({ onLogin }) => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [role, setRole] = useState('student');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

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

      onLogin(data.role, data);

    } catch (err) {
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  // Переключатель темы — картинка показывает текущую тему,
  // клик переключает на противоположную 
  // — общая для страницы входа и регистрации
  const themeToggle = (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={toggleTheme}
      title="Переключить тему оформления"
    >
      <img
        src={theme === 'dark' ? toggleDark : toggleLight}
        alt={theme === 'dark' ? 'Темная тема включена' : 'Светлая тема включена'}
        className={styles.themeToggleImg}
      />
    </button>
  );

  // Показываем страницу регистрации
  if (showRegister) {
    return (
      <>
        {themeToggle}
        <RegisterPage onSwitch={() => setShowRegister(false)} onLogin={onLogin} />
      </>
    );
  }

  return (
    <div className={`${styles.container} ${styles.loginBg}`}>
      {themeToggle}
      <div className={styles.card}>
        <h2 className={styles.title}>Авторизация</h2>
        <p className={styles.subtitle}>Выберите статус для входа в систему</p>
        
        <div className={styles.roleSelector}>
          <button 
            type="button"
            className={`${styles.roleBtn} ${role === 'student' ? styles.activeRole : ''}`}
            onClick={() => setRole('student')}
          >
            Студент
          </button>
          <button 
            type="button"
            className={`${styles.roleBtn} ${role === 'teacher' ? styles.activeRole : ''}`}
            onClick={() => setRole('teacher')}
          >
           Преподаватель
          </button>
          <button 
            type="button"
            className={`${styles.roleBtn} ${role === 'admin' ? styles.activeRole : ''}`}
            onClick={() => setRole('admin')}
          >
           Админ
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
          <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '8px' }}>
            Нет аккаунта?{' '}
            <span
              style={{ color: 'var(--accent)', cursor: 'pointer' }}
              onClick={() => setShowRegister(true)}
            >
              Зарегистрироваться
            </span>
          </p>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;
