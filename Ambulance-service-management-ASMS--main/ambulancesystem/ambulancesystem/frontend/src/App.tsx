import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { PatientDashboard } from './pages/PatientDashboard';
import { DriverDashboard } from './pages/DriverDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { ResetPassword } from './pages/ResetPassword';

function AppContent() {
  const { user } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  // If user is logged in, show dashboard
  if (user) {
    if (user.role === 'admin') return <AdminDashboard />;
    if (user.role === 'driver') return <DriverDashboard />;
    return <PatientDashboard />;
  }

  // If not logged in, handle routes
  return (
    <Routes>
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/" element={
        showRegister ? (
          <Register onToggleLogin={() => setShowRegister(false)} />
        ) : (
          <Login onToggleRegister={() => setShowRegister(true)} />
        )
      } />
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
