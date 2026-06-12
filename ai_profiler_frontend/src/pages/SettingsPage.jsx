import React, { useContext, useState } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import Modal from '../components/Modal';
import styles from './SettingsPage.module.css';

const SettingsPage = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [modalText, setModalText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openJokeModal = (type) => {
    if (type === 'password') {
      setModalText('А голову дома не забыл? Лан поможем, после летника.');
    } else {
      setModalText('Поддержка не поможет, она на летнике, и ленивая, разбирайтесь сами.');
    }
    setIsModalOpen(true);
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Настройки системы</h1>

      <div className={styles.card}>
        <div className={styles.settingRow}>
          <div>
            <h3>Тема оформления</h3>
            <p className={styles.desc}>Переключение между светлым и темным интерфейсом сайта</p>
          </div>
          <button className={styles.themeBtn} onClick={toggleTheme}>
            {theme === 'dark' ? '☀️ Светлая' : '🌙 Темная'}
          </button>
        </div>

        <div className={styles.settingRow}>
          <div>
            <h3>Безопасность</h3>
            <p className={styles.desc}>Сброс текущего токена доступа или пароля</p>
          </div>
          <button className={styles.actionBtn} onClick={() => openJokeModal('password')}>
            Забыл пароль?
          </button>
        </div>

        <div className={styles.settingRow}>
          <div>
            <h3>Технический центр</h3>
            <p className={styles.desc}>Связь с администраторами платформы AI-profiler</p>
          </div>
          <button className={`${styles.actionBtn} ${styles.greenBtn}`} onClick={() => openJokeModal('support')}>
            Поддержка
          </button>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} text={modalText} />
    </div>
  );
};

export default SettingsPage;