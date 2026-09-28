import React, { useContext, useState } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import Modal from '../components/Modal';
import SupportRequestModal from '../components/SupportRequestModal';
import styles from './SettingsPage.module.css';
import toggleLight from '../assets/toggle-light.png';
import toggleDark from '../assets/toggle-dark.png';

const API = 'http://localhost:5000';

const SettingsPage = ({ user }) => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [modalText, setModalText]   = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  // Смена пароля
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [oldPwd, setOldPwd]           = useState('');
  const [newPwd, setNewPwd]           = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [pwdError, setPwdError]       = useState('');
  const [pwdSuccess, setPwdSuccess]   = useState('');
  const [pwdLoading, setPwdLoading]   = useState(false);

  const isAdmin = user?.role === 'admin';

  const handleChangePassword = async () => {
    setPwdError('');
    setPwdSuccess('');

    if (!oldPwd || !newPwd || !confirmPwd) {
      setPwdError('Заполните все поля'); return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('Новые пароли не совпадают'); return;
    }
    if (newPwd.length < 4) {
      setPwdError('Пароль должен быть не менее 4 символов'); return;
    }

    setPwdLoading(true);
    try {
      const res = await fetch(`${API}/api/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:      user?.id,
          old_password: oldPwd,
          new_password: newPwd,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwdError(data.error || 'Ошибка');
      } else {
        setPwdSuccess('Пароль успешно изменён!');
        setOldPwd(''); setNewPwd(''); setConfirmPwd('');
        setTimeout(() => { setShowPwdForm(false); setPwdSuccess(''); }, 2000);
      }
    } catch {
      setPwdError('Не удалось подключиться к серверу');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Настройки системы</h1>

      <div className={styles.card}>

        {/* Тема */}
        <div className={styles.settingRow}>
          <div>
            <h3>Тема оформления</h3>
            <p className={styles.desc}>Переключение между светлым и темным интерфейсом сайта</p>
          </div>
          <button className={styles.themeToggle} onClick={toggleTheme}>
            <img
              src={theme === 'dark' ? toggleDark : toggleLight}
              alt={theme === 'dark' ? 'Темная тема включена' : 'Светлая тема включена'}
              className={styles.themeToggleImg}
            />
          </button>
        </div>

        {/* Безопасность — смена пароля */}
        <div className={`${styles.settingRow} ${styles.securityRow}`}>
          <div className={styles.securityRowHeader}>
            <div>
              <h3>Безопасность</h3>
              <p className={styles.desc}>Смена текущего пароля</p>
            </div>
            <button
              className={styles.actionBtn}
              onClick={() => { setShowPwdForm(!showPwdForm); setPwdError(''); setPwdSuccess(''); }}
            >
              {showPwdForm ? 'Отмена' : 'Сменить пароль'}
            </button>
          </div>

          {showPwdForm && (
            <div className={styles.pwdForm}>
              <input
                className={styles.pwdInput}
                type="password"
                placeholder="Старый пароль"
                value={oldPwd}
                onChange={e => setOldPwd(e.target.value)}
              />
              <input
                className={styles.pwdInput}
                type="password"
                placeholder="Новый пароль"
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
              />
              <input
                className={styles.pwdInput}
                type="password"
                placeholder="Подтвердите новый пароль"
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
              />
              {pwdError   && <p className={styles.pwdError}>{pwdError}</p>}
              {pwdSuccess && <p className={styles.pwdSuccess}>{pwdSuccess}</p>}
              <button
                className={styles.pwdSaveBtn}
                onClick={handleChangePassword}
                disabled={pwdLoading}
              >
                {pwdLoading ? 'Сохраняем...' : 'Сохранить пароль'}
              </button>
            </div>
          )}
        </div>

        {/* Поддержка — только для не-админов */}
        {!isAdmin && (
          <div className={styles.settingRow}>
            <div>
              <h3>Технический центр</h3>
              <p className={styles.desc}>Связь с администраторами платформы AI-profiler</p>
            </div>
            <button
              className={`${styles.actionBtn} ${styles.greenBtn}`}
              onClick={() => setSupportOpen(true)}
            >
              Поддержка
            </button>
          </div>
        )}

      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} text={modalText} />

      {!isAdmin && (
        <SupportRequestModal
          isOpen={supportOpen}
          onClose={() => setSupportOpen(false)}
          userId={user?.id}
        />
      )}
    </div>
  );
};

export default SettingsPage;