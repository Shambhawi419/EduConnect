import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Chatbot from './pages/Chatbot';
import QuizGenerator from './pages/QuizGenerator';
import Schedule from './pages/Schedule';
import Account from './pages/Account';
import Admin from './pages/Admin';

function Protected({ children, adminOnly }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="center-page">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/chat"
        element={
          <Protected>
            <Chatbot />
          </Protected>
        }
      />
      <Route
        path="/quiz"
        element={
          <Protected>
            <QuizGenerator />
          </Protected>
        }
      />
      <Route
        path="/schedule"
        element={
          <Protected>
            <Schedule />
          </Protected>
        }
      />
      <Route
        path="/account"
        element={
          <Protected>
            <Account />
          </Protected>
        }
      />
      <Route
        path="/admin"
        element={
          <Protected adminOnly>
            <Admin />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
