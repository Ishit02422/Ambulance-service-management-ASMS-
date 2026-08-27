import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertCircle } from 'lucide-react';

export const Register = ({ onToggleLogin, onBack }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    role: 'patient',
    licenseNumber: '',
    vehicleNumber: '',
    ambulanceType: 'Normal'
  });

  const [files, setFiles] = useState({
    licenseFile: null,
    rcFile: null,
    photoFile: null
  });

  const [devOtp, setDevOtp] = useState('');
  const [error, setError] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, verifyOtp } = useAuth();

  const handleFileChange = (e) => {
    setFiles({ ...files, [e.target.name]: e.target.files[0] });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "phone") {
      const numeric = value.replace(/\D/g, "");
      setFormData({ ...formData, phone: numeric.slice(0, 10) });
      return;
    }
    if (name === "licenseNumber") {
      let cleaned = value.replace(/[^A-Za-z0-9-]/g, "").toUpperCase();
      cleaned = cleaned.slice(0, 20);
      setFormData({ ...formData, licenseNumber: cleaned });
      return;
    }
    if (name === "vehicleNumber") {
      let cleaned = value.replace(/[^A-Za-z0-9-]/g, "").toUpperCase();
      cleaned = cleaned.slice(0, 15);
      setFormData({ ...formData, vehicleNumber: cleaned });
      return;
    }
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const phoneRegex = /^[0-9]{10}$/;
    const licenseRegex = /^[A-Za-z0-9\s-]{6,20}$/;
    const vehicleRegex = /^[A-Za-z0-9\s-]{6,15}$/;
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{6,}$/;

    if (!passwordRegex.test(formData.password)) {
      setError("Password must be at least 6 characters with one uppercase letter, one digit, and one special character.");
      setLoading(false);
      return;
    }
    if (!phoneRegex.test(formData.phone)) {
      setError("Phone number must be exactly 10 digits.");
      setLoading(false);
      return;
    }
    if (formData.role === "driver") {
      if (!licenseRegex.test(formData.licenseNumber)) {
        setError("Invalid License Number. Must be between 6 and 20 alphanumeric characters.");
        setLoading(false);
        return;
      }
      if (!vehicleRegex.test(formData.vehicleNumber)) {
        setError("Invalid Vehicle Number. Example: GJ-05-GV-4446");
        setLoading(false);
        return;
      }
    }

    try {
      let data = formData;
      if (formData.role === 'driver') {
        if (!files.licenseFile || !files.rcFile || !files.photoFile) {
          setError("Please upload License, RC, and Photo.");
          setLoading(false);
          return;
        }
        const form = new FormData();
        Object.keys(formData).forEach(key => form.append(key, formData[key]));
        form.append('licenseFile', files.licenseFile);
        form.append('rcFile', files.rcFile);
        form.append('photoFile', files.photoFile);
        data = form;
      }

      const response = await register(data);
      if (response.requiresOtp) {
        if (response.devOtp) {
          setDevOtp(response.devOtp);
          setOtp(response.devOtp);
        }
        setShowOtp(true);
      } else {
        onToggleLogin();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyOtp(formData.email, otp, formData.role);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (showOtp) {
    return (
      <div className="auth-overlay">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-icon">📧</div>
            <h1>Verify Email</h1>
            <p>Enter the OTP sent to {formData.email}</p>
          </div>

          {devOtp && (
            <div className="auth-alert auth-alert--info">
              💡 <strong>OTP (Local Mode):</strong>{' '}
              <span className="auth-otp-display">{devOtp}</span>
            </div>
          )}

          {error && <div className="auth-alert auth-alert--error">⚠️ {error}</div>}

          <form onSubmit={handleVerifyOtp} className="auth-form">
            <div className="auth-field">
              <label>One-Time Password</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP"
                className="auth-otp-input"
                maxLength="6"
                required
              />
            </div>
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Verifying...' : '✅ Verify & Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card auth-card--wide">
        {/* Back to Landing */}
        {onBack && (
          <button className="auth-back-btn" onClick={onBack}>
            ← Back to Home
          </button>
        )}

        <div className="auth-header">
          <div className="auth-icon">🚑</div>
          <h1>Create Account</h1>
          <p>Join our ambulance service platform</p>
        </div>

        {error && <div className="auth-alert auth-alert--error">⚠️ {error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-grid">
            {/* Full Name */}
            <div className="auth-field">
              <label>Full Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="Your full name" />
            </div>

            {/* Email */}
            <div className="auth-field">
              <label>Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="you@example.com" />
            </div>

            {/* Password */}
            <div className="auth-field">
              <label>Password</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} required placeholder="Min 6 chars, 1 upper, 1 digit, 1 special" />
              <span className="auth-field__hint">Min 6 chars, 1 uppercase, 1 digit, 1 special char</span>
            </div>

            {/* Phone */}
            <div className="auth-field">
              <label>Phone (10 digits)</label>
              <input type="text" name="phone" value={formData.phone} maxLength="10" onChange={handleChange} required placeholder="10-digit mobile number" />
            </div>

            {/* Address */}
            <div className="auth-field auth-field--full">
              <label>Address</label>
              <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Your address" />
            </div>

            {/* Role */}
            <div className="auth-field auth-field--full">
              <label>Register As</label>
              <select name="role" value={formData.role} onChange={handleChange}>
                <option value="patient">Patient</option>
                <option value="driver">Driver</option>
              </select>
            </div>

            {/* DRIVER FIELDS */}
            {formData.role === "driver" && (
              <>
                <div className="auth-field">
                  <label>License Number (e.g. GJ05202300012345)</label>
                  <input type="text" name="licenseNumber" value={formData.licenseNumber} onChange={handleChange} required placeholder="GJ05202300012345" />
                </div>

                <div className="auth-field">
                  <label>Vehicle Number (GJ-05-GV-4446)</label>
                  <input type="text" name="vehicleNumber" value={formData.vehicleNumber} onChange={handleChange} required placeholder="GJ-05-GV-4446" />
                </div>

                <div className="auth-field auth-field--full">
                  <label>Ambulance Type</label>
                  <select name="ambulanceType" value={formData.ambulanceType} onChange={handleChange}>
                    <option value="Normal">Normal</option>
                    <option value="ICU">ICU</option>
                    <option value="Cardiac">Cardiac</option>
                    <option value="DeadBodyVan">Dead Body Van</option>
                  </select>
                </div>

                <div className="auth-field auth-field--full">
                  <label>Driving License (Image/PDF)</label>
                  <input type="file" name="licenseFile" onChange={handleFileChange} accept="image/*,application/pdf" required className="auth-file-input" />
                </div>
                <div className="auth-field auth-field--full">
                  <label>Vehicle RC (Image/PDF)</label>
                  <input type="file" name="rcFile" onChange={handleFileChange} accept="image/*,application/pdf" required className="auth-file-input" />
                </div>
                <div className="auth-field auth-field--full">
                  <label>Driver Photo (Image)</label>
                  <input type="file" name="photoFile" onChange={handleFileChange} accept="image/*" required className="auth-file-input" />
                </div>
              </>
            )}
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Registering...' : '🚀 Register'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <button onClick={onToggleLogin}>Sign In</button>
          </p>
        </div>
      </div>
    </div>
  );
};
