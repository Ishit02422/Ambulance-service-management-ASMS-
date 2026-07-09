import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';
import { calculateDistance } from '../utils/helpers';
import { MapView } from '../components/MapView';
import { Ambulance, MapPin, Clock, IndianRupee, Phone, User, LogOut, History, Bell, Check, X, QrCode, Navigation, Calendar, Filter, Star, Repeat } from 'lucide-react';

export const PatientDashboard = () => {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const [activeTab, setActiveTab] = useState('book');
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  
  // History State
  const [historyBookings, setHistoryBookings] = useState([]);
  const [historyFilters, setHistoryFilters] = useState({
    startDate: '',
    endDate: '',
    search: ''
  });

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [driverLocation, setDriverLocation] = useState(null);
  const [activeRide, setActiveRide] = useState(null);
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false);
  const [pendingBookingData, setPendingBookingData] = useState(null);

  // Feedback Modal State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackBooking, setFeedbackBooking] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');

  // Cancel Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelBooking, setCancelBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const cancellationReasons = [
    'Driver taking too long',
    'Found alternative transport',
    'Emergency resolved',
    'Wrong booking details',
    'Driver not responding',
    'Price too high',
    'Other'
  ];

  const [hospitals, setHospitals] = useState([]);
  const [showHospitalSuggestions, setShowHospitalSuggestions] = useState(false);
  const [fareSettings, setFareSettings] = useState(null);

  // Load fare settings from backend
  useEffect(() => {
    const loadFareSettings = async () => {
      try {
        const settings = await api.getSettings();
        setFareSettings(settings);
      } catch (error) {
        console.error('Error loading fare settings:', error);
      }
    };
    loadFareSettings();
  }, []);

  useEffect(() => {
    // Check for active ride
    const currentRide = bookings.find(b => ['accepted', 'on_the_way', 'picked'].includes(b.status));
    setActiveRide(currentRide || null);

    // If there is an active ride, we wait for socket updates
    if (!currentRide) {
      setDriverLocation(null);
    }
  }, [bookings]);

  // Listen for driver location updates
  useEffect(() => {
    if (!socket || !activeRide) return;

    const handleDriverLocation = (data) => {
      // data contains: { driverId, bookingId, location, accuracy, speed, heading, timestamp }
      console.log('📍 Received driver location:', {
        lat: data.location.latitude?.toFixed(6) || data.location.lat?.toFixed(6),
        lng: data.location.longitude?.toFixed(6) || data.location.lng?.toFixed(6),
        accuracy: data.accuracy ? `${data.accuracy.toFixed(0)}m` : 'N/A',
        speed: data.speed ? `${data.speed.toFixed(1)} km/h` : '0 km/h',
        timestamp: data.timestamp
      });

      // Update driver location on map (normalize coordinates)
      setDriverLocation({
        lat: data.location.latitude || data.location.lat,
        lng: data.location.longitude || data.location.lng,
        accuracy: data.accuracy,
        speed: data.speed,
        heading: data.heading,
        timestamp: data.timestamp
      });
    };

    socket.on('driver_location', handleDriverLocation);

    return () => {
      socket.off('driver_location', handleDriverLocation);
    };
  }, [socket, activeRide]);

  const [bookingForm, setBookingForm] = useState({
    pickupLat: 21.1702,
    pickupLng: 72.8311,
    pickupAddress: 'Surat, Gujarat',
    dropLat: 21.2035,
    dropLng: 72.8500,
    dropAddress: 'Civil Hospital, Surat',
    ambulanceType: 'normal'
  });

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setBookingForm(prev => ({
            ...prev,
            pickupLat: position.coords.latitude,
            pickupLng: position.coords.longitude,
            pickupAddress: `Current Location (${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)})`
          }));
        },
        (error) => {
          console.error("Error getting location", error);
          alert("Could not get your location. Please enable location services.");
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  // Mock geocoding to simulate distance changes
  const simulateGeocoding = (field) => {
    // Add small random variation to coordinates to simulate different locations
    const variation = (Math.random() - 0.5) * 0.01;
    if (field === 'pickup') {
      setBookingForm(prev => ({
        ...prev,
        pickupLat: 21.1702 + variation,
        pickupLng: 72.8311 + variation
      }));
    } else {
      setBookingForm(prev => ({
        ...prev,
        dropLat: 21.2035 + variation,
        dropLng: 72.8500 + variation
      }));
    }
  };

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    address: user?.address || '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    if (showProfileModal) {
      const fetchProfile = async () => {
        try {
          const data = await api.getProfile();
          setProfileForm(prev => ({
            ...prev,
            name: data.name || '',
            email: data.email || '',
            phone: data.phone || '',
            address: data.address || '',
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
    if (profileForm.name.trim().length < 3) {
      alert("Name must be at least 3 characters long.");
      return;
    }
    if (!/^\d{10}$/.test(profileForm.phone)) {
      alert("Phone number must be exactly 10 digits.");
      return;
    }
    if (profileForm.address && profileForm.address.trim().length < 10) {
      alert("Address must be at least 10 characters long.");
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
      const updatedUser = await api.updateProfile(profileForm);
      alert('Profile updated successfully!');
      setShowProfileModal(false);
      // Ideally update user context here, but for now page refresh or re-login might be needed to see changes in header
    } catch (error) {
      console.error('Update failed:', error);
      alert(error.message);
    }
  };

  const ambulanceTypes = [
    { 
      value: 'normal', 
      label: 'Normal Ambulance', 
      icon: '🚑', 
      baseFare: fareSettings?.fareRates?.normal?.base || 200, 
      perKm: fareSettings?.fareRates?.normal?.perKm || 15 
    },
    { 
      value: 'icu', 
      label: 'ICU Ambulance', 
      icon: '🏥', 
      baseFare: fareSettings?.fareRates?.icu?.base || 500, 
      perKm: fareSettings?.fareRates?.icu?.perKm || 30 
    },
    { 
      value: 'cardiac', 
      label: 'Cardiac Ambulance', 
      icon: '❤️', 
      baseFare: fareSettings?.fareRates?.cardiac?.base || 600, 
      perKm: fareSettings?.fareRates?.cardiac?.perKm || 35 
    },
    { 
      value: 'dead_body_van', 
      label: 'Dead Body Van', 
      icon: '⚰️', 
      baseFare: fareSettings?.fareRates?.dead_body_van?.base || 300, 
      perKm: fareSettings?.fareRates?.dead_body_van?.perKm || 20 
    }
  ];

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistoryBookings();
    }
  }, [activeTab, historyFilters]);

  useEffect(() => {
    if (!socket) return;

    // Join patient room for receiving block notifications
    if (user?._id) {
      socket.emit('join_patient_room', user._id);
    }

    // Listen for block notifications
    socket.on('user_blocked', (data) => {
      alert(`⚠️ Account Blocked\n\n${data.message}\n\nYou will be logged out now.`);
      logout();
    });

    socket.on('booking_accepted', (updatedBooking) => {
      setBookings(prev => prev.map(b => b._id === updatedBooking._id ? updatedBooking : b));
      
      const driverName = updatedBooking.driverId?.name || 'Unknown Driver';
      const vehicleNumber = updatedBooking.driverId?.vehicleNumber || 'Unknown Vehicle';
      
      setNotifications(prev => [{
        id: Date.now(),
        title: 'Driver Assigned',
        message: `${driverName} (${vehicleNumber}) has accepted your ride.`,
        isRead: false,
        createdAt: new Date().toISOString()
      }, ...prev]);
      alert(`Driver ${driverName} (${vehicleNumber}) accepted your ride!`);
    });

    socket.on('booking_updated', (updatedBooking) => {
      setBookings(prev => prev.map(b => b._id === updatedBooking._id ? updatedBooking : b));

      if (updatedBooking.status === 'dropped') {
        setFeedbackBooking(updatedBooking);
        setShowFeedbackModal(true);
        alert('Ride completed! Please rate your driver.');
      }
    });

    return () => {
      socket.off('user_blocked');
      socket.off('booking_accepted');
      socket.off('booking_updated');
    };
  }, [socket, user, logout]);

  const loadBookings = async () => {
    try {
      const data = await api.getUserBookings();
      setBookings(data);
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  };

  const loadHistoryBookings = async () => {
    try {
      const data = await api.getUserBookings();
      // Filter completed/cancelled rides
      const completed = data.filter(b => ['dropped', 'cancelled'].includes(b.status));
      
      // Apply date filters
      let filtered = completed;
      if (historyFilters.startDate) {
        filtered = filtered.filter(b => new Date(b.createdAt) >= new Date(historyFilters.startDate));
      }
      if (historyFilters.endDate) {
        const endDate = new Date(historyFilters.endDate);
        endDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(b => new Date(b.createdAt) <= endDate);
      }
      if (historyFilters.search) {
        const searchLower = historyFilters.search.toLowerCase();
        filtered = filtered.filter(b => 
          b.pickupAddress?.toLowerCase().includes(searchLower) ||
          b.dropAddress?.toLowerCase().includes(searchLower) ||
          b.driverId?.name?.toLowerCase().includes(searchLower) ||
          b.driverId?.vehicleNumber?.toLowerCase().includes(searchLower)
        );
      }
      
      setHistoryBookings(filtered);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const rebookRide = (booking) => {
    setBookingForm({
      pickupLat: booking.pickupLocation?.coordinates?.[1] || 21.1702,
      pickupLng: booking.pickupLocation?.coordinates?.[0] || 72.8311,
      pickupAddress: booking.pickupAddress || 'Surat, Gujarat',
      dropLat: booking.dropLocation?.coordinates?.[1] || 21.2035,
      dropLng: booking.dropLocation?.coordinates?.[0] || 72.8500,
      dropAddress: booking.dropAddress || 'Civil Hospital, Surat',
      ambulanceType: booking.ambulanceType || 'normal'
    });
    setActiveTab('book');
  };

  const openCancelModal = (booking) => {
    setCancelBooking(booking);
    setCancelReason('');
    setCustomReason('');
    setShowCancelModal(true);
  };

  const handleCancelRide = async (e) => {
    e.preventDefault();
    
    const finalReason = cancelReason === 'Other' ? customReason : cancelReason;
    
    if (!finalReason.trim()) {
      alert('Please provide a cancellation reason');
      return;
    }

    try {
      const response = await api.cancelBooking(cancelBooking._id, finalReason);
      alert(`Booking cancelled successfully.\n\nRefund: ₹${response.refundAmount} (${response.refundPercent}%)\nRefund will be processed within 5-7 business days.`);
      setShowCancelModal(false);
      loadBookings();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert(error.message || 'Failed to cancel booking');
    }
  };

  const calculateFare = () => {
    const distance = calculateDistance(
      bookingForm.pickupLat,
      bookingForm.pickupLng,
      bookingForm.dropLat,
      bookingForm.dropLng
    );
    const type = ambulanceTypes.find(t => t.value === bookingForm.ambulanceType);
    const fare = type.baseFare + (distance * type.perKm);
    return { distance: distance, fare: Math.round(fare) };
  };

  const [estimatedFare, setEstimatedFare] = useState(null);

  useEffect(() => {
    if (!fareSettings) return; // Wait for settings to load
    const { distance, fare } = calculateFare();
    setEstimatedFare({ distance: distance.toFixed(2), fare: Math.round(fare) });
  }, [bookingForm.pickupLat, bookingForm.pickupLng, bookingForm.dropLat, bookingForm.dropLng, bookingForm.ambulanceType, fareSettings]);

  const openPaymentModal = (booking) => {
    setSelectedBooking(booking);
    setPaymentMethod('cash');
    setShowPaymentModal(true);
  };

  const processPayment = async () => {
    if (!selectedBooking) return;
    try {
      await api.makePayment(selectedBooking._id, paymentMethod);
      alert('Payment successful!');
      setShowPaymentModal(false);
      setSelectedBooking(null);
      loadBookings();
    } catch (error) {
      console.error('Payment failed:', error);
      alert('Payment failed');
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    const { distance, fare } = calculateFare();

    const bookingData = {
      ambulanceType: bookingForm.ambulanceType,
      pickupLocation: {
        lat: bookingForm.pickupLat,
        lng: bookingForm.pickupLng,
        address: bookingForm.pickupAddress
      },
      dropLocation: {
        lat: bookingForm.dropLat,
        lng: bookingForm.dropLng,
        address: bookingForm.dropAddress
      },
      distanceKm: parseFloat(distance.toFixed(2)),
      fare: fare
    };

    // Store booking data and show payment modal
    setPendingBookingData(bookingData);
    setPaymentMethod('cash');
    setShowPaymentConfirmModal(true);
  };

  const confirmPaymentAndBook = async () => {
    if (!pendingBookingData) return;

    try {
      if (paymentMethod === 'cash') {
        // For cash payment, create booking with pending status
        const booking = await api.createBooking({
          ...pendingBookingData,
          paymentMethod: 'cash',
          paymentStatus: 'pending'
        });
        
        alert(`Booking confirmed!\nBooking ID: ${booking.bookingId || booking._id}\n\nPayment: Cash on Drop (₹${pendingBookingData.fare})\nPlease keep cash ready at destination.`);
        setShowPaymentConfirmModal(false);
        setPendingBookingData(null);
        loadBookings();
        setActiveTab('history');
      } else {
        // For online payment, first create booking then initiate Razorpay
        const booking = await api.createBooking({
          ...pendingBookingData,
          paymentMethod: 'online',
          paymentStatus: 'pending'
        });

        // Create Razorpay order
        const orderData = await api.createRazorpayOrder(pendingBookingData.fare, booking._id);
        
        // Initialize Razorpay checkout
        const options = {
          key: orderData.key,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'Ambulance Service',
          description: `Booking ${booking.bookingId || booking._id}`,
          order_id: orderData.orderId,
          handler: async function (response) {
            try {
              // Verify payment
              const verifyData = {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                bookingId: booking._id
              };
              
              await api.verifyRazorpayPayment(verifyData);
              
              alert(`Payment successful! ₹${pendingBookingData.fare}\n\nBooking confirmed!\nBooking ID: ${booking.bookingId || booking._id}\nPayment ID: ${response.razorpay_payment_id}`);
              setShowPaymentConfirmModal(false);
              setPendingBookingData(null);
              loadBookings();
              setActiveTab('history');
            } catch (error) {
              console.error('Payment verification failed:', error);
              alert('Payment verification failed. Please contact support.');
            }
          },
          prefill: {
            name: user?.name || '',
            email: user?.email || '',
            contact: user?.phone || ''
          },
          theme: {
            color: '#dc2626'
          },
          modal: {
            ondismiss: function() {
              alert('Payment cancelled. Booking will remain unpaid.');
              setShowPaymentConfirmModal(false);
              setPendingBookingData(null);
              loadBookings();
            }
          }
        };
        
        const razorpay = new window.Razorpay(options);
        razorpay.open();
      }
    } catch (error) {
      console.error('Booking failed:', error);
      alert('Booking failed: ' + error.message);
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.submitFeedback(feedbackBooking._id, {
        rating: feedbackRating,
        comment: feedbackComment
      });
      setShowFeedbackModal(false);
      setFeedbackRating(0);
      setFeedbackComment('');
      setFeedbackBooking(null);
      alert('Feedback submitted successfully');
      loadBookings();
      loadHistoryBookings();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback');
    }
  };

  useEffect(() => {
    // Fetch nearest hospitals when pickup location changes
    const fetchHospitals = async () => {
      try {
        const data = await api.getNearestHospitals(bookingForm.pickupLat, bookingForm.pickupLng);
        setHospitals(data);
      } catch (error) {
        console.error('Error fetching hospitals:', error);
      }
    };
    fetchHospitals();
  }, [bookingForm.pickupLat, bookingForm.pickupLng]);

  const handleHospitalSelect = (hospital) => {
    setBookingForm(prev => ({
      ...prev,
      dropAddress: hospital.name,
      dropLat: hospital.location.coordinates[1],
      dropLng: hospital.location.coordinates[0]
    }));
    setShowHospitalSuggestions(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-[1001]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="bg-red-100 p-2 rounded-lg">
                <span className="text-2xl">🚑</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Ambulance Service</span>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-gray-700 font-medium hidden md:block">Welcome, {user?.name}</span>
              <button 
                onClick={() => setActiveTab('book')}
                className={`px-4 py-2 rounded-full font-medium transition-colors ${
                  activeTab === 'book' ? 'bg-red-100 text-red-600' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Book Now
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 rounded-full font-medium transition-colors ${
                  activeTab === 'history' ? 'bg-red-100 text-red-600' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                History
              </button>
              <button onClick={logout} className="p-2 text-gray-500 hover:text-red-600 transition-colors">
                <LogOut className="w-6 h-6" />
              </button>
              <button 
                onClick={() => setShowProfileModal(true)}
                className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                title="Edit Profile"
              >
                <User className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Active Ride View - Shows when a ride is in progress */}
        {activeRide && (
          <div className="mb-8 bg-white rounded-xl shadow-lg overflow-hidden border border-blue-100">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="animate-pulse w-3 h-3 bg-white rounded-full"></div>
                <h2 className="font-bold text-lg">Live Ride Status</h2>
              </div>
              <span className="bg-blue-500 px-3 py-1 rounded-full text-sm font-medium border border-blue-400">
                {activeRide.status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3">
              <div className="lg:col-span-2 border-r border-gray-100">
                <MapView 
                  pickup={activeRide.pickupLocation ? {
                    lat: activeRide.pickupLocation.coordinates[1],
                    lng: activeRide.pickupLocation.coordinates[0],
                    address: activeRide.pickupAddress
                  } : null}
                  drop={activeRide.dropLocation ? {
                    lat: activeRide.dropLocation.coordinates[1],
                    lng: activeRide.dropLocation.coordinates[0],
                    address: activeRide.dropAddress
                  } : null}
                  driverLocation={driverLocation}
                />
              </div>
              
              <div className="p-6 bg-gray-50">
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Driver Details</h3>
                  <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{activeRide.driverId?.name || 'Driver Assigned'}</p>
                      <p className="text-sm text-gray-500">{activeRide.driverId?.vehicleNumber}</p>
                      <div className="flex items-center gap-1 text-yellow-500 text-sm mt-1">
                        <span>⭐</span>
                        <span>{activeRide.driverId?.rating || '5.0'}</span>
                      </div>
                    </div>
                    <a href={`tel:${activeRide.driverId?.phone}`} className="ml-auto p-3 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors">
                      <Phone className="w-5 h-5" />
                    </a>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Trip Progress</h3>
                    <div className="relative pl-4 border-l-2 border-gray-200 space-y-6">
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm"></div>
                        <p className="text-sm font-medium text-gray-900">Pickup</p>
                        <p className="text-xs text-gray-500">{activeRide.pickupAddress}</p>
                      </div>
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-sm"></div>
                        <p className="text-sm font-medium text-gray-900">Drop</p>
                        <p className="text-xs text-gray-500">{activeRide.dropAddress}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-gray-600">Total Fare</span>
                      <span className="text-2xl font-bold text-gray-900">₹{activeRide.amount || activeRide.fare}</span>
                    </div>
                    
                    {activeRide.paymentStatus !== 'paid' && (
                      <button
                        onClick={() => openPaymentModal(activeRide)}
                        className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors shadow-lg shadow-green-200 flex items-center justify-center gap-2"
                      >
                        <IndianRupee className="w-5 h-5" />
                        Pay Now
                      </button>
                    )}
                    
                    {activeRide.paymentStatus === 'paid' && (
                      <div className="w-full py-3 bg-green-50 text-green-700 rounded-xl font-semibold flex items-center justify-center gap-2 border border-green-200">
                        <Check className="w-5 h-5" />
                        Payment Completed
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'book' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Booking Form */}
            <div className="lg:col-span-1 bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-red-600" />
                Book Ambulance
              </h2>
              
              <form onSubmit={handleBookingSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={bookingForm.pickupAddress}
                      onChange={(e) => setBookingForm({...bookingForm, pickupAddress: e.target.value})}
                      onBlur={() => simulateGeocoding('pickup')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      required
                    />
                    <button
                      type="button"
                      onClick={getCurrentLocation}
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                      title="Use Current Location"
                    >
                      <Navigation className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Drop Location</label>
                  <input
                    type="text"
                    value={bookingForm.dropAddress}
                    onChange={(e) => {
                      setBookingForm({...bookingForm, dropAddress: e.target.value});
                      setShowHospitalSuggestions(true);
                    }}
                    onFocus={() => setShowHospitalSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowHospitalSuggestions(false), 200)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Search for a hospital or enter address"
                    required
                  />
                  {showHospitalSuggestions && hospitals.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      <div className="p-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                        Nearest Hospitals ({hospitals.length})
                      </div>
                      {(() => {
                        const filteredHospitals = hospitals.filter(hospital => 
                          !bookingForm.dropAddress || 
                          bookingForm.dropAddress.trim() === '' ||
                          hospital.name.toLowerCase().includes(bookingForm.dropAddress.toLowerCase()) ||
                          hospital.address?.toLowerCase().includes(bookingForm.dropAddress.toLowerCase()) ||
                          hospital.specialties?.some(spec => spec.toLowerCase().includes(bookingForm.dropAddress.toLowerCase()))
                        );
                        
                        if (filteredHospitals.length === 0) {
                          return (
                            <div className="p-3 text-center text-gray-500 text-sm">
                              No hospitals found matching "{bookingForm.dropAddress}"
                            </div>
                          );
                        }
                        
                        return filteredHospitals.map((hospital) => (
                          <div
                            key={hospital._id}
                            onClick={() => handleHospitalSelect(hospital)}
                            className="p-3 hover:bg-red-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                          >
                            <div className="font-medium text-gray-900">{hospital.name}</div>
                            <div className="text-xs text-gray-500 truncate">{hospital.address}</div>
                            <div className="flex gap-1 mt-1">
                              {hospital.specialties && hospital.specialties.slice(0, 2).map((spec, idx) => (
                                <span key={idx} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                                  {spec}
                                </span>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Ambulance Type</label>
                  <div className="grid grid-cols-1 gap-3">
                    {ambulanceTypes.map((type) => (
                      <div
                        key={type.value}
                        onClick={() => setBookingForm({...bookingForm, ambulanceType: type.value})}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          bookingForm.ambulanceType === type.value
                            ? 'border-red-500 bg-red-50 ring-1 ring-red-500'
                            : 'border-gray-200 hover:border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{type.icon}</span>
                            <div>
                              <p className="font-medium text-gray-900">{type.label}</p>
                              <p className="text-xs text-gray-500">Base: ₹{type.baseFare} + ₹{type.perKm}/km</p>
                            </div>
                          </div>
                          {bookingForm.ambulanceType === type.value && (
                            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {estimatedFare && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">Estimated Distance</span>
                      <span className="font-semibold">{estimatedFare.distance} km</span>
                    </div>
                    <div className="flex justify-between items-center text-lg font-bold text-gray-900">
                      <span>Total Fare</span>
                      <span>₹{estimatedFare.fare}</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                >
                  Confirm Booking
                </button>
              </form>
            </div>

            {/* Map View */}
            <div className="lg:col-span-2">
              <MapView 
                pickup={{
                  lat: bookingForm.pickupLat,
                  lng: bookingForm.pickupLng,
                  address: bookingForm.pickupAddress
                }}
                drop={{
                  lat: bookingForm.dropLat,
                  lng: bookingForm.dropLng,
                  address: bookingForm.dropAddress
                }}
                driverLocation={driverLocation}
              />
              
              <div className="mt-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-2">Location Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Pickup Coordinates</p>
                    <p className="font-mono text-gray-700">{bookingForm.pickupLat.toFixed(4)}, {bookingForm.pickupLng.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Drop Coordinates</p>
                    <p className="font-mono text-gray-700">{bookingForm.dropLat.toFixed(4)}, {bookingForm.dropLng.toFixed(4)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <History className="w-5 h-5 text-gray-500" />
                Booking History
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {bookings.map((booking) => (
                <div key={booking._id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="bg-red-100 p-3 rounded-lg">
                        <Ambulance className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">
                            {(booking.ambulanceType || 'normal').charAt(0).toUpperCase() + (booking.ambulanceType || 'normal').slice(1)} Ambulance
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            booking.status === 'completed' ? 'bg-green-100 text-green-700' :
                            booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            {booking.pickupAddress || 'Unknown'}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            {booking.dropAddress || 'Unknown'}
                          </div>
                        </div>
                        
                        {booking.driverId && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Driver Details</p>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-gray-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{booking.driverId.name}</p>
                                <p className="text-xs text-gray-500">{booking.driverId.vehicleNumber} • {booking.driverId.phone}</p>
                              </div>
                              <a href={`tel:${booking.driverId.phone}`} className="ml-auto p-2 bg-green-50 text-green-600 rounded-full hover:bg-green-100">
                                <Phone className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">₹{booking.amount || booking.fare}</p>
                      <p className="text-sm text-gray-500">{new Date(booking.createdAt).toLocaleDateString()}</p>
                      
                      {['accepted', 'in_progress', 'dropped'].includes(booking.status) && booking.paymentStatus !== 'paid' && (
                        <button
                          onClick={() => openPaymentModal(booking)}
                          className="mt-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 ml-auto"
                        >
                          <IndianRupee className="w-4 h-4" />
                          Pay Now
                        </button>
                      )}
                      
                      {booking.paymentStatus === 'paid' && (
                        <span className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                          <Check className="w-3 h-3" />
                          Paid
                        </span>
                      )}
                      
                      {['requested', 'pending', 'accepted', 'on_the_way'].includes(booking.status) && (
                        <button
                          onClick={() => openCancelModal(booking)}
                          className="mt-2 px-4 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2 ml-auto"
                        >
                          <X className="w-4 h-4" />
                          Cancel Ride
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {bookings.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No bookings found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            {/* History Filters */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-red-600" />
                Trip History
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={historyFilters.startDate}
                    onChange={(e) => setHistoryFilters({...historyFilters, startDate: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={historyFilters.endDate}
                    onChange={(e) => setHistoryFilters({...historyFilters, endDate: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                  <input
                    type="text"
                    value={historyFilters.search}
                    onChange={(e) => setHistoryFilters({...historyFilters, search: e.target.value})}
                    placeholder="Driver, location, vehicle..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              {historyFilters.startDate || historyFilters.endDate || historyFilters.search ? (
                <button
                  onClick={() => setHistoryFilters({ startDate: '', endDate: '', search: '' })}
                  className="mt-4 text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Clear Filters
                </button>
              ) : null}
            </div>

            {/* History List */}
            <div className="space-y-4">
              {historyBookings.map((booking) => (
                <div key={booking._id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          booking.status === 'dropped' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {booking.status === 'dropped' ? 'Completed' : 'Cancelled'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(booking.createdAt).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 capitalize">
                        {booking.ambulanceType?.replace(/_/g, ' ')} Ambulance
                      </h3>
                    </div>
                    <button
                      onClick={() => rebookRide(booking)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                      title="Book Again"
                    >
                      <Repeat className="w-4 h-4" />
                      Re-book
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">Pickup</p>
                          <p className="text-sm text-gray-900">{booking.pickupAddress}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">Drop</p>
                          <p className="text-sm text-gray-900">{booking.dropAddress}</p>
                        </div>
                      </div>
                    </div>

                    {booking.driverId && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-2">Driver Details</p>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-900">{booking.driverId.name}</p>
                          <p className="text-xs text-gray-600">{booking.driverId.vehicleNumber}</p>
                          <p className="text-xs text-gray-600">{booking.driverId.phone}</p>
                          {booking.driverId.averageRating > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              <span className="text-xs font-medium text-gray-700">
                                {booking.driverId.averageRating.toFixed(1)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-gray-700">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">{booking.distance || booking.distanceKm || 'N/A'} km</span>
                      </div>
                      <div className="flex items-center gap-1 text-green-700 font-semibold">
                        <IndianRupee className="w-4 h-4" />
                        <span className="text-lg">₹{booking.amount || booking.fare}</span>
                      </div>
                      {booking.paymentStatus === 'paid' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                          <Check className="w-3 h-3" />
                          Paid
                        </span>
                      )}
                    </div>

                    {booking.status === 'dropped' && booking.rating && (
                      <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1 rounded-full">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium text-gray-900">{booking.rating}/5</span>
                      </div>
                    )}

                    {booking.status === 'dropped' && !booking.rating && (
                      <button
                        onClick={() => {
                          setFeedbackBooking(booking);
                          setFeedbackRating(0);
                          setFeedbackComment('');
                          setShowFeedbackModal(true);
                        }}
                        className="flex items-center gap-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full transition-colors text-xs font-semibold"
                      >
                        <Star className="w-3.5 h-3.5 fill-yellow-600 text-yellow-600" />
                        Rate Driver
                      </button>
                    )}
                  </div>

                  {booking.comment && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">Your Feedback</p>
                      <p className="text-sm text-gray-700 italic">"{booking.comment}"</p>
                    </div>
                  )}
                </div>
              ))}

              {historyBookings.length === 0 && (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">
                  <History className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">No trip history found</p>
                  <p className="text-sm mt-1">Complete your first ride to see it here</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Payment Modal */}
      {showPaymentModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000] p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 relative shadow-2xl">
            <button 
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
            
            <h3 className="text-xl font-bold mb-4 text-gray-900">Payment Details</h3>
            
            <div className="mb-6 bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-600 mb-1 text-sm">Total Amount</p>
              <p className="text-3xl font-bold text-gray-900">₹{selectedBooking.amount || selectedBooking.fare}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Select Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition-all ${
                    paymentMethod === 'cash' 
                      ? 'border-green-500 bg-green-50 text-green-700 ring-2 ring-green-500' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <IndianRupee className="w-8 h-8" />
                  <span className="font-semibold">Cash</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('upi')}
                  className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition-all ${
                    paymentMethod === 'upi' 
                      ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <QrCode className="w-8 h-8" />
                  <span className="font-semibold">UPI / QR</span>
                </button>
              </div>
            </div>

            {paymentMethod === 'upi' && (
              <div className="mb-6 text-center bg-gray-50 p-6 rounded-xl border border-gray-200">
                <p className="text-sm font-medium text-gray-900 mb-4">Scan QR Code to Pay</p>
                <div className="bg-white p-3 inline-block rounded-xl shadow-sm border border-gray-100">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=ambulance@upi&pn=AmbulanceService&am=${selectedBooking.amount || selectedBooking.fare}&cu=INR`} 
                    alt="Payment QR Code" 
                    className="w-40 h-40"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-3 font-mono bg-gray-200 inline-block px-2 py-1 rounded">UPI ID: ambulance@upi</p>
              </div>
            )}

            <button
              onClick={processPayment}
              className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 ${
                paymentMethod === 'cash' 
                  ? 'bg-green-600 hover:bg-green-700 shadow-green-200' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
              }`}
            >
              {paymentMethod === 'cash' ? 'Confirm Cash Payment' : 'I Have Paid'}
            </button>
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

      {/* Payment Confirmation Modal (Before Booking) */}
      {showPaymentConfirmModal && pendingBookingData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Confirm Payment</h3>
              <button 
                onClick={() => {
                  setShowPaymentConfirmModal(false);
                  setPendingBookingData(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Booking Summary - Compact */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 mb-4 border border-blue-200">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-gray-600">Distance</p>
                  <p className="text-sm font-bold text-gray-900">{pendingBookingData.distanceKm} km</p>
                </div>
                <div className="border-l border-r border-blue-200">
                  <p className="text-xs text-gray-600">Type</p>
                  <p className="text-sm font-bold text-gray-900 capitalize">{pendingBookingData.ambulanceType.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Amount</p>
                  <p className="text-lg font-bold text-green-600">₹{pendingBookingData.fare}</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Payment Method *</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    paymentMethod === 'cash'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">💵</div>
                  <div className="text-sm font-semibold">Cash on Drop</div>
                  <div className="text-xs text-gray-500 mt-0.5">Pay at destination</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('online')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    paymentMethod === 'online'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">📱</div>
                  <div className="text-sm font-semibold">Pay Online</div>
                  <div className="text-xs text-gray-500 mt-0.5">Razorpay Gateway</div>
                </button>
              </div>
            </div>

            {/* Online Payment Info */}
            {paymentMethod === 'online' && (
              <div className="mb-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border-2 border-blue-200">
                <div className="text-center">
                  <div className="text-4xl mb-2">💳</div>
                  <h4 className="font-semibold text-gray-900 mb-2 text-sm">Secure Payment via Razorpay</h4>
                  <p className="text-xs text-gray-600 mb-2">
                    Pay with UPI, Cards, Net Banking, or Wallets
                  </p>
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                    <span>🔒 100% Secure</span>
                    <span>•</span>
                    <span>✓ Instant Payment</span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 mb-3">
              <p className="text-xs text-yellow-800">
                {paymentMethod === 'cash' 
                  ? '⚠️ You will pay cash at the drop location after ride completion.'
                  : '⚠️ Click below to open Razorpay payment gateway. Complete payment to confirm booking.'
                }
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPaymentConfirmModal(false);
                  setPendingBookingData(null);
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmPaymentAndBook}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                {paymentMethod === 'cash' ? 'Confirm Booking' : 'Pay Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Ride Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Cancel Ride</h3>
              <button 
                onClick={() => setShowCancelModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-red-900 mb-2">📋 Refund Policy</h4>
              <ul className="text-sm text-red-800 space-y-1">
                <li>• <strong>Before driver accepts:</strong> 100% refund</li>
                <li>• <strong>After acceptance:</strong> 50% refund</li>
                <li>• <strong>After driver arrives:</strong> No refund</li>
                <li>• Refund processed within 5-7 business days</li>
              </ul>
            </div>

            <form onSubmit={handleCancelRide} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cancellation Reason *</label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a reason</option>
                  {cancellationReasons.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>

              {cancelReason === 'Other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Please specify *</label>
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    rows="3"
                    placeholder="Enter your reason..."
                    required
                  ></textarea>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ Booking ID: <strong>{cancelBooking?._id.slice(-8)}</strong>
                </p>
                <p className="text-sm text-yellow-800 mt-1">
                  Amount: <strong>₹{cancelBooking?.amount || cancelBooking?.fare}</strong>
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Keep Ride
                </button>
                <button
                  type="submit"
                  disabled={!cancelReason || (cancelReason === 'Other' && !customReason.trim())}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Confirm Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Rate Your Driver</h3>
              <button 
                onClick={() => setShowFeedbackModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <User className="w-8 h-8 text-gray-600" />
              </div>
              <h4 className="font-semibold text-lg">{feedbackBooking?.driverId?.name || 'Driver'}</h4>
              <p className="text-gray-500 text-sm">How was your ride?</p>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackRating(star)}
                    className={`p-2 rounded-full transition-colors ${
                      feedbackRating >= star ? 'text-yellow-400' : 'text-gray-300'
                    }`}
                  >
                    <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comment (Optional)</label>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="3"
                  placeholder="Share your experience..."
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={feedbackRating === 0}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Submit Feedback
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
