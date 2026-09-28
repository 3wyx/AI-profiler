import React, { useState } from 'react';
import styles from './SupportRequestModal.module.css';

const API = 'http://localhost:5000';

const SupportRequestModal = ({ isOpen, onClose, userId }) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setSubject('');
    setMessage('');
    setError('');
    setSuccess(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      setError('Заполните тему и текст запроса');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка отправки запроса');
        return;
      }
      setSuccess(true);
    } catch {
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {success ? (
          <div className={styles.successBox}>
            <div className={styles.successIcon}>✅</div>
            <h3 className={styles.title}>Запрос отправлен</h3>
            <p className={styles.text}>
              Администратор получит уведомление и рассмотрит ваш запрос.
            </p>
            <button className={styles.closeBtn} onClick={handleClose}>Готово</button>
          </div>
        ) : (
          <>
            <h3 className={styles.title}>Связаться с поддержкой</h3>
            <p className={styles.hint}>
              Опишите проблему или вопрос — администратор свяжется с вами или решит её.
            </p>

            <input
              className={styles.input}
              placeholder="Тема запроса *"
              value={subject}
              maxLength={120}
              onChange={(e) => setSubject(e.target.value)}
            />
            <textarea
              className={styles.textarea}
              placeholder="Текст запроса *"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <button className={styles.submitBtn} onClick={handleSubmit} disabled={loading}>
                {loading ? 'Отправка...' : 'Отправить'}
              </button>
              <button className={styles.cancelBtn} onClick={handleClose}>Отмена</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SupportRequestModal;
