import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { api } from "../services/api";
import { GodModeMap } from "../components/GodModeMap";
import {
  Users,
  Car,
  MapPin,
  IndianRupee,
  LogOut,
  Activity,
  Check,
  X,
  Calendar,
  Filter,
  Search,
  FileText,
  TrendingUp,
  Download,
  AlertTriangle,
  Bell
} from "lucide-react";
import * as XLSX from 'xlsx';

export const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const socket = useSocket();

  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalDrivers: 0,
    totalBookings: 0,
    totalRevenue: 0,
    adminTotalRevenue: 0,
    adminTodayRevenue: 0
  });
  const [pendingDrivers, setPendingDrivers] = useState([]);
  const [allDrivers, setAllDrivers] = useState([]);
  const [patients, setPatients] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [unreadSosCount, setUnreadSosCount] = useState(0);
  const [filters, setFilters] = useState({
    status: 'all',
    startDate: '',
    endDate: '',
    search: ''
  });
  const [driverFilters, setDriverFilters] = useState({
    search: '',
    type: 'all'
  });
  const [patientSearch, setPatientSearch] = useState('');
  const [feedbacks, setFeedbacks] = useState([]);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    email: '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Settings State
  const [settings, setSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState({
    fareRates: {
      normal: { base: 200, perKm: 15 },
      icu: { base: 500, perKm: 30 },
      cardiac: { base: 600, perKm: 35 },
      dead_body_van: { base: 300, perKm: 20 }
    },
    commission: {
      platformPercent: 30,
      driverPercent: 70
    }
  });

  // Block/Ban Modal State
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockTarget, setBlockTarget] = useState({ type: '', id: '', name: '' });
  const [blockReason, setBlockReason] = useState('');
  const [blockDuration, setBlockDuration] = useState('7');

  // Socket listener for SOS alerts
  useEffect(() => {
    if (!socket) return;

    socket.on('sos_alert', (alert) => {
      // Add new SOS alert to the list
      setSosAlerts(prev => [alert, ...prev]);
      setUnreadSosCount(prev => prev + 1);
      
      // Show popup notification
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => {}); // Play sound if available
      
      alert(`🚨 SOS ALERT!\n\nDriver: ${alert.driverName}\nPhone: ${alert.driverPhone}\nMessage: ${alert.message}\n\nLocation: ${alert.location?.lat}, ${alert.location?.lng}`);
    });

    return () => {
      socket.off('sos_alert');
    };
  }, [socket]);

  useEffect(() => {
    loadData();
    loadBookings();
    loadCharts();
    loadFeedbacks();
    loadSosAlerts();
  }, []);

  useEffect(() => {
    loadBookings();
  }, [filters]);

  useEffect(() => {
    if (activeTab === 'sos') {
      loadSosAlerts();
      setUnreadSosCount(0); // Mark as read when viewing
    }
  }, [activeTab]);

  useEffect(() => {
    if (showProfileModal) {
      const fetchProfile = async () => {
        try {
          const data = await api.getProfile();
          setProfileForm(prev => ({
            ...prev,
            email: data.email || '',
            oldPassword: '',
            newPassword: '',
            confirmPassword: ''
          }));
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      };
      fetchProfile();
    }
  }, [showProfileModal]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    
    // Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profileForm.email)) {
      alert("Please enter a valid email address.");
      return;
    }

    if (profileForm.newPassword) {
      const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{6,}$/;
      if (!passwordRegex.test(profileForm.newPassword)) {
        alert("New password must be at least 6 characters with one uppercase letter, one digit, and one special character.");
        return;
      }
      if (profileForm.newPassword !== profileForm.confirmPassword) {
        alert("New passwords do not match!");
        return;
      }
      if (!profileForm.oldPassword) {
        alert("Please enter your old password to set a new one.");
        return;
      }
    }

    try {
      await api.updateProfile({
        email: profileForm.email,
        oldPassword: profileForm.oldPassword,
        newPassword: profileForm.newPassword
      });
      alert('Profile updated successfully!');
      setShowProfileModal(false);
    } catch (error) {
      console.error('Update failed:', error);
      alert(error.message);
    }
  };

  const loadData = async () => {
    try {
      const statsData = await api.getAdminStats();
      setStats(statsData);

      const pendingData = await api.getPendingDrivers();
      setPendingDrivers(pendingData);

      const allDriversData = await api.getAllDrivers();
      setAllDrivers(allDriversData);

      const patientsData = await api.getAllPatients();
      setPatients(patientsData);
    } catch (error) {
      console.error("Error loading admin data:", error);
    }
  };

  const loadBookings = async () => {
    try {
      const data = await api.getAllBookings(filters);
      setBookings(data);
    } catch (error) {
      console.error("Error loading bookings:", error);
    }
  };

  const loadCharts = async () => {
    try {
      const data = await api.getAdminCharts();
      if (data.dailyStats && data.monthlyStats) {
        setDailyStats(data.dailyStats);
        setMonthlyStats(data.monthlyStats);
      } else {
        // Fallback for old API response structure if needed
        setDailyStats(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error loading charts:", error);
    }
  };

  const loadFeedbacks = async () => {
    try {
      const data = await api.getAllFeedbacks();
      setFeedbacks(data);
    } catch (error) {
      console.error("Error loading feedbacks:", error);
    }
  };

  const loadSosAlerts = async () => {
    try {
      const data = await api.getSosAlerts();
      setSosAlerts(data);
      // Count unread alerts (those without resolvedAt)
      const unread = data.filter(alert => !alert.resolvedAt).length;
      setUnreadSosCount(unread);
    } catch (error) {
      console.error("Error loading SOS alerts:", error);
    }
  };

  const markSosResolved = async (alertId) => {
    try {
      await api.resolveSosAlert(alertId);
      loadSosAlerts(); // Reload alerts
    } catch (error) {
      console.error("Error resolving SOS alert:", error);
      alert("Failed to resolve alert");
    }
  };

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings(data);
      setSettingsForm({
        fareRates: data.fareRates,
        commission: data.commission
      });
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  useEffect(() => {
    if (activeTab === 'settings') {
      loadSettings();
    }
  }, [activeTab]);

  const handleVerifyDriver = async (driverId, isVerified) => {
    if (!isVerified) {
      setSelectedDriverId(driverId);
      setRejectModalOpen(true);
      return;
    }
    try {
      await api.verifyDriver(driverId, isVerified);
      loadData(); // Reload data to refresh list
    } catch (error) {
      console.error("Error verifying driver:", error);
    }
  };

  const submitRejection = async () => {
    if (!rejectionReason.trim()) return;
    try {
      await api.verifyDriver(selectedDriverId, false, rejectionReason);
      setRejectModalOpen(false);
      setRejectionReason('');
      setSelectedDriverId(null);
      loadData();
    } catch (error) {
      console.error("Error rejecting driver:", error);
    }
  };

  const handleExportBookings = () => {
    const ws = XLSX.utils.json_to_sheet(bookings);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bookings");

    // Generate buffer
    XLSX.writeFile(wb, "bookings.xlsx");
  };

  const downloadExcel = () => {
    const dataToExport = bookings.map(booking => ({
      'Booking ID': booking.bookingId || booking._id,
      'Date': new Date(booking.createdAt).toLocaleDateString(),
      'Time': new Date(booking.createdAt).toLocaleTimeString(),
      'Patient Name': booking.patientId?.name || 'Unknown',
      'Patient Phone': booking.patientId?.phone || 'N/A',
      'Driver Name': booking.driverId?.name || 'Unassigned',
      'Driver Vehicle': booking.driverId?.vehicleNumber || 'N/A',
      'Pickup Address': booking.pickupAddress,
      'Drop Address': booking.dropAddress,
      'Ambulance Type': booking.ambulanceType,
      'Distance (km)': booking.distance,
      'Amount': booking.amount || booking.fare,
      'Status': booking.status,
      'Payment Status': booking.paymentStatus
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bookings");
    XLSX.writeFile(wb, "Ambulance_Bookings.xlsx");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg fixed h-full z-10">
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-lg">
              <span className="text-2xl">🚑</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Admin Panel</span>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "overview"
                ? "bg-red-50 text-red-600"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Activity className="w-5 h-5" />
            <span className="font-medium">Overview</span>
          </button>
          <button
            onClick={() => setActiveTab("bookings")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "bookings"
                ? "bg-red-50 text-red-600"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="font-medium">Bookings</span>
          </button>
          <button
            onClick={() => setActiveTab("drivers")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "drivers"
                ? "bg-red-50 text-red-600"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Car className="w-5 h-5" />
            <span className="font-medium">Pending Drivers</span>
          </button>
          <button
            onClick={() => setActiveTab("all_drivers")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "all_drivers"
                ? "bg-red-50 text-red-600"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="font-medium">All Drivers</span>
          </button>
          <button
            onClick={() => setActiveTab("patients")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "patients"
                ? "bg-red-50 text-red-600"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="font-medium">Patients</span>
          </button>
          <button
            onClick={() => setActiveTab("feedbacks")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "feedbacks"
                ? "bg-red-50 text-red-600"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Activity className="w-5 h-5" />
            <span className="font-medium">Feedbacks</span>
          </button>
          <button
            onClick={() => setActiveTab("sos")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative ${
              activeTab === "sos"
                ? "bg-red-50 text-red-600"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">SOS Alerts</span>
            {unreadSosCount > 0 && (
              <span className="absolute right-3 top-3 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                {unreadSosCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "settings"
                ? "bg-red-50 text-red-600"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </button>
          <button
            onClick={() => setActiveTab("godmode")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "godmode"
                ? "bg-red-50 text-red-600"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <MapPin className="w-5 h-5" />
            <span className="font-medium">Live Map</span>
          </button>
          
          <div className="pt-4 mt-4 border-t border-gray-100">
            <button
              onClick={() => setShowProfileModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Users className="w-5 h-5" />
              <span className="font-medium">Edit Profile</span>
            </button>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        {activeTab === "overview" && (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Total Patients</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.totalPatients}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-green-100 p-3 rounded-lg">
                  <Car className="w-6 h-6 text-green-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Total Drivers</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.totalDrivers}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-purple-100 p-3 rounded-lg">
                  <MapPin className="w-6 h-6 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Total Bookings</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.totalBookings}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-yellow-100 p-3 rounded-lg">
                  <IndianRupee className="w-6 h-6 text-yellow-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Total Revenue</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">₹{stats.adminTotalRevenue || 0}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-orange-100 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Today's Revenue</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">₹{stats.adminTodayRevenue || 0}</p>
            </div>
          </div>

          {/* Online Drivers Section */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Online Drivers</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allDrivers.filter(d => d.status === 'online').map(driver => (
                  <div key={driver._id} className="flex items-center gap-4 p-4 border rounded-lg bg-green-50 border-green-100">
                    <div className="bg-green-100 p-3 rounded-full">
                      <Car className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{driver.name}</h3>
                      <p className="text-sm text-gray-600">{driver.vehicleNumber}</p>
                      <span className="text-xs font-medium text-green-700 bg-green-200 px-2 py-0.5 rounded-full">
                        {driver.ambulanceType}
                      </span>
                    </div>
                  </div>
                ))}
                {allDrivers.filter(d => d.status === 'online').length === 0 && (
                  <p className="text-gray-500 col-span-full text-center py-4">No drivers currently online</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Bookings Chart (Daily) */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-6">Bookings - Last 7 Days</h3>
              <div className="space-y-4">
                {dailyStats.map((day) => (
                  <div key={day._id} className="flex items-center gap-4">
                    <span className="w-24 text-sm text-gray-500">{new Date(day._id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${(day.count / Math.max(...dailyStats.map(d => d.count), 1)) * 100}%` }}
                      ></div>
                    </div>
                    <span className="w-8 text-sm font-medium text-gray-900">{day.count}</span>
                  </div>
                ))}
                {dailyStats.length === 0 && <p className="text-gray-500 text-center">No data available</p>}
              </div>
            </div>

            {/* Revenue Graph (Monthly) */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-6">Monthly Revenue Trend</h3>
              <div className="h-64 flex items-end gap-2">
                {monthlyStats.map((month) => {
                  const maxRevenue = Math.max(...monthlyStats.map(d => d.revenue), 100);
                  const height = (month.revenue / maxRevenue) * 100;
                  return (
                    <div key={month._id} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                      <div 
                        className="w-full bg-green-100 rounded-t-lg relative group-hover:bg-green-200 transition-all duration-500 min-h-[4px]"
                        style={{ height: `${height}%` }}
                      >
                        <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          ₹{month.revenue}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 rotate-45 origin-left mt-2 w-full text-center">
                        {new Date(month._id + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
                {monthlyStats.length === 0 && <p className="w-full text-gray-500 text-center self-center">No data available</p>}
              </div>
            </div>
          </div>

          {/* Recent Bookings */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
              <button 
                onClick={() => setActiveTab('bookings')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {bookings.slice(0, 3).map((booking) => (
                <div key={booking._id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{booking.patientId?.name || 'Unknown Patient'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          booking.status === 'completed' ? 'bg-green-100 text-green-700' :
                          booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {booking.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-2">
                        {new Date(booking.createdAt).toLocaleString()}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {booking.distance} km</span>
                        <span className="flex items-center gap-1"><Car className="w-3 h-3" /> {booking.ambulanceType}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">₹{booking.amount || booking.fare}</p>
                      <p className="text-xs text-gray-500">Driver: {booking.driverId?.name || 'Unassigned'}</p>
                    </div>
                  </div>
                </div>
              ))}
              {bookings.length === 0 && (
                <div className="p-8 text-center text-gray-500">No recent bookings</div>
              )}
            </div>
          </div>
          </>
        )}

        {activeTab === "bookings" && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Name..."
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  className="w-full border-none focus:ring-0 text-gray-900 placeholder-gray-400"
                />
              </div>
              <div className="h-8 w-px bg-gray-200"></div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="border-none focus:ring-0 text-sm text-gray-600 bg-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="requested">Requested</option>
                  <option value="on_the_way">On the Way</option>
                  <option value="dropped">Dropped</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                    className="border-none focus:ring-0 text-sm text-gray-600 bg-transparent"
                    placeholder="From Date"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                    className="border-none focus:ring-0 text-sm text-gray-600 bg-transparent"
                    placeholder="To Date"
                  />
                </div>
              </div>
              <button
                onClick={downloadExcel}
                className="ml-auto flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Export Excel
              </button>
            </div>

            {/* Bookings List */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {bookings.map((booking) => (
                      <tr key={booking._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{booking.patientId?.name || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">{new Date(booking.createdAt).toLocaleDateString()}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{booking.ambulanceType}</div>
                          <div className="text-xs text-gray-500">{booking.distance} km</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {booking.driverId ? (
                            <div>
                              <div className="font-medium text-gray-900">{booking.driverId.name}</div>
                              <div className="text-xs">{booking.driverId.vehicleNumber}</div>
                            </div>
                          ) : (
                            <span className="text-yellow-600">Pending</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            booking.status === 'completed' || booking.status === 'dropped' ? 'bg-green-100 text-green-800' :
                            booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {booking.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-gray-900">
                          ₹{booking.amount || booking.fare}
                        </td>
                      </tr>
                    ))}
                    {bookings.length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                          No bookings found matching filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "drivers" && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Pending Driver Approvals</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documents</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pendingDrivers.map((driver) => (
                    <tr key={driver._id}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{driver.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{driver.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{driver.vehicleNumber}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        <div className="flex gap-2">
                          {driver.documents && driver.documents.map((doc, idx) => (
                            <a 
                              key={idx} 
                              href={`http://localhost:5000${doc.url}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs border border-blue-200 px-2 py-1 rounded bg-blue-50"
                            >
                              {doc.type.toUpperCase()}
                            </a>
                          ))}
                          {(!driver.documents || driver.documents.length === 0) && (
                            <span className="text-gray-400 text-xs">No docs</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                        <button
                          onClick={() => handleVerifyDriver(driver._id, true)}
                          className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200"
                        >
                          <Check className="w-4 h-4 mr-1" /> Approve
                        </button>
                        <button
                          onClick={() => handleVerifyDriver(driver._id, false)}
                          className="inline-flex items-center px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
                        >
                          <X className="w-4 h-4 mr-1" /> Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pendingDrivers.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                        No pending driver requests
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "all_drivers" && (
          <div className="space-y-6">
            {/* Driver Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Driver Name..."
                  value={driverFilters.search}
                  onChange={(e) => setDriverFilters({...driverFilters, search: e.target.value})}
                  className="w-full border-none focus:ring-0 text-gray-900 placeholder-gray-400"
                />
              </div>
              <div className="h-8 w-px bg-gray-200"></div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={driverFilters.type}
                  onChange={(e) => setDriverFilters({...driverFilters, type: e.target.value})}
                  className="border-none focus:ring-0 text-sm text-gray-600 bg-transparent"
                >
                  <option value="all">All Types</option>
                  <option value="Normal">Normal</option>
                  <option value="ICU">ICU</option>
                  <option value="Cardiac">Cardiac</option>
                  <option value="DeadBodyVan">Dead Body Van</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">All Drivers Status</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ambulance Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {allDrivers
                      .filter(driver => {
                        const matchesSearch = driver.name.toLowerCase().includes(driverFilters.search.toLowerCase());
                        const matchesType = driverFilters.type === 'all' || driver.ambulanceType === driverFilters.type;
                        return matchesSearch && matchesType;
                      })
                      .map((driver) => (
                      <tr key={driver._id} className={driver.isBlocked ? 'bg-red-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{driver.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{driver.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{driver.vehicleNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{driver.ambulanceType}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-yellow-500 font-bold">{driver.rating || 0} ⭐</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {driver.isBlocked ? (
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                              Blocked
                            </span>
                          ) : (
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              driver.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {driver.status === 'online' ? 'Active' : 'Inactive'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {driver.isBlocked ? (
                            <button
                              onClick={async () => {
                                try {
                                  await api.unblockUser('driver', driver._id);
                                  alert('Driver unblocked successfully');
                                  loadData();
                                } catch (error) {
                                  alert(error.message);
                                }
                              }}
                              className="text-green-600 hover:text-green-800 font-medium text-sm"
                            >
                              Unblock
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setBlockTarget({ type: 'driver', id: driver._id, name: driver.name });
                                setShowBlockModal(true);
                              }}
                              className="text-red-600 hover:text-red-800 font-medium text-sm"
                            >
                              Block
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {allDrivers.length === 0 && (
                      <tr>
                        <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                          No drivers found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "patients" && (
          <div className="space-y-6">
            {/* Patient Search */}
            <div className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Patient Name..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full border-none focus:ring-0 text-gray-900 placeholder-gray-400"
                />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Registered Patients</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {patients
                      .filter(patient => patient.name.toLowerCase().includes(patientSearch.toLowerCase()))
                      .map((patient) => (
                      <tr key={patient._id} className={patient.isBlocked ? 'bg-red-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{patient.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{patient.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{patient.phone}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{patient.address || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                          {new Date(patient.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {patient.isBlocked ? (
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                              Blocked
                            </span>
                          ) : (
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {patient.isBlocked ? (
                            <button
                              onClick={async () => {
                                try {
                                  await api.unblockUser('patient', patient._id);
                                  alert('Patient unblocked successfully');
                                  loadData();
                                } catch (error) {
                                  alert(error.message);
                                }
                              }}
                              className="text-green-600 hover:text-green-800 font-medium text-sm"
                            >
                              Unblock
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setBlockTarget({ type: 'patient', id: patient._id, name: patient.name });
                                setShowBlockModal(true);
                              }}
                              className="text-red-600 hover:text-red-800 font-medium text-sm"
                            >
                              Block
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {patients.length === 0 && (
                      <tr>
                        <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                          No patients found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "feedbacks" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">User Feedbacks</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {feedbacks.map((feedback) => (
                      <tr key={feedback._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                          {new Date(feedback.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                          {feedback.reviewerId?.name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                          {feedback.driverId?.name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-yellow-500 font-bold">
                          {feedback.rating} ⭐
                        </td>
                        <td className="px-6 py-4 text-gray-500 max-w-xs truncate">
                          {feedback.comment || '-'}
                        </td>
                      </tr>
                    ))}
                    {feedbacks.length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                          No feedbacks found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && settings && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Fare & Commission Settings</h2>
              
              {/* Ambulance Types Fare */}
              <div className="space-y-4 mb-8">
                <h3 className="text-lg font-semibold text-gray-800">Ambulance Fares</h3>
                
                {Object.keys(settingsForm.fareRates).map((type) => (
                  <div key={type} className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3 capitalize">{type.replace('_', ' ')} Ambulance</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Base Fare (₹)</label>
                        <input
                          type="number"
                          value={settingsForm.fareRates[type].base}
                          onChange={(e) => setSettingsForm({
                            ...settingsForm,
                            fareRates: {
                              ...settingsForm.fareRates,
                              [type]: { ...settingsForm.fareRates[type], base: parseFloat(e.target.value) }
                            }
                          })}
                          className="w-full border rounded-md p-2"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Per KM (₹)</label>
                        <input
                          type="number"
                          value={settingsForm.fareRates[type].perKm}
                          onChange={(e) => setSettingsForm({
                            ...settingsForm,
                            fareRates: {
                              ...settingsForm.fareRates,
                              [type]: { ...settingsForm.fareRates[type], perKm: parseFloat(e.target.value) }
                            }
                          })}
                          className="w-full border rounded-md p-2"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Commission */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Commission Structure</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Platform Commission (%)</label>
                    <input
                      type="number"
                      value={settingsForm.commission.platformPercent}
                      onChange={(e) => {
                        const platform = parseFloat(e.target.value);
                        setSettingsForm({
                          ...settingsForm,
                          commission: {
                            platformPercent: platform,
                            driverPercent: 100 - platform
                          }
                        });
                      }}
                      className="w-full border rounded-md p-2"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Driver Share (%)</label>
                    <input
                      type="number"
                      value={settingsForm.commission.driverPercent}
                      disabled
                      className="w-full border rounded-md p-2 bg-gray-100"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={async () => {
                  try {
                    await api.updateSettings(settingsForm);
                    alert('Settings updated successfully!');
                    loadSettings();
                  } catch (error) {
                    alert(error.message);
                  }
                }}
                className="mt-6 w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700"
              >
                Save Settings
              </button>
            </div>
          </div>
        )}

        {/* SOS Alerts */}
        {activeTab === "sos" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                    SOS Alerts
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">Emergency alerts from drivers</p>
                </div>
                <button
                  onClick={loadSosAlerts}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                >
                  Refresh
                </button>
              </div>

              {sosAlerts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <AlertTriangle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No SOS alerts</p>
                  <p className="text-sm mt-1">All clear! No emergency alerts at the moment.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sosAlerts.map((alert) => (
                    <div
                      key={alert._id}
                      className={`border rounded-lg p-4 transition-all ${
                        alert.resolvedAt
                          ? "border-gray-200 bg-gray-50"
                          : "border-red-300 bg-red-50 shadow-md"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className={`w-5 h-5 ${alert.resolvedAt ? "text-gray-400" : "text-red-600"}`} />
                            <h3 className="font-semibold text-gray-900">
                              {alert.driverId?.name || "Unknown Driver"}
                            </h3>
                            {!alert.resolvedAt && (
                              <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full animate-pulse">
                                ACTIVE
                              </span>
                            )}
                            {alert.resolvedAt && (
                              <span className="px-2 py-1 bg-gray-400 text-white text-xs rounded-full">
                                RESOLVED
                              </span>
                            )}
                          </div>
                          <p className="text-gray-700 mb-3 font-medium">{alert.message}</p>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-gray-500">Phone:</span>
                              <a
                                href={`tel:${alert.driverId?.phone}`}
                                className="ml-2 text-blue-600 hover:underline font-medium"
                              >
                                {alert.driverId?.phone || "N/A"}
                              </a>
                            </div>
                            <div>
                              <span className="text-gray-500">Vehicle:</span>
                              <span className="ml-2 font-medium text-gray-900">
                                {alert.driverId?.vehicleNumber || "N/A"}
                              </span>
                            </div>
                            {alert.location && (
                              <div className="col-span-2">
                                <span className="text-gray-500">Location:</span>
                                <a
                                  href={`https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 text-blue-600 hover:underline text-xs"
                                >
                                  {alert.location.lat.toFixed(4)}, {alert.location.lng.toFixed(4)} (View on Map)
                                </a>
                              </div>
                            )}
                            <div>
                              <span className="text-gray-500">Time:</span>
                              <span className="ml-2 text-gray-900 text-xs">
                                {new Date(alert.createdAt).toLocaleString()}
                              </span>
                            </div>
                            {alert.resolvedAt && (
                              <div>
                                <span className="text-gray-500">Resolved:</span>
                                <span className="ml-2 text-gray-900 text-xs">
                                  {new Date(alert.resolvedAt).toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {!alert.resolvedAt && (
                            <button
                              onClick={() => markSosResolved(alert._id)}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                            >
                              Mark Resolved
                            </button>
                          )}
                          <a
                            href={`tel:${alert.driverId?.phone}`}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors text-center whitespace-nowrap"
                          >
                            Call Driver
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* God Mode - Live Map */}
        {activeTab === "godmode" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">🌍 God Mode - Global Live Map</h2>
              <p className="text-sm text-gray-600 mb-4">Real-time view of all ambulances in the system</p>
              <div className="h-[600px] rounded-lg overflow-hidden">
                <GodModeMap drivers={allDrivers} />
              </div>
            </div>
          </div>
        )}

        {/* Rejection Modal */}
        {rejectModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Reject Driver Application</h3>
              <p className="text-gray-600 mb-4">Please provide a reason for rejection. This will be sent to the driver via email.</p>
              <textarea
                className="w-full border border-gray-300 rounded-md p-2 mb-4 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                rows="4"
                placeholder="Enter rejection reason..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              ></textarea>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setRejectModalOpen(false);
                    setRejectionReason('');
                    setSelectedDriverId(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={submitRejection}
                  disabled={!rejectionReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  Reject Driver
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Profile Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Edit Profile</h3>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Old Password</label>
                  <input
                    type="password"
                    value={profileForm.oldPassword}
                    onChange={(e) => setProfileForm({...profileForm, oldPassword: e.target.value})}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Leave blank if not changing"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input
                    type="password"
                    value={profileForm.newPassword}
                    onChange={(e) => setProfileForm({...profileForm, newPassword: e.target.value})}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Leave blank if not changing"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Min 6 chars, 1 uppercase, 1 digit, 1 special char
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={profileForm.confirmPassword}
                    onChange={(e) => setProfileForm({...profileForm, confirmPassword: e.target.value})}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Leave blank if not changing"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowProfileModal(false)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Block/Ban Modal */}
        {showBlockModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">
                Block {blockTarget.type === 'driver' ? 'Driver' : 'Patient'}: {blockTarget.name}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Blocking</label>
                  <textarea
                    rows="3"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="Enter the reason for blocking this user..."
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  ></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Block Duration</label>
                  <select
                    value={blockDuration}
                    onChange={(e) => setBlockDuration(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="1">1 Day</option>
                    <option value="7">7 Days</option>
                    <option value="30">30 Days</option>
                    <option value="permanent">Permanent</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowBlockModal(false);
                      setBlockTarget({ type: '', id: '', name: '' });
                      setBlockReason('');
                      setBlockDuration('7');
                    }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!blockReason.trim()) {
                        alert('Please provide a reason for blocking');
                        return;
                      }
                      try {
                        await api.blockUser(blockTarget.type, blockTarget.id, {
                          reason: blockReason,
                          duration: blockDuration === 'permanent' ? 'permanent' : parseInt(blockDuration)
                        });
                        alert(`${blockTarget.type === 'driver' ? 'Driver' : 'Patient'} blocked successfully`);
                        setShowBlockModal(false);
                        setBlockTarget({ type: '', id: '', name: '' });
                        setBlockReason('');
                        setBlockDuration('7');
                        loadData();
                      } catch (error) {
                        alert(error.message);
                      }
                    }}
                    disabled={!blockReason.trim()}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    Block User
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
