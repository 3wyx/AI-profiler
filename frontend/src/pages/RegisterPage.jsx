import React, { useState } from 'react';
import styles from './AuthPage.module.css';
import regStyles from './RegisterPage.module.css';

const API = 'http://localhost:5000';

const RegisterPage = ({ onSwitch }) => {
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Общие поля
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Только для студента
  const [groupNumber, setGroupNumber] = useState('');
  const [groupName, setGroupName] = useState('');
  const [courseYear, setCourseYear] = useState('');
  const [inviteToken, setInviteToken] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    if (password.length < 4) {
      setError('Пароль должен быть не менее 4 символов');
      return;
    }

    const fullName = [lastName, firstName, middleName].filter(Boolean).join(' ');
    const login = email; // корпоративная почта как логин

    const body = {
      name: fullName,
      login,
      password,
      role,
      first_name: firstName,
      last_name: lastName,
      middle_name: middleName,
      email,
      ...(role === 'student' && {
        group_number: groupNumber,
        group_name: groupName,
        course_year: courseYear,
      }),
      ...(role === 'teacher' && {
        invite_token: inviteToken,
      }),
    };

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ошибка регистрации');
        return;
      }

      setSuccess('Аккаунт создан! Теперь войдите в систему.');
      setTimeout(() => onSwitch(), 2000);
    } catch {
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${styles.container} ${regStyles.bgContainer}`}>
      <div className={`${styles.card} ${regStyles.wideCard}`}>
        <h2 className={styles.title}>Регистрация</h2>
        <p className={styles.subtitle}>Выберите статус для регистрации в системе</p>

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
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={regStyles.row}>
            <div className={regStyles.field}>
              <input
                type="text"
                placeholder="Фамилия"
                required
                className={styles.input}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            
            <div className={regStyles.field}>
              <input
                type="text"
                placeholder="Имя"
                required
                className={styles.input}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
          </div>

          <div className={regStyles.field}>
            <input
              type="text"
              placeholder="Отчество (если есть)"
              className={styles.input}
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
            />
          </div>

          {role === 'student' && (
            <>
              <div className={regStyles.row}>
                <div className={regStyles.field}>
                  <input
                    type="text"
                    placeholder="Номер группы"
                    required
                    className={styles.input}
                    value={groupNumber}
                    onChange={(e) => setGroupNumber(e.target.value)}
                  />
                </div>

                <div className={regStyles.field}>
                  <select
                    required
                    className={`${styles.input} ${regStyles.select}`}
                    value={courseYear}
                    onChange={(e) => setCourseYear(e.target.value)}
                  >
                    <option value="">Выберите курс</option>
                    <option value="1">1 курс</option>
                    <option value="2">2 курс</option>
                    <option value="3">3 курс</option>
                    <option value="4">4 курс</option>
                    <option value="5">5 курс</option>
                  </select>
                </div>
              </div>

              <div className={regStyles.field}>
                <input
                  type="text"
                  placeholder="Название учебной группы"
                  required
                  className={styles.input}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>
            </>
          )}

          <div className={regStyles.field}>
            <input
              type="email"
              placeholder={role === 'student' ? 'Почта' : 'Почта (корпоративная)'}
              required
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {role === 'teacher' && (
            <div className={regStyles.field}>
              <input
                type="text"
                placeholder="Код приглашения (получен на почту от администратора)"
                required
                className={styles.input}
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value.toUpperCase())}
              />
            </div>
          )}

          <div className={regStyles.row}>
            <div className={regStyles.field}>
              <input
                type="password"
                placeholder="Пароль, не менее 4 символов"
                required
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className={regStyles.field}>
              <input
                type="password"
                placeholder="Повторите пароль"
                required
                className={styles.input}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <p className={regStyles.errorMsg}>{error}</p>}
          {success && <p className={regStyles.successMsg}>{success}</p>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Регистрируем...' : 'Зарегистрироваться'}
          </button>

          <button
            type="button"
            className={regStyles.switchBtn}
            onClick={onSwitch}
          >
            Уже есть аккаунт? Войти
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
