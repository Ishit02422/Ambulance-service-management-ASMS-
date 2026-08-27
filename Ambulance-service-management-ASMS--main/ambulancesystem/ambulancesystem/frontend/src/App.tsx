import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { PatientDashboard } from './pages/PatientDashboard';
import { DriverDashboard } from './pages/DriverDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { ResetPassword } from './pages/ResetPassword';
import { LandingPage } from './pages/LandingPage';

function AppContent() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // If user is logged in, show dashboard
  if (user) {
    if (user.role === 'admin') return <AdminDashboard />;
    if (user.role === 'driver') return <DriverDashboard />;
    return <PatientDashboard />;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={
        <LandingPage
          onGetStarted={() => navigate('/register')}
          onSignIn={() => navigate('/login')}
        />
      } />
      <Route path="/login" element={
        <Login
          onToggleRegister={() => navigate('/register')}
          onBack={() => navigate('/')}
        />
      } />
      <Route path="/register" element={
        <Register
          onToggleLogin={() => navigate('/login')}
          onBack={() => navigate('/')}
        />
      } />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <AppContent />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
