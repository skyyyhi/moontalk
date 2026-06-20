import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import JoinPage from './pages/JoinPage';
import QuestionsPage from './pages/QuestionsPage';
import DrawPage from './pages/DrawPage';
import HistoryPage from './pages/HistoryPage';
import AdminPage from './pages/AdminPage';
import SetupPage from './pages/SetupPage';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('moontalk_token');
  return token ? children : <Navigate to="/setup" replace />;
}

export default function App() {
  const token = localStorage.getItem('moontalk_token');

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/join/:token" element={<JoinPage />} />
          <Route path="/admin/:adminToken" element={<AdminPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/questions" element={<ProtectedRoute><QuestionsPage /></ProtectedRoute>} />
          <Route path="/draw" element={<ProtectedRoute><DrawPage /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to={token ? '/questions' : '/setup'} replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
