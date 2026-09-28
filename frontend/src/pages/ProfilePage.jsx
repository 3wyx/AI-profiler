import React, { useState, useEffect, useRef } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import styles from './ProfilePage.module.css';

const API = 'http://localhost:5000';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 МБ
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'zip', 'rar'];

const MODULE_NAMES = {
  algo: 'Алгоритмы',
  coding: 'Кодинг',
  design: 'Дизайн',
  entrepreneur: 'Бизнес',
  teamwork: 'Команда',
};

const TYPE_LABELS = {
  certificate: { label: 'Сертификат'},
  diploma:     { label: 'Диплом'},
  article:     { label: 'Статья'},
  project:     { label: 'Проект'},
};

const emptyData = Object.values(MODULE_NAMES).map((name) => ({ subject: name, A: 0 }));

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
};

// ─── Форма добавления ───────────────────────────────────────────────────────
const AddPortfolioForm = ({ userId, onAdded }) => {
  const [open, setOpen]     = useState(false);
  const [form, setForm]     = useState({ type: 'certificate', title: '', description: '', url: '' });
  const [attachMode, setAttachMode] = useState('url'); // 'url' | 'file'
  const [file, setFile]     = useState(null);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const reset = () => {
    setForm({ type: 'certificate', title: '', description: '', url: '' });
    setAttachMode('url');
    setFile(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) { setFile(null); return; }

    const ext = f.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Недопустимый формат файла. Разрешены: ${ALLOWED_EXTENSIONS.join(', ')}`);
      setFile(null);
      e.target.value = '';
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError('Файл слишком большой (максимум 10 МБ)');
      setFile(null);
      e.target.value = '';
      return;
    }
    setError('');
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Укажите название'); return; }
    if (attachMode === 'file' && !file) { setError('Выберите файл'); return; }

    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('user_id', userId);
      fd.append('type', form.type);
      fd.append('title', form.title);
      fd.append('description', form.description);
      if (attachMode === 'url') {
        fd.append('url', form.url);
      } else if (file) {
        fd.append('file', file);
      }

      const res = await fetch(`${API}/api/portfolio`, {
        method: 'POST',
        body: fd, // не указываем Content-Type — браузер сам выставит boundary
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Ошибка'); return; }

      reset();
      setOpen(false);
      onAdded();
    } catch {
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button className={styles.addBtn} onClick={() => setOpen(true)}>
        + Добавить
      </button>
    );
  }

  return (
    <div className={styles.addForm}>
      <select
        className={styles.formSelect}
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value })}
      >
        {Object.entries(TYPE_LABELS).map(([val, { label, emoji }]) => (
          <option key={val} value={val}>{emoji} {label}</option>
        ))}
      </select>

      <input
        className={styles.formInput}
        placeholder="Название *"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <input
        className={styles.formInput}
        placeholder="Описание (необязательно)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />

      {/* Переключатель: ссылка или файл */}
      <div className={styles.attachToggle}>
        <button
          type="button"
          className={`${styles.toggleBtn} ${attachMode === 'url' ? styles.toggleActive : ''}`}
          onClick={() => { setAttachMode('url'); setFile(null); setError(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
        >
          🔗 Ссылка
        </button>
        <button
          type="button"
          className={`${styles.toggleBtn} ${attachMode === 'file' ? styles.toggleActive : ''}`}
          onClick={() => { setAttachMode('file'); setForm({ ...form, url: '' }); setError(''); }}
        >
          📎 Загрузить файл
        </button>
      </div>

      {attachMode === 'url' ? (
        <input
          className={styles.formInput}
          placeholder="Ссылка (необязательно)"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
        />
      ) : (
        <div className={styles.fileInputWrap}>
          <input
            ref={fileInputRef}
            type="file"
            id="portfolio-file-input"
            className={styles.fileInputHidden}
            accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
            onChange={handleFileChange}
          />
          <label htmlFor="portfolio-file-input" className={styles.fileInputLabel}>
            {file ? '📎 Заменить файл' : '📎 Выбрать файл'}
          </label>
          {file && (
            <span className={styles.fileInfo}>
              {file.name} · {formatFileSize(file.size)}
            </span>
          )}
          <span className={styles.fileHint}>
            До 10 МБ. PDF, DOC, PPT, XLS, изображения, ZIP
          </span>
        </div>
      )}

      {error && <p className={styles.formError}>{error}</p>}

      <div className={styles.formActions}>
        <button className={styles.saveBtn} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Сохранение...' : 'Сохранить'}
        </button>
        <button className={styles.cancelBtn} onClick={() => { reset(); setOpen(false); }}>
          Отмена
        </button>
      </div>
    </div>
  );
};

// ─── Карточка портфолио ─────────────────────────────────────────────────────
const PortfolioItem = ({ item, userId, onDeleted }) => {
  const [deleting, setDeleting] = useState(false);
  const meta = TYPE_LABELS[item.type] || { label: item.type, emoji: '📎' };

  const handleDelete = async () => {
    if (!window.confirm('Удалить запись?')) return;
    setDeleting(true);
    try {
      await fetch(`${API}/api/portfolio/${item.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  // Определяем, куда ведёт ссылка: на загруженный файл или на внешний url
  const link = item.file_path
    ? `${API}/api/portfolio/file/${item.file_path}`
    : item.url || null;
  const linkText = item.file_path ? (item.file_name || 'Открыть файл') : item.title;

  return (
    <div className={styles.portfolioItem}>
      <div className={styles.portfolioItemLeft}>
        <span className={styles.portfolioEmoji}>{meta.emoji}</span>
        <div>
          <div className={styles.portfolioTitle}>
            {link
              ? <a href={link} target="_blank" rel="noreferrer" className={styles.portfolioLink}>{item.title}</a>
              : item.title
            }
          </div>
          <div className={styles.portfolioMeta}>
            <span className={styles.portfolioType}>{meta.label}</span>
            {item.description && (
              <span className={styles.portfolioDesc}> · {item.description}</span>
            )}
          </div>
          {item.file_path && (
            <div className={styles.portfolioAttachment}>
              📎 <a href={link} target="_blank" rel="noreferrer" className={styles.portfolioLink}>{item.file_name}</a>
            </div>
          )}
          <div className={styles.portfolioDate}>{item.created_at?.slice(0, 10)}</div>
        </div>
      </div>
      {userId && (
        <button
          className={styles.deleteBtn}
          onClick={handleDelete}
          disabled={deleting}
          title="Удалить"
        >
          ✕
        </button>
      )}
    </div>
  );
};

// ─── Секция портфолио ───────────────────────────────────────────────────────
const PortfolioSection = ({ userId, editable }) => {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!userId) return;
    setLoading(true);
    fetch(`${API}/api/portfolio/${userId}`)
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [userId]);

  return (
    <div className={`${styles.card} ${styles.fullWidth}`}>
      <div className={styles.portfolioHeader}>
        <h3>Портфолио</h3>
        {editable && <AddPortfolioForm userId={userId} onAdded={load} />}
      </div>

      {loading ? (
        <p className={styles.portfolioEmpty}>Загрузка...</p>
      ) : items.length === 0 ? (
        <p className={styles.portfolioEmpty}>
          {editable ? 'Добавьте свои достижения — сертификаты, дипломы, статьи, проекты.' : 'Портфолио пока пустое.'}
        </p>
      ) : (
        <div className={styles.portfolioList}>
          {items.map((item) => (
            <PortfolioItem
              key={item.id}
              item={item}
              userId={editable ? userId : null}
              onDeleted={load}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Главная страница профиля студента ──────────────────────────────────────
const ProfilePage = ({ user, results }) => {
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
          <p><strong>Роль:</strong>{' '}
            {user?.role === 'student' ? 'Студент'
              : user?.role === 'teacher' ? 'Преподаватель'
              : 'Админ'}
          </p>
          {user?.group_name   && <p><strong>Группа:</strong> {user.group_name}</p>}
          {user?.group_number && <p><strong>Номер группы:</strong> {user.group_number}</p>}
          {user?.course_year  && <p><strong>Курс:</strong> {user.course_year}</p>}
          {results && <p><strong>Профиль:</strong> {results.profile}</p>}
        </div>

        <div className={styles.card}>
          <h3>Актуальный срез навыков</h3>
          {!results && (
            <p className={styles.chartHint}>
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
            <p className={`${styles.aiText} ${styles.aiTextWrap}`}>
              {results.recommendations}
            </p>
          ) : (
            <p className={styles.aiText}>Рекомендации появятся после прохождения теста.</p>
          )}
        </div>

        {/* Портфолио — студент может редактировать своё */}
        <PortfolioSection userId={user?.id} editable={true} />
      </div>
    </div>
  );
};

export default ProfilePage;
