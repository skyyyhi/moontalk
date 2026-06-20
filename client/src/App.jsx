import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import HomePage from './pages/HomePage';
import AdminHubPage from './pages/AdminHubPage';
import JoinPage from './pages/JoinPage';
import QuestionsPage from './pages/QuestionsPage';
import DrawPage from './pages/DrawPage';
import HistoryPage from './pages/HistoryPage';
import AdminPage from './pages/AdminPage';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('moontalk_token');
  return token ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename="/moontalk">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<AdminHubPage />} />
          <Route path="/admin/:adminToken" element={<AdminPage />} />
          <Route path="/join/:token" element={<JoinPage />} />
          <Route path="/questions" element={<ProtectedRoute><QuestionsPage /></ProtectedRoute>} />
          <Route path="/draw" element={<ProtectedRoute><DrawPage /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
