import React, { useState, useEffect } from 'react';
import styles from './AdminPage.module.css';

const API = '';

const STATUS_META = {
  open:        { label: 'Открыт',       emoji: '🔴', cls: 'statusOpen' },
  in_progress: { label: 'В разработке', emoji: '🟡', cls: 'statusProgress' },
  completed:   { label: 'Завершён',     emoji: '🟢', cls: 'statusDone' },
};

const ROLE_LABELS = {
  student: 'Студент',
  teacher: 'Преподаватель',
  admin:   'Админ',
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const [datePart, timePart] = dateStr.split(' ');
  if (!datePart) return dateStr;
  const [y, m, d] = datePart.split('-');
  return `${d}.${m}.${y}${timePart ? ' ' + timePart.slice(0, 5) : ''}`;
};

// ─── Модал смены логина/пароля ────────────────────────────────────────────────
const CredentialsModal = ({ userId, userName, onClose }) => {
  const [newLogin, setNewLogin]       = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState(false);
  const [loading, setLoading]         = useState(false);

  const handleSave = async () => {
    if (!newLogin.trim() && !newPassword.trim()) {
      setError('Заполните хотя бы одно поле');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/users/${userId}/credentials`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login:    newLogin.trim() || undefined,
          password: newPassword.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка обновления');
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
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Смена данных</h2>
            <span className={styles.modalSub}>{userName}</span>
          </div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {success ? (
          <div className={styles.credSuccess}>
            <p>Данные успешно обновлены</p>
            <button className={styles.statusOption} onClick={onClose}>Закрыть</button>
          </div>
        ) : (
          <div className={styles.modalBody}>
            <p className={styles.credHint}>
              Оставьте поле пустым, если не хотите его менять.
            </p>
            <div className={styles.credFields}>
              <div className={styles.credField}>
                <label className={styles.credLabel}>Новый логин</label>
                <input
                  className={styles.credInput}
                  placeholder="Введите новый логин..."
                  value={newLogin}
                  onChange={(e) => setNewLogin(e.target.value)}
                />
              </div>
              <div className={styles.credField}>
                <label className={styles.credLabel}>Новый пароль</label>
                <input
                  type="password"
                  className={styles.credInput}
                  placeholder="Введите новый пароль..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
            {error && <p className={styles.credError}>{error}</p>}
            <div className={styles.credActions}>
              <button className={styles.saveBtn} onClick={handleSave} disabled={loading}>
                {loading ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button className={styles.cancelBtn} onClick={onClose}>Отмена</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Модальное окно с полным текстом запроса ─────────────────────────────────
const RequestModal = ({ request, onClose, onStatusChange, updating }) => {
  const [showCredentials, setShowCredentials] = useState(false);
  const [replyText, setReplyText] = useState('');

  if (!request) return null;

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <div>
              <h2 className={styles.modalTitle}>{request.subject}</h2>
              <span className={styles.modalSub}>
                {request.user_name} · {ROLE_LABELS[request.user_role] || request.user_role}
              </span>
            </div>
            <button className={styles.modalClose} onClick={onClose}>✕</button>
          </div>

          <div className={styles.modalBody}>
            <p className={styles.modalDate}>{formatDate(request.created_at)}</p>
            <p className={styles.modalMessage}>{request.message}</p>
          </div>

          <div className={styles.modalBody}>
            <label className={styles.credLabel}>Комментарий для письма (необязательно):</label>
            <textarea
              className={styles.credInput}
              style={{ minHeight: '60px', width: '100%' }}
              placeholder="Например: ваш новый пароль — xyz123"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
          </div>

          <div className={styles.modalFooter}>
            <span className={styles.modalFooterLabel}>Статус запроса:</span>
            <div className={styles.statusButtons}>
              {Object.entries(STATUS_META).map(([key, { label, emoji }]) => (
                <button
                  key={key}
                  className={`${styles.statusOption} ${request.status === key ? styles.statusOptionActive : ''}`}
                  onClick={() => onStatusChange(request.id, key, replyText)}
                  disabled={updating}
                >
                  {emoji} {label}
                </button>
              ))}
            </div>
            <button className={styles.credBtn} onClick={() => setShowCredentials(true)}>
              Сменить логин / пароль пользователю
            </button>
          </div>
        </div>
      </div>

      {showCredentials && (
        <CredentialsModal
          userId={request.user_id}
          userName={request.user_name}
          onClose={() => setShowCredentials(false)}
        />
      )}
    </>
  );
};

// ─── Секция инвайт-кодов для преподавателей ──────────────────────────────────
const InviteSection = () => {
  const [email, setEmail]     = useState('');      // email, для которого создаём код
  const [invites, setInvites] = useState([]);      // список всех созданных кодов
  const [error, setError]     = useState('');      // текст ошибки
  const [lastToken, setLastToken] = useState('');  // последний созданный код (чтобы показать админу)
  const [loading, setLoading] = useState(false);   // флаг загрузки

  // Загрузка списка кодов с сервера
  const loadInvites = () => {
    fetch(`${API}/api/invite/list`)                              // запрос списка
      .then((r) => r.json())                                     // разбираем JSON
      .then((data) => setInvites(Array.isArray(data) ? data : [])) // сохраняем, если это массив
      .catch(() => setInvites([]));                              // при ошибке — пустой список
  };

  useEffect(() => { loadInvites(); }, []);                       // загружаем список при открытии страницы

  // Создание нового кода
  const handleCreate = async () => {
    if (!email.trim()) { setError('Укажите email преподавателя'); return; } // проверка пустого поля
    setLoading(true);                                            // включаем загрузку
    setError('');                                                // сбрасываем ошибку
    setLastToken('');                                            // сбрасываем прошлый код
    try {
      const res = await fetch(`${API}/api/invite/create`, {      // отправляем запрос на создание
        method: 'POST',                                          // метод POST
        headers: { 'Content-Type': 'application/json' },         // тело — JSON
        body: JSON.stringify({ email: email.trim(), role: 'teacher' }), // email и роль
      });
      const data = await res.json();                             // читаем ответ
      if (!res.ok) { setError(data.error || 'Ошибка'); return; } // показываем ошибку сервера
      setLastToken(data.token);                                  // запоминаем код, чтобы показать на экране
      setEmail('');                                              // очищаем поле
      loadInvites();                                             // обновляем таблицу
    } catch {
      setError('Не удалось подключиться к серверу');             // ошибка сети
    } finally {
      setLoading(false);                                         // выключаем загрузку
    }
  };

  return (
    <div className={styles.section} style={{ marginBottom: '1.5rem' }}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.title} style={{ fontSize: '18px' }}>Коды приглашения для преподавателей</h2>
      </div>

      {/* Поле ввода email + кнопка */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <input
          type="email"
          className={styles.searchInput}
          placeholder="Email преподавателя"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className={styles.refreshBtn} onClick={handleCreate} disabled={loading}>
          {loading ? 'Создаём...' : 'Создать код'}
        </button>
      </div>

      {error && <p style={{ color: 'red', fontSize: '13px' }}>{error}</p>}

      {/* Показываем созданный код — на случай, если письмо не дошло */}
      {lastToken && (
        <p style={{ fontSize: '14px', marginBottom: '12px' }}>
          Код создан: <strong style={{ letterSpacing: '2px' }}>{lastToken}</strong> (также отправлен на почту)
        </p>
      )}

      {/* Таблица всех кодов */}
      {invites.length === 0 ? (
        <div className={styles.emptyState}>Кодов пока нет</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Код</th>
                <th className={styles.th}>Email</th>
                <th className={styles.th}>Статус</th>
                <th className={styles.th}>Создан</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv, i) => (
                <tr key={inv.id} className={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                  <td className={styles.td}><strong>{inv.token}</strong></td>
                  <td className={styles.td}>{inv.email}</td>
                  <td className={styles.td}>{inv.used ? '✅ Использован' : '🕓 Ожидает'}</td>
                  <td className={`${styles.td} ${styles.tdMuted}`}>{formatDate(inv.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Главная страница администратора ─────────────────────────────────────────
const AdminPage = () => {
  const [requests, setRequests]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected]         = useState(null);
  const [updatingId, setUpdatingId]     = useState(null);
  const [replyText, setReplyText] = useState('');

  const load = () => {
    setLoading(true);
    fetch(`${API}/api/support`)
      .then((r) => r.json())
      .then((data) => setRequests(Array.isArray(data) ? data : []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleStatusChange = async (id, status, adminReply = '') => {
    setUpdatingId(id);
    try {
      const res = await fetch(`${API}/api/support/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_reply: adminReply }),
      });
      if (res.ok) {
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
        setSelected((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = requests.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      r.user_name?.toLowerCase().includes(q) ||
      r.subject?.toLowerCase().includes(q);
    const matchStatus = filterStatus ? r.status === filterStatus : true;
    return matchSearch && matchStatus;
  });

  const counts = {
    open:        requests.filter((r) => r.status === 'open').length,
    in_progress: requests.filter((r) => r.status === 'in_progress').length,
    completed:   requests.filter((r) => r.status === 'completed').length,
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Панель администратора</h1>

      <InviteSection />

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{requests.length}</span>
          <span className={styles.statLabel}>Всего</span>
        </div>
        <div className={`${styles.statCard} ${styles.statOpen}`}>
          <span className={styles.statNum}>{counts.open}</span>
          <span className={styles.statLabel}>Открыто</span>
        </div>
        <div className={`${styles.statCard} ${styles.statProgress}`}>
          <span className={styles.statNum}>{counts.in_progress}</span>
          <span className={styles.statLabel}>В разработке</span>
        </div>
        <div className={`${styles.statCard} ${styles.statDone}`}>
          <span className={styles.statNum}>{counts.completed}</span>
          <span className={styles.statLabel}>Завершено</span>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.filters}>
            <input
              type="text"
              placeholder="🔍 Поиск по имени или теме..."
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className={styles.filterSelect}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Все статусы</option>
              <option value="open">Открыт</option>
              <option value="in_progress">В разработке</option>
              <option value="completed">Завершён</option>
            </select>
          </div>
          <button className={styles.refreshBtn} onClick={load} disabled={loading}>
            {loading ? 'Загрузка...' : 'Обновить'}
          </button>
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <span>Загрузка запросов...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            {requests.length === 0 ? 'Запросов пока нет' : 'Ничего не найдено по вашему запросу'}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Отправитель</th>
                  <th className={styles.th}>Роль</th>
                  <th className={styles.th}>Тема</th>
                  <th className={styles.th}>Дата и время</th>
                  <th className={styles.th}>Статус</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const meta = STATUS_META[r.status] || STATUS_META.open;
                  return (
                    <tr
                      key={r.id}
                      className={i % 2 === 0 ? styles.trEven : styles.trOdd}
                      onClick={() => setSelected(r)}
                    >
                      <td className={styles.td}>
                        <div className={styles.senderName}>{r.user_name}</div>
                      </td>
                      <td className={styles.td}>
                        <span className={styles.roleBadge}>{ROLE_LABELS[r.user_role] || r.user_role}</span>
                      </td>
                      <td className={styles.td}>
                        <span className={styles.subject}>{r.subject}</span>
                      </td>
                      <td className={`${styles.td} ${styles.tdMuted}`}>{formatDate(r.created_at)}</td>
                      <td className={styles.td} onClick={(e) => e.stopPropagation()}>
                        <select
                          className={`${styles.statusSelect} ${styles[meta.cls]}`}
                          value={r.status}
                          onChange={(e) => handleStatusChange(r.id, e.target.value)}
                          disabled={updatingId === r.id}
                        >
                          <option value="open">Открыт</option>
                          <option value="in_progress">В разработке</option>
                          <option value="completed">Завершён</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RequestModal
        request={selected}
        onClose={() => setSelected(null)}
        onStatusChange={handleStatusChange}
        updating={selected && updatingId === selected.id}
      />
    </div>
  );
};

export default AdminPage;