import React, { useState, useEffect } from 'react';
import styles from './TeacherProfilePage.module.css';

const API = '';

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

const SCORE_MAX = 100;
const normalizeGroup = (g) => (g || '').replace(/\s+/g, '').toUpperCase();

const ScoreBar = ({ value }) => {
  const pct   = Math.min(100, Math.round((value / SCORE_MAX) * 100));
  const color = pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--accent)' : 'var(--error)';
  return (
    <div className={styles.barWrap}>
      <div className={styles.barFill} style={{ width: `${pct}%`, backgroundColor: color }} />
      <span className={styles.barLabel}>{value ?? '—'}</span>
    </div>
  );
};

// ─── Модальное окно с портфолио студента ─────────────────────────────────────
const StudentModal = ({ student, onClose }) => {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!student?.user_id) { setLoading(false); return; }
    fetch(`${API}/api/portfolio/${student.user_id}`)
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [student]);

  if (!student) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Шапка */}
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>{student.name}</h2>
            <span className={styles.modalSub}>{student.login}</span>
          </div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {/* Скоры */}
        <div className={styles.modalScores}>
          {Object.entries(MODULE_NAMES).map(([key, label]) => (
            <div key={key} className={styles.modalScoreRow}>
              {/* название модуля */}
              <span className={styles.modalScoreLabel}>{label}</span>
              {/* полоска с баллом */}
              <ScoreBar value={student[key]} />
            </div>
          ))}
          {student.profile && (
            <p className={styles.modalProfile}>
              Профиль: <strong>{student.profile}</strong>
            </p>
          )}
          {/* время прохождения теста, если оно сохранено */}
          {student.time_taken && (
            <p className={styles.modalProfile}>
              ⏱ Время прохождения: <strong>{student.time_taken}</strong>
            </p>
          )}
          {/* дата теста: берём только YYYY-MM-DD из строки даты */}
          {student.created_at && (
            <p className={styles.modalProfile}>
              📅 Дата теста: <strong>{student.created_at.slice(0, 10)}</strong>
            </p>
          )}
        </div>

        {/* Рекомендации ИИ */}
        <div className={styles.modalPortfolio}>
          <h3 className={styles.modalPortfolioTitle}>Рекомендации ИИ</h3>
          {student.recommendations ? (
            <p style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.7', margin: 0 }}>
              {student.recommendations}
            </p>
          ) : (
            <p className={styles.modalEmpty}>Рекомендации отсутствуют.</p>
          )}
        </div>

        {/* Портфолио */}
        <div className={styles.modalPortfolio}>
          <h3 className={styles.modalPortfolioTitle}>Портфолио</h3>
          {loading ? (
            <p className={styles.modalEmpty}>Загрузка...</p>
          ) : items.length === 0 ? (
            <p className={styles.modalEmpty}>Студент ещё не добавил работы.</p>
          ) : (
            <div className={styles.modalItems}>
              {items.map((item) => {
                const meta = TYPE_LABELS[item.type] || { label: item.type, emoji: '📎' };
                const link = item.file_path
                  ? `${API}/api/portfolio/file/${item.file_path}`
                  : item.url || null;

                return (
                  <div key={item.id} className={styles.modalItem}>
                    <span className={styles.modalItemEmoji}>{meta.emoji}</span>
                    <div className={styles.modalItemBody}>
                      <div className={styles.modalItemTitle}>
                        {link
                          ? <a href={link} target="_blank" rel="noreferrer" className={styles.modalItemLink}>{item.title}</a>
                          : item.title
                        }
                      </div>
                      <div className={styles.modalItemMeta}>
                        <span className={styles.portfolioType}>{meta.label}</span>
                        {item.description && <span className={styles.modalItemDesc}> · {item.description}</span>}
                      </div>
                      {item.file_path && (
                        <div className={styles.modalItemAttachment}>
                          📎 <a href={link} target="_blank" rel="noreferrer" className={styles.modalItemLink}>{item.file_name}</a>
                        </div>
                      )}
                      <div className={styles.modalItemDate}>{item.created_at?.slice(0, 10)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Главная страница преподавателя ──────────────────────────────────────────
const TeacherProfilePage = ({ user }) => {
  const [tab, setTab]                 = useState('students');
  const [results, setResults]         = useState([]);
  const [teams, setTeams]             = useState([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [loadingTeams, setLoadingTeams]     = useState(false);
  const [teamsError, setTeamsError]   = useState('');
  const [search, setSearch]           = useState('');
  const [filterProfile, setFilterProfile] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [pinnedTeams, setPinnedTeams] = useState([]);

  // Загрузка результатов всех студентов
  useEffect(() => {
    fetch(`${API}/api/results`)
      .then((r) => r.json())
      .then((data) => setResults(Array.isArray(data) ? data : []))
      .catch(() => setResults([]))
      .finally(() => setLoadingResults(false));
  }, []);

  // Загрузка команд
  const loadTeams = () => {
    setLoadingTeams(true);
    setTeamsError('');
    fetch(`${API}/api/teams`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setTeamsError(data.error); setTeams([]); }
        else { setTeams(data.teams || []); }
      })
      .catch(() => setTeamsError('Не удалось загрузить команды'))
      .finally(() => setLoadingTeams(false));
  };

  //Загрузка команд без ИИ (для формирования новых команд)
  const loadTeamsNoAI = () => {
  setLoadingTeams(true);
  setTeamsError('');
  fetch(`${API}/api/teams/no-ai`)
    .then((r) => r.json())
    .then((data) => {
      if (data.error) { setTeamsError(data.error); setTeams([]); }
      else { setTeams(data.teams || []); }
    })
    .catch(() => setTeamsError('Не удалось загрузить команды'))
    .finally(() => setLoadingTeams(false));
  };

  // Загрузка закрепленных команд
  const loadPinnedTeams = () => {
    if (!user?.id) return;
    fetch(`${API}/api/teams/pinned/${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.pinned) {
          setPinnedTeams(data.pinned.map(p => ({ ...p.team, pinnedId: p.id })));
        }
      })
      .catch(() => {});
  };

  const profileOptions = [...new Set(results.map((r) => r.profile).filter(Boolean))];
  const groupOptions = [...new Set(results.map((r) => normalizeGroup(r.group_number)).filter(Boolean))].sort();
  
  useEffect(() => {
    if (tab === 'teams') {
      loadTeams();
      loadPinnedTeams();
    }
  }, [tab, user?.id]);

  const handlePinTeam = (team, index) => {
    if (!user?.id) return;
    fetch(`${API}/api/teams/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, team }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          setPinnedTeams([{ ...team, pinnedId: data.id }, ...pinnedTeams]);
          setTeams(teams.filter((_, i) => i !== index));
        }
      })
      .catch(() => {});
  };

  const handleUnpinTeam = (pinnedId, team) => {
    if (!user?.id) return;
    fetch(`${API}/api/teams/pin/${pinnedId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
    })
      .then((r) => r.json())
      .then((data) => {
        // Удаляем из закрепленных
        setPinnedTeams(pinnedTeams.filter((t) => t.pinnedId !== pinnedId));
        // Добавляем обратно в новые команды
        setTeams([team, ...teams]);
      })
      .catch(() => {});
  };

    const filtered = results.filter((r) => {
    const q        = search.toLowerCase();
    const matchName = r.name?.toLowerCase().includes(q) || r.login?.toLowerCase().includes(q);
    const matchProfile = filterProfile ? r.profile === filterProfile : true;
    const matchGroup = filterGroup ? normalizeGroup(r.group_number) === filterGroup : true;
    return matchName && matchProfile && matchGroup;
  });

  const teacherName  = user?.name || 'Преподаватель';

  return (
    <div className={styles.page}>
      {/* Шапка профиля */}
      <div className={styles.profileHeader}>
        <div className={styles.avatar}>
          <span className={styles.avatarIcon}>👤</span>
        </div>
        <div className={styles.profileInfo}>
          <h1 className={styles.profileName}>{teacherName}</h1>
          <div className={styles.profileMeta}>
            <span className={styles.badge}>Преподаватель</span>
            {user?.login && <span className={styles.metaItem}>✉ {user.login}</span>}
          </div>
        </div>
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{results.length}</span>
            <span className={styles.statLabel}>Студентов</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{profileOptions.length}</span>
            <span className={styles.statLabel}>Профилей</span>
          </div>
        </div>
      </div>

      {/* Переключатель вкладок */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${tab === 'students' ? styles.tabActive : ''}`}
          onClick={() => setTab('students')}
        >
          📊 Результаты студентов
        </button>
        <button
          className={`${styles.tabBtn} ${tab === 'teams' ? styles.tabActive : ''}`}
          onClick={() => setTab('teams')}
        >
          👥 Команды
        </button>
      </div>

      {/* Таблица результатов */}
      {tab === 'students' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Результаты тестирования</h2>
            <div className={styles.filters}>
              <input
                type="text"
                placeholder="🔍 Поиск по имени или логину..."
                className={styles.searchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className={styles.filterSelect}
                value={filterProfile}
                onChange={(e) => setFilterProfile(e.target.value)}
              >
                <option value="">Все профили</option>
                {profileOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                className={styles.filterSelect}
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
              >
                <option value="">Все группы</option>
                {groupOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {loadingResults ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <span>Загрузка данных...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.emptyState}>
              {results.length === 0
                ? '📭 Ни один студент ещё не прошёл тестирование'
                : '🔍 Ничего не найдено по вашему запросу'}
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Студент</th>
                    <th className={styles.th}>Логин</th>
                    <th className={styles.th}>Группа</th>
                    {Object.values(MODULE_NAMES).map((name) => (
                      <th key={name} className={`${styles.th} ${styles.thScore}`}>{name}</th>
                    ))}
                    <th className={styles.th}>Роль / Профиль</th>
                    <th className={styles.th}>Портфолио</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                      <td className={styles.td}>
                        <span className={styles.studentName}>{row.name}</span>
                      </td>
                      <td className={`${styles.td} ${styles.tdMuted}`}>{row.login}</td>
                      <td className={`${styles.td} ${styles.tdMuted}`}>{row.group_number || '—'}</td>
                      {Object.keys(MODULE_NAMES).map((key) => (
                        <td key={key} className={`${styles.td} ${styles.tdScore}`}>
                          <ScoreBar value={row[key]} />
                        </td>
                      ))}
                      <td className={styles.td}>
                        <span className={styles.profileBadge}>{row.profile || '—'}</span>
                      </td>
                      <td className={styles.td}>
                        <button
                          className={styles.portfolioBtn}
                          onClick={() => setSelectedStudent(row)}
                        >
                          📂 Смотреть
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Команды */}
      {tab === 'teams' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Команды студентов</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className={styles.refreshBtn} onClick={loadTeams} disabled={loadingTeams}>
                {loadingTeams ? 'Загрузка...' : 'Собрать с ИИ'}
              </button>
              <button className={styles.refreshBtn} onClick={loadTeamsNoAI} disabled={loadingTeams}>
                ⚙️ Собрать без ИИ
              </button>
            </div>
          </div>

          {teamsError && <div className={styles.emptyState}>⚠ {teamsError}</div>}

          {pinnedTeams.length > 0 && (
            <div>
              <h3 className={styles.subsectionTitle}>Закрепленные команды</h3>
              <div className={styles.teamsGrid}>
                {pinnedTeams.map((team, ti) => (
                  <div key={`pinned-${team.pinnedId}`} className={`${styles.teamCard} ${styles.teamCardPinned}`}>
                    <div className={styles.teamHeader}>
                      <div style={{ flex: 1 }}>
                        <h3 className={styles.teamTitle}>{team.description?.substring(0, 30) || 'Команда'}</h3>
                        <span className={styles.teamCount}>{team.members?.length ?? 0} чел.</span>
                      </div>
                      <button
                        className={styles.unpinBtn}
                        onClick={() => handleUnpinTeam(team.pinnedId, team)}
                        title="Открепить команду"
                      >
                        ✕
                      </button>
                    </div>
                    <div className={styles.memberList}>
                      {(team.members || []).map((member, mi) => (
                        <div key={mi} className={styles.memberRow}>
                          <div className={styles.memberLeft}>
                            <span className={styles.memberAvatar}>
                              {(member.name || '?')[0].toUpperCase()}
                            </span>
                            <div>
                              <div className={styles.memberName}>{member.name}</div>
                              <div className={styles.memberProfile}>{member.role || member.profile || '—'}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {team.description && (
                      <p className={styles.teamDesc}>{team.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingTeams ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <span>Формируем команды...</span>
            </div>
          ) : teams.length === 0 && pinnedTeams.length === 0 ? (
            <div className={styles.emptyState}>Нет данных для формирования команд</div>
          ) : teams.length > 0 ? (
            <div>
              <h3 className={styles.subsectionTitle}>Новые команды</h3>
              <div className={styles.teamsGrid}>
                {teams.map((team, ti) => (
                  <div key={ti} className={styles.teamCard}>
                    <div className={styles.teamHeader}>
                      <div style={{ flex: 1 }}>
                        <h3 className={styles.teamTitle}>Команда {ti + 1}</h3>
                        <span className={styles.teamCount}>{team.members?.length ?? 0} чел.</span>
                      </div>
                      <button
                        className={styles.pinBtn}
                        onClick={() => handlePinTeam(team, ti)}
                        title="Закрепить команду"
                      >
                        ★
                      </button>
                    </div>
                    <div className={styles.memberList}>
                      {(team.members || []).map((member, mi) => (
                        <div key={mi} className={styles.memberRow}>
                          <div className={styles.memberLeft}>
                            <span className={styles.memberAvatar}>
                              {(member.name || '?')[0].toUpperCase()}
                            </span>
                            <div>
                              <div className={styles.memberName}>{member.name}</div>
                              <div className={styles.memberProfile}>{member.role || member.profile || '—'}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {team.description && (
                      <p className={styles.teamDesc}>{team.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Модальное окно портфолио студента */}
      {selectedStudent && (
        <StudentModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
};

export default TeacherProfilePage;
