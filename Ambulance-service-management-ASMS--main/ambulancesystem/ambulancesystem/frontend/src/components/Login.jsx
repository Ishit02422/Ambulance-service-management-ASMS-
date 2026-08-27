import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export const Login = ({ onToggleRegister, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.forgotPassword(forgotEmail);
      setSuccess('Password reset link sent to your email.');
      setForgotEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (showForgot) {
    return (
      <div className="auth-overlay">
        <div className="auth-card">
          {/* Back */}
          <button className="auth-back-btn" onClick={() => setShowForgot(false)}>
            ← Back to Login
          </button>

          <div className="auth-header">
            <div className="auth-icon">🔑</div>
            <h1>Reset Password</h1>
            <p>Enter your email to receive a reset link</p>
          </div>

          {error && <div className="auth-alert auth-alert--error">⚠️ {error}</div>}
          {success && <div className="auth-alert auth-alert--success">✅ {success}</div>}

          <form onSubmit={handleForgotSubmit} className="auth-form">
            <div className="auth-field">
              <label>Email</label>
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="Enter your registered email"
                required
              />
            </div>
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Sending...' : '📧 Send Reset Link'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        {/* Back to Landing */}
        {onBack && (
          <button className="auth-back-btn" onClick={onBack}>
            ← Back to Home
          </button>
        )}

        <div className="auth-header">
          <div className="auth-icon">🚑</div>
          <h1>Welcome Back</h1>
          <p>Sign in to access your account</p>
        </div>

        {error && <div className="auth-alert auth-alert--error">⚠️ {error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
            <div className="auth-field__forgot">
              <button type="button" onClick={() => setShowForgot(true)}>
                Forgot Password?
              </button>
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Signing In...' : '🔐 Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <button onClick={onToggleRegister}>Register</button>
          </p>
        </div>
      </div>
    </div>
  );
};
