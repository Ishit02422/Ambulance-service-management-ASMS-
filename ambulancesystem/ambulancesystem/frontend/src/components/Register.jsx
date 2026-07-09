import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertCircle } from 'lucide-react';

export const Register = ({ onToggleLogin }) => {
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

    // PHONE: only digits
    if (name === "phone") {
      const numeric = value.replace(/\D/g, "");
      setFormData({ ...formData, phone: numeric.slice(0, 10) });
      return;
    }

    // LICENSE → exactly 16 alphanumeric chars
    if (name === "licenseNumber") {
      let cleaned = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      cleaned = cleaned.slice(0, 16);
      setFormData({ ...formData, licenseNumber: cleaned });
      return;
    }

    // VEHICLE → auto-format to GJ-05-GV-4446
    if (name === "vehicleNumber") {
      let cleaned = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

      if (cleaned.length > 2) cleaned = cleaned.slice(0, 2) + "-" + cleaned.slice(2);
      if (cleaned.length > 5) cleaned = cleaned.slice(0, 5) + "-" + cleaned.slice(5);
      if (cleaned.length > 8) cleaned = cleaned.slice(0, 8) + "-" + cleaned.slice(8);

      cleaned = cleaned.slice(0, 13);

      setFormData({ ...formData, vehicleNumber: cleaned });
      return;
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // VALIDATION REGEX
    const phoneRegex = /^[0-9]{10}$/;
    const licenseRegex = /^[A-Z0-9]{16}$/; // NEW RULE: any 16 characters
    const vehicleRegex = /^[A-Z]{2}-[0-9]{2}-[A-Z]{2}-[0-9]{4}$/;
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{6,}$/;

    // PASSWORD VALIDATION
    if (!passwordRegex.test(formData.password)) {
      setError("Password must be at least 6 characters with one uppercase letter, one digit, and one special character.");
      setLoading(false);
      return;
    }

    // PHONE MUST BE 10 DIGITS
    if (!phoneRegex.test(formData.phone)) {
      setError("Phone number must be exactly 10 digits.");
      setLoading(false);
      return;
    }

    // DRIVER VALIDATION
    if (formData.role === "driver") {
      if (!licenseRegex.test(formData.licenseNumber)) {
        setError("Invalid License Number. Must be exactly 16 alphanumeric characters.");
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
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <span className="text-3xl">📧</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Verify Email</h1>
            <p className="text-gray-600 mt-2">Enter the OTP sent to {formData.email}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">One-Time Password</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-center text-2xl tracking-widest"
                maxLength="6"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white py-3 rounded-lg font-semibold transition ${
                loading ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <span className="text-3xl">🚑</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-600 mt-2">Join our ambulance service platform</p>
        </div>

        {/* Error Box */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Min 6 chars, 1 uppercase, 1 digit, 1 special char
              </p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone (10 digits)</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                maxLength="10"
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {/* Role */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Register As</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="patient">Patient</option>
                <option value="driver">Driver</option>
              </select>
            </div>

            {/* DRIVER FIELDS */}
            {formData.role === "driver" && (
              <>
                {/* License Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    License Number (16 characters)
                  </label>
                  <input
                    type="text"
                    name="licenseNumber"
                    value={formData.licenseNumber}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                {/* Vehicle Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vehicle Number (GJ-05-GV-4446)
                  </label>
                  <input
                    type="text"
                    name="vehicleNumber"
                    value={formData.vehicleNumber}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                {/* Ambulance Type */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ambulance Type</label>
                  <select
                    name="ambulanceType"
                    value={formData.ambulanceType}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Normal">Normal</option>
                    <option value="ICU">ICU</option>
                    <option value="Cardiac">Cardiac</option>
                    <option value="DeadBodyVan">Dead Body Van</option>
                  </select>
                </div>

                {/* File Uploads */}
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Driving License (Image/PDF)</label>
                    <input
                      type="file"
                      name="licenseFile"
                      onChange={handleFileChange}
                      accept="image/*,application/pdf"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle RC (Image/PDF)</label>
                    <input
                      type="file"
                      name="rcFile"
                      onChange={handleFileChange}
                      accept="image/*,application/pdf"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Driver Photo (Image)</label>
                    <input
                      type="file"
                      name="photoFile"
                      onChange={handleFileChange}
                      accept="image/*"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* SUBMIT */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white py-3 rounded-lg font-semibold transition ${
              loading ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Already have an account?{' '}
            <button
              onClick={onToggleLogin}
              className="text-red-600 font-semibold hover:text-red-700"
            >
              Sign In
            </button>
          </p>
        </div>

      </div>
    </div>
  );
};




















