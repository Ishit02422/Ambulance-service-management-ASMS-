const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Store decrypted user in memory for quick access
let cachedUser = null;

const getAuthHeader = () => {
  if (cachedUser?.token) {
    return { 'Authorization': `Bearer ${cachedUser.token}` };
  }
  return {};
};

// Update cached user (called after login/register)
export const updateCachedUser = (user) => {
  cachedUser = user;
};

// Clear cached user (called on logout)
const clearCachedUser = () => {
  cachedUser = null;
};

export const api = {
  async login(email, password) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    updateCachedUser(data);
    return data;
  },

  async register(userData) {
    const isFormData = userData instanceof FormData;
    const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
    const body = isFormData ? userData : JSON.stringify(userData);

    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: headers,
      body: body,
    });

    const data = await response.json();

    if (!response.ok) {
      let errorMsg = data.message || 'Registration failed';
      if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        errorMsg = data.errors.map(err => err.message).join(' | ');
      }
      throw new Error(errorMsg);
    }

    if (data.token) {
      updateCachedUser(data);
    }
    return data;
  },

  async verifyOtp(email, otp, role) {
    const response = await fetch(`${API_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, otp, role }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'OTP verification failed');
    }

    updateCachedUser(data);
    return data;
  },

  logout() {
    clearCachedUser();
  },

  async forgotPassword(email) {
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send reset email');
    }

    return data;
  },

  async resetPassword(token, password) {
    const response = await fetch(`${API_URL}/auth/reset-password/${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to reset password');
    }

    return data;
  },

  // DRIVER ENDPOINTS
  async getDriverProfile() {
    const response = await fetch(`${API_URL}/drivers/profile`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch profile');
    return response.json();
  },

  async toggleDriverStatus(location = null) {
    const response = await fetch(`${API_URL}/drivers/status`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: location ? JSON.stringify({ location }) : null,
    });
    if (!response.ok) throw new Error('Failed to update status');
    return response.json();
  },

  async setDriverOffline() {
    const response = await fetch(`${API_URL}/drivers/offline`, {
      method: 'PATCH',
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to set offline status');
    return response.json();
  },

  async getDriverAnalytics(period = 'week', startDate = null, endDate = null) {
    let url = `${API_URL}/drivers/analytics?period=${period}`;
    if (startDate && endDate) {
      url += `&startDate=${startDate}&endDate=${endDate}`;
    }
    const response = await fetch(url, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch analytics');
    return response.json();
  },

  async sendSOSAlert(data) {
    const response = await fetch(`${API_URL}/drivers/sos`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to send SOS alert');
    return response.json();
  },

  async getDriverFeedback() {
    const response = await fetch(`${API_URL}/drivers/feedback`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch feedback');
    return response.json();
  },

  async replyToFeedback(feedbackId, reply) {
    const response = await fetch(`${API_URL}/drivers/feedback/${feedbackId}/reply`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reply }),
    });
    if (!response.ok) throw new Error('Failed to send reply');
    return response.json();
  },

  // ADMIN ENDPOINTS
  async getAdminStats() {
    const response = await fetch(`${API_URL}/admin/stats`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  },

  async getPendingDrivers() {
    const response = await fetch(`${API_URL}/admin/drivers/pending`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch pending drivers');
    return response.json();
  },

  async getAllDrivers() {
    const response = await fetch(`${API_URL}/admin/drivers/all`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch drivers');
    return response.json();
  },

  async getAllPatients() {
    const response = await fetch(`${API_URL}/admin/patients`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch patients');
    return response.json();
  },

  async verifyDriver(driverId, isVerified, reason = '') {
    const response = await fetch(`${API_URL}/admin/drivers/${driverId}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ isVerified, reason }),
    });
    if (!response.ok) throw new Error('Failed to verify driver');
    return response.json();
  },

  async getAllHospitals(search = '') {
    const queryParam = search ? `?search=${encodeURIComponent(search)}` : '';
    const response = await fetch(`${API_URL}/hospitals${queryParam}`);
    if (!response.ok) throw new Error('Failed to fetch hospitals');
    return response.json();
  },

  async getNearestHospitals(lat, lng, limit = 30) {
    const response = await fetch(`${API_URL}/hospitals/nearest?lat=${lat}&lng=${lng}&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch hospitals');
    return response.json();
  },

  async searchHospitals(query) {
    const response = await fetch(`${API_URL}/hospitals/search?query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search hospitals');
    return response.json();
  },

  // BOOKING ENDPOINTS
  async createBooking(bookingData) {
    const response = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(bookingData),
    });
    if (response.status === 401) {
      localStorage.removeItem('ambulance_user');
      window.location.reload();
      throw new Error('Session expired');
    }
    if (!response.ok) throw new Error('Failed to create booking');
    return response.json();
  },

  async getUserBookings() {
    const response = await fetch(`${API_URL}/bookings/my`, {
      headers: getAuthHeader(),
    });
    if (response.status === 401) {
      localStorage.removeItem('ambulance_user');
      window.location.reload();
      throw new Error('Session expired');
    }
    if (!response.ok) throw new Error('Failed to fetch bookings');
    return response.json();
  },

  async getDriverBookings() {
    const response = await fetch(`${API_URL}/bookings/driver`, {
      headers: getAuthHeader(),
    });
    if (response.status === 401) {
      localStorage.removeItem('ambulance_user');
      window.location.reload();
      throw new Error('Session expired');
    }
    if (!response.ok) throw new Error('Failed to fetch driver bookings');
    return response.json();
  },

  async getAvailableBookings() {
    const response = await fetch(`${API_URL}/bookings/available`, {
      headers: getAuthHeader(),
    });
    if (response.status === 401) {
      localStorage.removeItem('ambulance_user');
      window.location.reload();
      throw new Error('Session expired');
    }
    if (!response.ok) throw new Error('Failed to fetch available bookings');
    return response.json();
  },

  async acceptBooking(bookingId) {
    const response = await fetch(`${API_URL}/bookings/${bookingId}/accept`, {
      method: 'PATCH',
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to accept booking');
    return response.json();
  },

  async updateBookingStatus(bookingId, status) {
    const response = await fetch(`${API_URL}/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) throw new Error('Failed to update booking status');
    return response.json();
  },

  async makePayment(bookingId, paymentMethod = 'cash') {
    const response = await fetch(`${API_URL}/bookings/${bookingId}/pay`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ paymentMethod }),
    });
    if (!response.ok) throw new Error('Payment failed');
    return response.json();
  },

  async cancelBooking(bookingId, reason) {
    const response = await fetch(`${API_URL}/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ reason }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to cancel booking');
    }
    
    return data;
  },

  async getAllBookings(filters = {}) {
    const queryParams = new URLSearchParams();
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);
    if (filters.search) queryParams.append('search', filters.search);

    const response = await fetch(`${API_URL}/admin/bookings?${queryParams.toString()}`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch bookings');
    return response.json();
  },

  async getAdminCharts() {
    const response = await fetch(`${API_URL}/admin/stats/charts`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch chart data');
    return response.json();
  },

  async updateProfile(data) {
    const response = await fetch(`${API_URL}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update profile');
    }
    return response.json();
  },

  async getProfile() {
    const response = await fetch(`${API_URL}/auth/profile`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch profile');
    return response.json();
  },

  // SOS ALERTS ENDPOINTS
  async getSosAlerts() {
    const response = await fetch(`${API_URL}/admin/sos-alerts`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch SOS alerts');
    return response.json();
  },

  async resolveSosAlert(alertId) {
    const response = await fetch(`${API_URL}/admin/sos-alerts/${alertId}/resolve`, {
      method: 'PATCH',
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to resolve SOS alert');
    return response.json();
  },

  async getAllFeedbacks() {
    const response = await fetch(`${API_URL}/admin/feedbacks`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch feedbacks');
    return response.json();
  },

  async submitFeedback(bookingId, feedbackData) {
    const response = await fetch(`${API_URL}/bookings/${bookingId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(feedbackData),
    });
    if (response.status === 401) {
      localStorage.removeItem('ambulance_user');
      window.location.reload();
      throw new Error('Session expired');
    }
    if (!response.ok) throw new Error('Failed to submit feedback');
    return response.json();
  },

  // SETTINGS ENDPOINTS
  async getSettings() {
    const response = await fetch(`${API_URL}/settings`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch settings');
    return response.json();
  },

  async updateSettings(data) {
    const response = await fetch(`${API_URL}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update settings');
    return response.json();
  },

  // USER MANAGEMENT ENDPOINTS
  async blockUser(userType, userId, blockData) {
    const response = await fetch(`${API_URL}/admin/users/${userType}/${userId}/block`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(blockData),
    });
    if (!response.ok) throw new Error('Failed to block user');
    return response.json();
  },

  async unblockUser(userType, userId) {
    const response = await fetch(`${API_URL}/admin/users/${userType}/${userId}/unblock`, {
      method: 'POST',
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to unblock user');
    return response.json();
  },

  // PAYMENT ENDPOINTS
  async createRazorpayOrder(amount, bookingId) {
    const response = await fetch(`${API_URL}/payment/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ amount, bookingId }),
    });
    if (!response.ok) throw new Error('Failed to create payment order');
    return response.json();
  },

  async verifyRazorpayPayment(paymentData) {
    const response = await fetch(`${API_URL}/payment/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(paymentData),
    });
    if (!response.ok) throw new Error('Payment verification failed');
    return response.json();
  },

  async getRazorpayKey() {
    const response = await fetch(`${API_URL}/payment/razorpay-key`);
    if (!response.ok) throw new Error('Failed to get Razorpay key');
    return response.json();
  },

  // PAYOUT ENDPOINTS
  async getDriverPayouts() {
    const response = await fetch(`${API_URL}/payouts/driver`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch payouts');
    return response.json();
  },

  async getAdminPayouts(status = 'all', startDate = null, endDate = null) {
    let url = `${API_URL}/payouts/admin?status=${status}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    
    const response = await fetch(url, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch admin payouts');
    return response.json();
  },

  async completePayout(payoutId, transactionId, notes) {
    const response = await fetch(`${API_URL}/payouts/${payoutId}/complete`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ transactionId, notes }),
    });
    if (!response.ok) throw new Error('Failed to complete payout');
    return response.json();
  },

  async failPayout(payoutId, failureReason) {
    const response = await fetch(`${API_URL}/payouts/${payoutId}/fail`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ failureReason }),
    });
    if (!response.ok) throw new Error('Failed to mark payout as failed');
    return response.json();
  },

  async triggerPayouts() {
    const response = await fetch(`${API_URL}/payouts/admin/trigger`, {
      method: 'POST',
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to trigger payouts');
    return response.json();
  },

  async getPayoutStats() {
    const response = await fetch(`${API_URL}/payouts/stats`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch payout stats');
    return response.json();
  },

  // USER PROFILE ENDPOINTS
  async getProfile() {
    const response = await fetch(`${API_URL}/auth/profile`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to fetch profile');
    }
    return response.json();
  },

  async updateProfile(profileData) {
    const response = await fetch(`${API_URL}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(profileData),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update profile');
    }
    return data;
  },
};
