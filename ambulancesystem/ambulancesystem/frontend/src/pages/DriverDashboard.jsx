import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';
import { MapView } from '../components/MapView';
import { MapPin, Navigation, Check, X, Clock, LogOut, User, TrendingUp, Bell, AlertTriangle, BarChart3, Download, Calendar, Filter, Phone, AlertCircle, MessageSquare, Star } from 'lucide-react';
import * as XLSX from 'xlsx';
import LocationTracker from '../utils/locationTracker';

export const DriverDashboard = () => {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const locationTrackerRef = useRef(null);
  const [driverData, setDriverData] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [activeTab, setActiveTab] = useState('rides');
  const [availableBookings, setAvailableBookings] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Analytics & Earnings state
  const [dateFilter, setDateFilter] = useState('week'); // week, month, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [analyticsData, setAnalyticsData] = useState({
    totalRides: 0,
    totalEarnings: 0,
    averageRating: 0,
    completedRides: [],
    earningsBreakdown: [],
    pendingPayouts: 0,
    payoutHistory: [],
    pendingPayoutsByDay: []
  });
  
  // SOS & Feedback state
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [sosMessage, setSosMessage] = useState('');
  const [feedbackList, setFeedbackList] = useState([]);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [replyText, setReplyText] = useState('');
  
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (showProfileModal && driverData) {
      setProfileForm({
        name: driverData.name || '',
        email: driverData.email || '',
        phone: driverData.phone || '',
        address: driverData.address || '',
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    }
  }, [showProfileModal, driverData]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();

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
      await api.updateProfile(profileForm);
      alert('Profile updated successfully!');
      setShowProfileModal(false);
      loadDriverData();
    } catch (error) {
      console.error('Update failed:', error);
      alert(error.message);
    }
  };

  useEffect(() => {
    loadDriverData();
    loadBookings();
    
    // Set fallback location IMMEDIATELY - no waiting
    setCurrentLocation({ lat: 21.1702, lng: 72.8311 });
    setLocationAccuracy(null);
    
    // Initialize GPS tracking with LocationTracker
    if (!locationTrackerRef.current) {
      locationTrackerRef.current = new LocationTracker();
    }

    const tracker = locationTrackerRef.current;

    // Start GPS tracking in background (non-blocking, silent errors)
    setTimeout(() => {
      if (navigator.geolocation) {
        tracker.startTracking(
          (locationData) => {
            // Update location state when GPS succeeds
            setCurrentLocation({
              lat: locationData.latitude,
              lng: locationData.longitude
            });
            setLocationAccuracy(locationData.accuracy);

            // Send location to server via Socket.IO if online and have active booking
            if (socket && isOnline) {
              const activeBooking = myBookings.find(b => 
                ['accepted', 'on_the_way', 'picked'].includes(b.status)
              );

              if (activeBooking) {
                socket.emit('driver_location_update', {
                  driverId: user._id,
                  bookingId: activeBooking._id,
                  location: {
                    latitude: locationData.latitude,
                    longitude: locationData.longitude
                  },
                  accuracy: locationData.accuracy,
                  speed: locationData.speed,
                  heading: locationData.heading,
                  altitude: locationData.altitude,
                  patientId: activeBooking.patientId
                });

                console.log('📍 Location sent to server:', {
                  lat: locationData.latitude.toFixed(6),
                  lng: locationData.longitude.toFixed(6),
                  accuracy: `${locationData.accuracy.toFixed(0)}m`,
                  speed: `${locationData.speed.toFixed(1)} km/h`
                });
              }
            }
          },
          (error) => {
            // Silent error handling - just log, don't show alerts
            console.warn('⚠️ GPS unavailable, using fallback location');
            // Keep using fallback location, don't update state
          },
          5000 // Update every 5 seconds
        );
      }
    }, 100); // Small delay to prevent blocking UI

    // Cleanup on unmount
    return () => {
      if (locationTrackerRef.current) {
        locationTrackerRef.current.stopTracking();
      }
    };
  }, []);

  // Handle online/offline status changes
  useEffect(() => {
    if (!socket || !user) return;

    if (isOnline) {
      // Notify server that driver is starting trip
      const activeBooking = myBookings.find(b => 
        ['accepted', 'on_the_way', 'picked'].includes(b.status)
      );
      
      if (activeBooking) {
        socket.emit('start_trip', {
          driverId: user._id,
          bookingId: activeBooking._id
        });
        console.log('🚗 Trip started for booking:', activeBooking._id);
      }
    } else {
      // Notify server that driver ended trip
      socket.emit('end_trip', {
        driverId: user._id
      });
      console.log('🛑 Trip ended');
    }
  }, [isOnline, myBookings, socket, user]);

  // Send location updates to server
  useEffect(() => {
    if (!socket || !currentLocation || !isOnline || !user) return;

    // Find active booking (accepted, on_the_way, picked)
    const activeBooking = myBookings.find(b => 
      ['accepted', 'on_the_way', 'picked'].includes(b.status)
    );

    // Location updates are now handled in the LocationTracker callback above
    // This effect just ensures socket connection is ready
    
  }, [currentLocation, myBookings, socket, isOnline, user]);

  useEffect(() => {
    if (!socket) return;

    // Join driver room for receiving block notifications
    if (user?._id) {
      socket.emit('join_driver_room', user._id);
    }

    // Listen for block notifications
    socket.on('user_blocked', (data) => {
      alert(`⚠️ Account Blocked\n\n${data.message}\n\nYou will be logged out now.`);
      logout();
    });

    socket.on('new_booking', (booking) => {
      setAvailableBookings(prev => [booking, ...prev]);
      // You could add a sound notification here
    });

    return () => {
      socket.off('user_blocked');
      socket.off('new_booking');
    };
  }, [socket, user, logout]);

  const loadDriverData = async () => {
    try {
      const data = await api.getDriverProfile();
      setDriverData(data);
      setIsOnline(data.status === 'online');
    } catch (error) {
      console.error('Error loading driver data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    try {
      const available = await api.getAvailableBookings();
      const my = await api.getDriverBookings();
      setAvailableBookings(available);
      setMyBookings(my);
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  };

  const loadAnalyticsData = async () => {
    try {
      const data = await api.getDriverAnalytics(dateFilter, customStartDate, customEndDate);
      
      // Fetch payout data separately
      const payoutData = await api.getDriverPayouts();
      
      setAnalyticsData({
        ...data,
        pendingPayouts: payoutData.pendingEarnings || 0,
        pendingRideCount: payoutData.pendingRideCount || 0,
        payoutHistory: payoutData.payouts || [],
        pendingPayoutsByDay: payoutData.pendingPayoutsByDay || []
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'analytics' || activeTab === 'earnings') {
      loadAnalyticsData();
    }
  }, [activeTab, dateFilter, customStartDate, customEndDate]);

  const exportToExcel = () => {
    const exportData = analyticsData.completedRides.map(ride => ({
      Date: new Date(ride.createdAt).toLocaleDateString(),
      'Pickup Address': ride.pickupAddress,
      'Drop Address': ride.dropAddress,
      'Distance (km)': ride.distance || ride.distanceKm,
      'Fare (₹)': ride.amount || ride.fare,
      'Commission (₹)': ride.platformCommission || 0,
      'Your Earnings (₹)': ride.driverEarnings || (ride.amount || ride.fare),
      Status: ride.status
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trip History');
    XLSX.writeFile(wb, `trip-history-${dateFilter}-${Date.now()}.xlsx`);
  };

  const handleSOS = async () => {
    try {
      await api.sendSOSAlert({
        message: sosMessage,
        location: currentLocation
      });
      alert('SOS alert sent to admin successfully!');
      setShowSOSModal(false);
      setSosMessage('');
    } catch (error) {
      alert('Failed to send SOS alert: ' + error.message);
    }
  };

  const callEmergency = () => {
    window.location.href = 'tel:108'; // Indian emergency ambulance number
  };

  const loadFeedback = async () => {
    try {
      const data = await api.getDriverFeedback();
      setFeedbackList(data);
    } catch (error) {
      console.error('Error loading feedback:', error);
    }
  };

  const handleReplyToFeedback = async (feedbackId) => {
    if (!replyText.trim()) {
      alert('Please enter a reply');
      return;
    }
    try {
      await api.replyToFeedback(feedbackId, replyText);
      alert('Reply sent successfully!');
      setSelectedFeedback(null);
      setReplyText('');
      loadFeedback();
    } catch (error) {
      alert('Failed to send reply: ' + error.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'feedback') {
      loadFeedback();
    }
  }, [activeTab]);


  const toggleOnlineStatus = async () => {
    try {
      // If going online, request location first
      if (!isOnline) {
        if (!navigator.geolocation) {
          alert('Geolocation is not supported by your browser');
          return;
        }

        // Request location permission
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });

        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        // Update location state immediately
        setCurrentLocation(location);

        // Send status with location
        const res = await api.toggleDriverStatus(location);
        setIsOnline(res.status === 'online');
        setDriverData(prev => ({ ...prev, status: res.status, location: res.location }));
        alert('You are now online! Your location is being tracked.');
      } else {
        // Going offline, no location needed
        const res = await api.toggleDriverStatus();
        setIsOnline(res.status === 'online');
        setDriverData(prev => ({ ...prev, status: res.status }));
      }
    } catch (error) {
      if (error.code === 1) {
        alert('Location permission denied. Please enable location access to go online.');
      } else if (error.code === 2) {
        alert('Location unavailable. Please check your device settings.');
      } else if (error.code === 3) {
        alert('Location request timed out. Please try again.');
      } else {
        console.error('Error toggling status:', error);
        alert('Failed to update status: ' + error.message);
      }
    }
  };

  const handleAcceptBooking = async (bookingId) => {
    try {
      await api.acceptBooking(bookingId);
      loadBookings(); // Refresh lists
    } catch (error) {
      console.error('Error accepting booking:', error);
      alert('Failed to accept booking');
    }
  };

  const handleUpdateStatus = async (bookingId, newStatus) => {
    try {
      await api.updateBookingStatus(bookingId, newStatus);
      loadBookings();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await api.setDriverOffline();
    } catch (error) {
      console.error('Error setting offline status:', error);
    } finally {
      logout();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading driver data...</p>
        </div>
      </div>
    );
  }

  if (driverData && !driverData.isApproved) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-6">
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Pending Approval</h2>
          <p className="text-gray-600 mb-6">
            Your account is currently under review by the admin. You will be able to access the dashboard once your documents are verified.
          </p>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="bg-red-100 p-2 rounded-lg">
                <span className="text-2xl">🚑</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Driver Panel</span>
            </div>
            
            <div className="flex items-center gap-4">
              {/* SOS Button */}
              <button
                onClick={() => setShowSOSModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-lg"
                title="Emergency SOS"
              >
                <AlertCircle className="w-5 h-5" />
                <span className="hidden sm:inline">SOS</span>
              </button>
              
              <button
                onClick={() => setShowProfileModal(true)}
                className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                title="Edit Profile"
              >
                <User className="w-6 h-6" />
              </button>
              <button
                onClick={toggleOnlineStatus}
                className={`px-4 py-2 rounded-full font-medium transition-colors ${
                  isOnline 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isOnline ? 'You are Online' : 'You are Offline'}
              </button>
              
              <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-600 transition-colors">
                <LogOut className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Welcome, {driverData?.name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600 font-medium">Vehicle Number</p>
              <p className="text-lg font-bold text-blue-900">{driverData?.vehicleNumber}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">Ambulance Type</p>
              <p className="text-lg font-bold text-purple-900">{driverData?.ambulanceType}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600 font-medium">Rating</p>
              <p className="text-lg font-bold text-green-900">{driverData?.rating} ⭐</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-600 font-medium">Total Earnings</p>
              <p className="text-lg font-bold text-yellow-900">₹{driverData?.earnings?.total || 0}</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-600 font-medium">Today's Earnings</p>
              <p className="text-lg font-bold text-orange-900">₹{driverData?.earnings?.today || 0}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('rides')}
            className={`pb-4 px-2 font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'rides' ? 'text-red-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Available Requests
            {activeTab === 'rides' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></div>}
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`pb-4 px-2 font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'active' ? 'text-red-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            My Active Rides
            {activeTab === 'active' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></div>}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-4 px-2 font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'history' ? 'text-red-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Ride History
            {activeTab === 'history' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></div>}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`pb-4 px-2 font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'analytics' ? 'text-red-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Analytics
            {activeTab === 'analytics' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></div>}
          </button>
          <button
            onClick={() => setActiveTab('earnings')}
            className={`pb-4 px-2 font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'earnings' ? 'text-red-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Earnings
            {activeTab === 'earnings' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></div>}
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`pb-4 px-2 font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'feedback' ? 'text-red-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Feedback
            {activeTab === 'feedback' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></div>}
          </button>
        </div>

        {/* AVAILABLE REQUESTS */}
        {activeTab === 'rides' && (
          <div className="space-y-4">
            {availableBookings.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">
                <p>No new ride requests available.</p>
              </div>
            ) : (
              availableBookings.map(booking => (
                <div key={booking._id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                          New Request
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(booking.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        {(booking.ambulanceType || 'Normal').toUpperCase()} Ambulance
                      </h3>
                      <div className="space-y-2 mt-3">
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin className="w-4 h-4 text-green-600" />
                          <span>Pickup: {booking.pickupAddress || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin className="w-4 h-4 text-red-600" />
                          <span>Drop: {booking.dropAddress || 'Unknown'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">₹{booking.amount || booking.fare}</p>
                      <p className="text-sm text-gray-500">{booking.distance || booking.distanceKm} km</p>
                      <button
                        onClick={() => handleAcceptBooking(booking._id)}
                        className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                      >
                        Accept Ride
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* MY ACTIVE RIDES */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            {myBookings.filter(b => ['accepted', 'on_the_way', 'picked'].includes(b.status)).length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">
                <p>No active rides.</p>
              </div>
            ) : (
              myBookings.filter(b => ['accepted', 'on_the_way', 'picked'].includes(b.status)).map(booking => (
                <div key={booking._id} className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                        {booking.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <h3 className="text-lg font-bold mt-2">Current Ride</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">₹{booking.amount || booking.fare}</p>
                    </div>
                  </div>

                  {/* Map View for Driver */}
                  <div className="mb-6">
                    <MapView 
                      pickup={booking.pickupLocation ? {
                        lat: booking.pickupLocation.coordinates[1],
                        lng: booking.pickupLocation.coordinates[0],
                        address: booking.pickupAddress
                      } : null}
                      drop={booking.dropLocation ? {
                        lat: booking.dropLocation.coordinates[1],
                        lng: booking.dropLocation.coordinates[0],
                        address: booking.dropAddress
                      } : null}
                      driverLocation={currentLocation}
                      etaTarget={['accepted', 'on_the_way'].includes(booking.status) ? 'pickup' : 'drop'}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Pickup</p>
                      <p className="font-medium">{booking.pickupAddress || 'Unknown'}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Drop</p>
                      <p className="font-medium">{booking.dropAddress || 'Unknown'}</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {booking.status === 'accepted' && (
                      <button
                        onClick={() => handleUpdateStatus(booking._id, 'on_the_way')}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                      >
                        Start Ride (On the way)
                      </button>
                    )}
                    {booking.status === 'on_the_way' && (
                      <button
                        onClick={() => handleUpdateStatus(booking._id, 'picked')}
                        className="flex-1 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700"
                      >
                        Patient Picked Up
                      </button>
                    )}
                    {booking.status === 'picked' && (
                      <button
                        onClick={() => handleUpdateStatus(booking._id, 'dropped')}
                        className="flex-1 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
                      >
                        Complete Ride (Dropped)
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* HISTORY */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100">
              {myBookings.filter(b => ['dropped', 'cancelled'].includes(b.status)).map(booking => (
                <div key={booking._id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {new Date(booking.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        {booking.pickupAddress || 'Unknown'} → {booking.dropAddress || 'Unknown'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">₹{booking.amount || booking.fare}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        booking.status === 'dropped' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {booking.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {myBookings.filter(b => ['dropped', 'cancelled'].includes(b.status)).length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <p>No ride history yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Date Filter */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Filter by:</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDateFilter('week')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      dateFilter === 'week' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    This Week
                  </button>
                  <button
                    onClick={() => setDateFilter('month')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      dateFilter === 'month' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    This Month
                  </button>
                  <button
                    onClick={() => setDateFilter('custom')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      dateFilter === 'custom' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Custom Range
                  </button>
                </div>
                {dateFilter === 'custom' && (
                  <div className="flex gap-2 items-center">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                )}
                <button
                  onClick={exportToExcel}
                  className="ml-auto flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Export to Excel
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Total Rides</span>
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">{analyticsData.totalRides}</p>
                <p className="text-xs text-gray-500 mt-1">Completed successfully</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Total Earnings</span>
                  <span className="text-2xl text-green-600">₹</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">₹{analyticsData.totalEarnings.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">After commission</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Average Rating</span>
                  <span className="text-yellow-500">⭐</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{analyticsData.averageRating.toFixed(1)}</p>
                <p className="text-xs text-gray-500 mt-1">Based on {analyticsData.totalRides} rides</p>
              </div>
            </div>

            {/* Trip History Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Trip History</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Distance</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fare</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Earnings</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {analyticsData.completedRides.map((ride) => (
                      <tr key={ride._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(ride.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div className="max-w-xs truncate">{ride.pickupAddress}</div>
                          <div className="max-w-xs truncate text-gray-400">→ {ride.dropAddress}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {ride.distance || ride.distanceKm} km
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ₹{ride.amount || ride.fare}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                          ₹{ride.driverEarnings || (ride.amount || ride.fare)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            ride.status === 'dropped' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {ride.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {analyticsData.completedRides.length === 0 && (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                          No completed rides in this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* EARNINGS TAB */}
        {activeTab === 'earnings' && (
          <div className="space-y-6">
            {/* Date Filter */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Period:</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDateFilter('week')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      dateFilter === 'week' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    This Week
                  </button>
                  <button
                    onClick={() => setDateFilter('month')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      dateFilter === 'month' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    This Month
                  </button>
                </div>
              </div>
            </div>

            {/* Earnings Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-sm p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm opacity-90">Total Earnings</span>
                  <span className="text-3xl font-bold">₹</span>
                </div>
                <p className="text-3xl font-bold">₹{analyticsData.totalEarnings.toFixed(2)}</p>
                <p className="text-xs opacity-75 mt-2">Net after commission</p>
              </div>
              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-sm p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm opacity-90">Pending Payouts</span>
                  <Clock className="w-6 h-6" />
                </div>
                <p className="text-3xl font-bold">₹{analyticsData.pendingPayouts.toFixed(2)}</p>
                <p className="text-xs opacity-75 mt-2">{analyticsData.pendingRideCount} rides waiting</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm opacity-90">Avg per Ride</span>
                  <TrendingUp className="w-6 h-6" />
                </div>
                <p className="text-3xl font-bold">
                  ₹{analyticsData.totalRides > 0 ? (analyticsData.totalEarnings / analyticsData.totalRides).toFixed(2) : '0.00'}
                </p>
                <p className="text-xs opacity-75 mt-2">Average earning</p>
              </div>
            </div>

            {/* Pending Rides for Next Payout - Day by Day */}
            {analyticsData.pendingPayoutsByDay && analyticsData.pendingPayoutsByDay.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b bg-yellow-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Pending Payouts (Day by Day)</h2>
                      <p className="text-sm text-gray-600">These rides will be paid out in the next daily payout (11:59 PM)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-yellow-600">₹{analyticsData.pendingPayouts.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{analyticsData.pendingRideCount} rides</p>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {analyticsData.pendingPayoutsByDay.map((dayData, dayIndex) => (
                    <div key={dayIndex} className="p-4 hover:bg-gray-50">
                      {/* Day Header */}
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                        <div>
                          <h3 className="text-md font-semibold text-gray-800">{dayData.date}</h3>
                          <p className="text-xs text-gray-500">{dayData.rideCount} ride{dayData.rideCount > 1 ? 's' : ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">₹{dayData.totalAmount.toFixed(2)}</p>
                        </div>
                      </div>
                      
                      {/* Rides List for this day */}
                      <div className="space-y-2">
                        {dayData.rides.map((booking, rideIndex) => (
                          <div key={rideIndex} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <p className="text-xs font-medium text-gray-700 mb-1">{booking.bookingId}</p>
                              <div className="text-xs text-gray-600">
                                <div className="flex items-start">
                                  <span className="text-green-600 mr-1">📍</span>
                                  <span className="truncate">{booking.pickupAddress}</span>
                                </div>
                                <div className="flex items-start ml-4">
                                  <span className="text-red-600 mr-1">📍</span>
                                  <span className="truncate">{booking.dropAddress}</span>
                                </div>
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(booking.completedAt).toLocaleTimeString()}
                              </p>
                            </div>
                            <div className="ml-4 text-right">
                              <p className="text-sm font-bold text-green-600">₹{booking.amount.toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Earnings Breakdown Chart */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Earnings Breakdown</h2>
              {analyticsData.earningsBreakdown && analyticsData.earningsBreakdown.length > 0 ? (
                <div className="space-y-4">
                  {analyticsData.earningsBreakdown.map((item, index) => (
                    <div key={index}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{item.date}</span>
                        <span className="font-bold text-gray-900">₹{item.earnings.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${(item.earnings / Math.max(...analyticsData.earningsBreakdown.map(e => e.earnings))) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No earnings data for this period</p>
              )}
            </div>

            {/* Payout History */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Payout History</h2>
                <p className="text-sm text-gray-500 mt-1">Daily payouts are processed automatically at 11:59 PM</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payout ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rides</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {analyticsData.payoutHistory && analyticsData.payoutHistory.map((payout) => (
                      <tr key={payout._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {payout.payoutId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(payout.payoutDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {payout.rideCount} rides
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          ₹{payout.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            payout.status === 'completed' ? 'bg-green-100 text-green-800' : 
                            payout.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                            payout.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!analyticsData.payoutHistory || analyticsData.payoutHistory.length === 0) && (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                          No payout history yet. Complete rides to start earning!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* FEEDBACK TAB */}
        {activeTab === 'feedback' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Ratings & Feedback</h2>
              <div className="space-y-4">
                {feedbackList.length > 0 ? (
                  feedbackList.map((feedback) => (
                    <div key={feedback._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">{feedback.patientName || 'Anonymous Patient'}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(feedback.createdAt).toLocaleDateString()} at {new Date(feedback.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < (feedback.rating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'
                              }`}
                            />
                          ))}
                          <span className="ml-1 text-sm font-bold text-gray-900">{feedback.rating || 0}</span>
                        </div>
                      </div>
                      
                      {feedback.bookingDetails && (
                        <div className="text-xs text-gray-500 mb-2">
                          <span className="font-medium">Trip:</span> {feedback.bookingDetails.pickupAddress} → {feedback.bookingDetails.dropAddress}
                        </div>
                      )}
                      
                      {feedback.comment && (
                        <p className="text-gray-700 mb-3 bg-gray-50 p-3 rounded-lg italic">
                          "{feedback.comment}"
                        </p>
                      )}
                      
                      {feedback.reply ? (
                        <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500">
                          <p className="text-sm font-medium text-blue-900 mb-1">Your Reply:</p>
                          <p className="text-sm text-blue-800">{feedback.reply}</p>
                        </div>
                      ) : (
                        <div>
                          {selectedFeedback === feedback._id ? (
                            <div className="space-y-2">
                              <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Write your reply..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                rows="3"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleReplyToFeedback(feedback._id)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                >
                                  Send Reply
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedFeedback(null);
                                    setReplyText('');
                                  }}
                                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setSelectedFeedback(feedback._id)}
                              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                            >
                              <MessageSquare className="w-4 h-4" />
                              Reply to feedback
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Star className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No feedback received yet</p>
                    <p className="text-sm mt-1">Complete more rides to receive ratings and feedback</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SOS Modal */}
        {showSOSModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000] p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 relative shadow-2xl">
              <button 
                onClick={() => setShowSOSModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-100 p-3 rounded-full">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Emergency SOS</h3>
                  <p className="text-sm text-gray-500">Alert admin or call emergency services</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Describe your emergency (optional)
                  </label>
                  <textarea
                    value={sosMessage}
                    onChange={(e) => setSosMessage(e.target.value)}
                    placeholder="E.g., Vehicle breakdown, medical emergency, safety concern..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    rows="4"
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleSOS}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                  >
                    <AlertCircle className="w-5 h-5" />
                    Send SOS Alert to Admin
                  </button>
                  
                  <button
                    onClick={callEmergency}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                  >
                    <Phone className="w-5 h-5" />
                    Call Emergency (108)
                  </button>
                  
                  <button
                    onClick={() => setShowSOSModal(false)}
                    className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs text-yellow-800">
                    <strong>Note:</strong> Use SOS only for genuine emergencies. Misuse may result in account suspension.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Profile Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000] p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 relative shadow-2xl">
              <button 
                onClick={() => setShowProfileModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
              
              <h3 className="text-xl font-bold mb-4 text-gray-900">Edit Profile</h3>
              
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({...profileForm, address: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows="3"
                  ></textarea>
                </div>
                
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Change Password</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Old Password</label>
                      <input
                        type="password"
                        value={profileForm.oldPassword}
                        onChange={(e) => setProfileForm({...profileForm, oldPassword: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter current password"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
                      <input
                        type="password"
                        value={profileForm.newPassword}
                        onChange={(e) => setProfileForm({...profileForm, newPassword: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter new password"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Min 6 chars, 1 uppercase, 1 digit, 1 special char
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        value={profileForm.confirmPassword}
                        onChange={(e) => setProfileForm({...profileForm, confirmPassword: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Confirm new password"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                >
                  Update Profile
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
