import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{6,}$/;
    if (!passwordRegex.test(password)) {
      setError("Password must be at least 6 characters with one uppercase letter, one digit, and one special character.");
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setSuccess("Password updated successfully! Redirecting to login...");
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        {/* Back */}
        <button className="auth-back-btn" onClick={() => navigate('/login')}>
          ← Back to Login
        </button>

        <div className="auth-header">
          <div className="auth-icon">🔒</div>
          <h1>Set New Password</h1>
          <p>Enter your new password below</p>
        </div>

        {error && <div className="auth-alert auth-alert--error">⚠️ {error}</div>}
        {success && <div className="auth-alert auth-alert--success">✅ {success}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
            />
            <span className="auth-field__hint">
              Min 6 chars, 1 uppercase, 1 digit, 1 special char
            </span>
          </div>

          <div className="auth-field">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
            />
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Updating...' : '🔐 Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};
