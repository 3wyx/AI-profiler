import React from 'react';
import * as Icons from 'lucide-react';
import styles from './Sidebar.module.css';

const Navbar = ({ activeTab, setActiveTab, onLogout, userRole }) => {
  const allItems = [
    { id: 'profile',  label: 'Мой профиль',   iconName: 'User',          roles: ['student', 'teacher'] },
    { id: 'testing',  label: 'Тестирование',   iconName: 'ClipboardList', roles: ['student'] },
    { id: 'results',  label: 'Результаты',     iconName: 'BarChart3',     roles: ['student'] },
    { id: 'requests', label: 'Запросы',        iconName: 'Inbox',         roles: ['admin'] },
    { id: 'settings', label: 'Настройки',      iconName: 'Settings',      roles: ['student', 'teacher', 'admin'] },
  ];

  const menuItems = allItems.filter(item => item.roles.includes(userRole));

  return (
    <header className={styles.navbar}>
      <div className={styles.logo}>AI-profiler</div>
      <nav className={styles.nav}>
        {menuItems.map((item) => {
          const LucideIcon = Icons[item.iconName];
          return (
            <button
              key={item.id}
              className={`${styles.navItem} ${activeTab === item.id ? styles.active : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              {LucideIcon ? <LucideIcon size={18} className={styles.icon} /> : null}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <button className={styles.logoutBtn} onClick={onLogout}>
        <Icons.LogOut size={18} />
        <span>Выйти</span>
      </button>
    </header>
  );
};

export default Navbar;
