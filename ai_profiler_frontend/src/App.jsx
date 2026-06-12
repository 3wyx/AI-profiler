import React, { useState } from 'react';
import Navbar from './components/Navbar';
import AuthPage from './pages/AuthPage';
import ProfilePage from './pages/ProfilePage';
import TestingPage from './pages/TestingPage';
import ResultsPage from './pages/ResultsPage';
import SettingsPage from './pages/SettingsPage';
import { ThemeProvider } from './context/ThemeContext';
import './styles/theme.css';

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [lastResults, setLastResults] = useState(null);

  const handleLogin = (role, data) => {
    setUserRole(role);
    setUserData(data);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserRole(null);
    setUserData(null);
  };

  if (!isAuthenticated) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />
      <main className="main-content">
        {activeTab === 'profile' && <ProfilePage user={userData} results={lastResults} />}
        {activeTab === 'testing' && (
          <TestingPage
            user={userData}
            onResultsReady={(results) => {
              setLastResults(results);
              setActiveTab('results');
            }}
          />
        )}
        {activeTab === 'results' && <ResultsPage results={lastResults} />}
        {activeTab === 'settings' && <SettingsPage />}
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
