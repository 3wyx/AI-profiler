import React, { useState } from 'react';
import Navbar from './components/Navbar';
import AuthPage from './pages/AuthPage';
import ProfilePage from './pages/ProfilePage';
import TeacherProfilePage from './pages/TeacherProfilePage';
import AdminPage from './pages/AdminPage';
import TestingPage from './pages/TestingPage';
import ResultsPage from './pages/ResultsPage';
import SettingsPage from './pages/SettingsPage';
import { ThemeProvider } from './context/ThemeContext';
import './styles/theme.css';

const API = 'http://localhost:5000';

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [lastResults, setLastResults] = useState(null);

  const handleLogin = async (role, data) => {
    setUserRole(role);
    setUserData(data);
    setIsAuthenticated(true);
    setActiveTab(role === 'admin' ? 'requests' : 'profile');

    if (role === 'student') {
      try {
        const res = await fetch(`${API}/api/results/my/${data.id}`);
        if (res.ok) {
          const result = await res.json();
          setLastResults({
            scores: {
              algo:         result.algo,
              coding:       result.coding,
              design:       result.design,
              entrepreneur: result.entrepreneur,
              teamwork:     result.teamwork,
            },
            profile:         result.profile,
            recommendations: result.recommendations,
            timeTaken:       result.time_taken || null,
          });
        }
      } catch (e) {
        console.log('Результатов пока нет');
      }
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserRole(null);
    setUserData(null);
    setLastResults(null);
    setActiveTab('profile');
  };

  if (!isAuthenticated) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        userRole={userRole}
      />
      <main className="main-content">
        {activeTab === 'profile' && (
          userRole === 'teacher'
            ? <TeacherProfilePage user={userData} />
            : <ProfilePage user={userData} results={lastResults} />
        )}
        {activeTab === 'requests' && userRole === 'admin' && (
          <AdminPage user={userData} />
        )}
        {activeTab === 'testing' && userRole === 'student' && (
          <TestingPage
            user={userData}
            onResultsReady={(results) => {
              setLastResults({
                scores:          results.scores,
                profile:         results.profile,
                recommendations: results.recommendations,
                timeTaken:       results.timeTaken || null,
              });
              setActiveTab('results');
            }}
          />
        )}
        {activeTab === 'results' && userRole === 'student' && (
          <ResultsPage results={lastResults} />
        )}
        {activeTab === 'settings' && (
          <SettingsPage user={userData} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}