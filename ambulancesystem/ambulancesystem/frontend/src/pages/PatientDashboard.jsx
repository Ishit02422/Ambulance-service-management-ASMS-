import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';
import { calculateDistance } from '../utils/helpers';
import { geocodeLocation, reverseGeocodeLocation, KNOWN_LOCATIONS, SURAT_HOSPITALS } from '../utils/geocoding';
import { MapView } from '../components/MapView';
import { Ambulance, MapPin, Clock, IndianRupee, Phone, User, LogOut, History, Bell, Check, X, QrCode, Navigation, Calendar, Filter, Star, Repeat, Building2, Search, HeartPulse } from 'lucide-react';

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

  // Hospitals & Location States (Loaded with full Surat Hospitals)
  const [hospitals, setHospitals] = useState(SURAT_HOSPITALS);
  const [showHospitalSuggestions, setShowHospitalSuggestions] = useState(false);
  const [selectedHospitalIndex, setSelectedHospitalIndex] = useState(-1);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [selectedPickupIndex, setSelectedPickupIndex] = useState(-1);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [dbSearchResults, setDbSearchResults] = useState([]);
  const [isSearchingDB, setIsSearchingDB] = useState(false);
  const searchTimerRef = useRef(null);
  const pickupTimerRef = useRef(null);

  // Clean up timers on component unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (pickupTimerRef.current) clearTimeout(pickupTimerRef.current);
    };
  }, []);

  const [fareSettings, setFareSettings] = useState(null);

  const [bookingForm, setBookingForm] = useState({
    pickupLat: 21.1950,
    pickupLng: 72.7950,
    pickupAddress: 'Adajan, Surat',
    dropLat: 21.1702,
    dropLng: 72.8311,
    dropAddress: 'New Civil Hospital, Majura Gate, Ring Road, Surat',
    ambulanceType: 'normal'
  });

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

  // Helper to format backend hospital data
  const formatBackendHospital = (h, i) => {
    const coords = h.location?.coordinates;
    return {
      id: h._id || `backend_${i}`,
      name: h.name,
      address: h.address || 'Surat',
      lat: coords ? coords[1] : (h.lat || 21.1702),
      lng: coords ? coords[0] : (h.lng || 72.8311),
      specialties: h.specialties || ['General', 'Emergency'],
      phone: h.phone || '',
      fromDB: true
    };
  };

  // Deduplicate hospitals by name
  const deduplicateHospitals = (list) => {
    const seen = new Set();
    const result = [];
    for (const item of list) {
      const key = item.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
    return result;
  };

  // Fetch ALL Hospitals from backend on mount and merge with local list
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const data = await api.getAllHospitals();
        if (data && data.length > 0) {
          const formattedBackend = data.map(formatBackendHospital);
          setHospitals(deduplicateHospitals([...formattedBackend, ...SURAT_HOSPITALS]));
        } else {
          setHospitals(SURAT_HOSPITALS);
        }
      } catch (err) {
        console.warn('Using built-in Surat hospitals list:', err);
        setHospitals(SURAT_HOSPITALS);
      }
    };
    fetchHospitals();
  }, []);

  // Live search from MongoDB database & OpenStreetMap (debounced) when user types in drop field
  const searchHospitalsFromDB = async (query) => {
    if (!query || query.trim().length < 2) {
      setDbSearchResults([]);
      setIsSearchingDB(false);
      return;
    }
    const cleanQuery = query.trim();
    setIsSearchingDB(true);
    try {
      let dbList = [];
      // 1. Search backend MongoDB database
      try {
        const data = await api.searchHospitals(cleanQuery);
        if (data && data.length > 0) {
          dbList = data.map(formatBackendHospital);
        }
      } catch (e) {
        console.warn('Backend hospital search error:', e);
      }

      // 2. OpenStreetMap live fallback for any unlisted hospital/clinic in Surat
      try {
        const searchQuery = cleanQuery.toLowerCase().includes('surat') ? cleanQuery : `${cleanQuery}, Surat`;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&countrycodes=in`
        );
        if (res.ok) {
          const osmData = await res.json();
          if (Array.isArray(osmData)) {
            const osmHospitals = osmData.map((item, idx) => ({
              id: `osm_${item.place_id || idx}`,
              name: item.name || (item.display_name ? item.display_name.split(',')[0] : cleanQuery),
              address: item.display_name || `${cleanQuery}, Surat`,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              specialties: ['Hospital / Healthcare'],
              fromDB: true
            }));
            dbList = deduplicateHospitals([...dbList, ...osmHospitals]);
          }
        }
      } catch (osmErr) {
        console.warn('OSM search error:', osmErr);
      }

      setDbSearchResults(dbList);
    } catch (err) {
      console.warn('DB hospital search error:', err);
      setDbSearchResults([]);
    } finally {
      setIsSearchingDB(false);
    }
  };

  // Debounced trigger for DB search (300ms delay)
  const triggerDBSearch = (query) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      searchHospitalsFromDB(query);
    }, 300);
  };

  // Real-time live address/location search for Pickup (Google Maps style)
  const searchPickupLocations = async (query) => {
    if (!query || query.trim().length < 2) {
      setPickupSuggestions([]);
      setIsSearchingPickup(false);
      return;
    }
    const clean = query.trim().toLowerCase();
    setIsSearchingPickup(true);

    try {
      let apiResults = [];

      // 1. Search Photon API (Fast OpenStreetMap Elasticsearch geocoder with typo tolerance)
      try {
        const photonQuery = clean.includes('surat') ? clean : `${clean} Surat`;
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(photonQuery)}&lat=21.1702&lon=72.8311&limit=6`
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.features && data.features.length > 0) {
            const list = data.features.map(f => {
              const p = f.properties;
              const title = p.name || query.trim();
              const sub = [p.street, p.district, p.city || 'Surat', p.state || 'Gujarat'].filter(Boolean).join(', ');
              return {
                name: title,
                address: sub || `${title}, Surat`,
                lat: f.geometry.coordinates[1],
                lng: f.geometry.coordinates[0],
                type: 'address'
              };
            });
            apiResults.push(...list);
          }
        }
      } catch (phErr) {
        console.warn('Photon pickup search error:', phErr);
      }

      // 2. Fallback query Nominatim
      if (apiResults.length < 3) {
        try {
          const searchQuery = clean.includes('surat') ? clean : `${clean}, Surat, Gujarat`;
          const osmRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&countrycodes=in&addressdetails=1`
          );
          if (osmRes.ok) {
            const osmData = await osmRes.json();
            if (Array.isArray(osmData) && osmData.length > 0) {
              const osmList = osmData.map(item => ({
                name: item.name || (item.display_name ? item.display_name.split(',')[0] : query.trim()),
                address: item.display_name,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                type: 'address'
              }));
              apiResults.push(...osmList);
            }
          }
        } catch (osmErr) {
          console.warn('OSM search error:', osmErr);
        }
      }

      setPickupSuggestions(apiResults);
    } catch (err) {
      console.warn('Pickup search error:', err);
      setPickupSuggestions([]);
    } finally {
      setIsSearchingPickup(false);
    }
  };

  const triggerPickupSearch = (query) => {
    if (pickupTimerRef.current) clearTimeout(pickupTimerRef.current);
    pickupTimerRef.current = setTimeout(() => {
      searchPickupLocations(query);
    }, 200);
  };

  const getFilteredPickupSuggestions = () => {
    const rawInput = bookingForm.pickupAddress || '';
    const raw = rawInput.trim().toLowerCase();
    if (!raw || raw.length < 2) {
      return KNOWN_LOCATIONS.slice(0, 8).map(l => ({
        name: l.name,
        address: `${l.name}, Surat, Gujarat`,
        lat: l.lat,
        lng: l.lng,
        type: 'area'
      }));
    }

    const queryWords = raw.split(/[\s,.-]+/).filter(w => w.length > 0);
    const instantMatches = [];

    // 1. Direct typed custom address with matched area coordinates in Surat
    const matchedArea = KNOWN_LOCATIONS.find(loc => {
      const lName = (loc.name || '').toLowerCase();
      return raw.includes(lName) || lName.includes(raw);
    });

    if (matchedArea) {
      instantMatches.push({
        name: rawInput.trim(),
        address: `${matchedArea.name}, Surat, Gujarat`,
        lat: matchedArea.lat,
        lng: matchedArea.lng,
        type: 'address'
      });
      if (raw !== matchedArea.name.toLowerCase()) {
        instantMatches.push({
          name: matchedArea.name,
          address: `${matchedArea.name}, Surat, Gujarat`,
          lat: matchedArea.lat,
          lng: matchedArea.lng,
          type: 'area'
        });
      }
    } else {
      // General Surat pin for custom typed address
      instantMatches.push({
        name: rawInput.trim(),
        address: `${rawInput.trim()}, Surat, Gujarat`,
        lat: 21.1950,
        lng: 72.7950,
        type: 'address'
      });
    }

    // 2. All areas in KNOWN_LOCATIONS matching any typed word
    const matchingAreas = KNOWN_LOCATIONS
      .filter(l => {
        const lName = (l.name || '').toLowerCase();
        return queryWords.some(w => w.length >= 2 && lName.includes(w)) &&
               !instantMatches.some(m => m.name.toLowerCase() === lName);
      })
      .map(l => ({
        name: l.name,
        address: `${l.name}, Surat, Gujarat`,
        lat: l.lat,
        lng: l.lng,
        type: 'area'
      }));
    instantMatches.push(...matchingAreas);

    // 3. Matching hospitals
    const matchingHospitals = hospitals
      .filter(h => {
        const hName = (h.name || '').toLowerCase();
        const hAddr = (h.address || '').toLowerCase();
        return queryWords.some(w => w.length >= 3 && (hName.includes(w) || hAddr.includes(w))) &&
               !instantMatches.some(m => m.name.toLowerCase() === hName);
      })
      .map(h => ({
        name: h.name,
        address: h.address || 'Surat, Gujarat',
        lat: h.lat !== undefined ? h.lat : (h.location?.coordinates?.[1] || 21.1702),
        lng: h.lng !== undefined ? h.lng : (h.location?.coordinates?.[0] || 72.8311),
        type: 'hospital'
      }));
    instantMatches.push(...matchingHospitals);

    // 4. Merge instant local matches with async API results from Photon / Nominatim
    const combined = [...instantMatches, ...pickupSuggestions];
    const seen = new Set();
    const result = [];
    for (const item of combined) {
      const key = (item.name || '').toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
    return result.slice(0, 10);
  };

  const handlePickupSelect = (item) => {
    setBookingForm(prev => ({
      ...prev,
      pickupAddress: item.address || `${item.name}, Surat`,
      pickupLat: item.lat,
      pickupLng: item.lng
    }));
    setShowPickupSuggestions(false);
    setSelectedPickupIndex(-1);
  };

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
      console.log('📍 Received driver location:', {
        lat: data.location.latitude?.toFixed(6) || data.location.lat?.toFixed(6),
        lng: data.location.longitude?.toFixed(6) || data.location.lng?.toFixed(6),
        accuracy: data.accuracy ? `${data.accuracy.toFixed(0)}m` : 'N/A',
        speed: data.speed ? `${data.speed.toFixed(1)} km/h` : '0 km/h',
        timestamp: data.timestamp
      });

      // Update driver location on map
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

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const address = await reverseGeocodeLocation(lat, lng);
          setBookingForm(prev => ({
            ...prev,
            pickupLat: lat,
            pickupLng: lng,
            pickupAddress: address || `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`
          }));
        },
        (error) => {
          console.error("Error getting location", error);
          alert("Could not get your location. Please enable location services.");
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  // Real Geocoding function when user finishes typing
  const handleGeocodeAddress = async (address, field) => {
    if (!address || address.trim().length < 2) return;
    try {
      const result = await geocodeLocation(address);
      if (result) {
        if (field === 'pickup') {
          setBookingForm(prev => ({
            ...prev,
            pickupLat: result.lat,
            pickupLng: result.lng
          }));
        } else {
          setBookingForm(prev => ({
            ...prev,
            dropLat: result.lat,
            dropLng: result.lng
          }));
        }
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    }
  };

  const getFilteredHospitalSuggestions = () => {
    const rawQuery = (bookingForm.dropAddress || '').trim().toLowerCase();
    
    // Merge local hospitals with DB & OSM search results (deduplicate)
    const allHospitals = deduplicateHospitals([...hospitals, ...dbSearchResults]);

    // Calculate distance for all hospitals from current pickup coordinates
    const hospitalsWithDistance = allHospitals.map(h => {
      const hLat = h.lat !== undefined ? h.lat : (h.location?.coordinates?.[1] || 21.1702);
      const hLng = h.lng !== undefined ? h.lng : (h.location?.coordinates?.[0] || 72.8311);
      const dist = calculateDistance(
        bookingForm.pickupLat,
        bookingForm.pickupLng,
        hLat,
        hLng
      );
      return { 
        ...h, 
        lat: hLat,
        lng: hLng,
        distanceKm: dist, 
        isHospital: true 
      };
    });

    if (!rawQuery) {
      // If empty, sort by nearest to pickup and return top 10
      return hospitalsWithDistance.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 10);
    }

    const queryWords = rawQuery.split(/[\s,.-]+/).filter(w => w.length > 0);

    // Filter by name, address, or specialties using flexible multi-word matching
    const matchedHospitals = hospitalsWithDistance.filter(h => {
      const name = (h.name || '').toLowerCase();
      const addr = (h.address || '').toLowerCase();
      const specs = (h.specialties || []).map(s => (s || '').toLowerCase()).join(' ');
      const combined = `${name} ${addr} ${specs}`;
      
      // Matches entire phrase or all typed words
      return combined.includes(rawQuery) || (queryWords.length > 0 && queryWords.every(w => combined.includes(w)));
    });

    // Also match known landmarks/areas in Surat that aren't already in matched hospitals
    const matchedLandmarks = KNOWN_LOCATIONS
      .filter(l => {
        const lName = (l.name || '').toLowerCase();
        const matches = lName.includes(rawQuery) || (queryWords.length > 0 && queryWords.every(w => lName.includes(w)));
        return matches && !matchedHospitals.some(h => (h.name || '').toLowerCase().includes(lName));
      })
      .map((l, i) => ({
        id: `loc_${i}`,
        name: l.name,
        address: `${l.name}, Surat`,
        lat: l.lat,
        lng: l.lng,
        specialties: ['Landmark / Area'],
        distanceKm: calculateDistance(bookingForm.pickupLat, bookingForm.pickupLng, l.lat, l.lng),
        isHospital: false
      }));

    const allMatches = [...matchedHospitals, ...matchedLandmarks];
    
    // Sort matches: prioritize startsWith, then sort by distance
    return allMatches.sort((a, b) => {
      const aStarts = (a.name || '').toLowerCase().startsWith(rawQuery);
      const bStarts = (b.name || '').toLowerCase().startsWith(rawQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.distanceKm - b.distanceKm;
    });
  };

  const handleHospitalSelect = (hospital) => {
    const lat = hospital.lat !== undefined ? hospital.lat : (hospital.location?.coordinates?.[1] || 21.1702);
    const lng = hospital.lng !== undefined ? hospital.lng : (hospital.location?.coordinates?.[0] || 72.8311);

    setBookingForm(prev => ({
      ...prev,
      dropAddress: `${hospital.name}, ${hospital.address || 'Surat'}`,
      dropLat: lat,
      dropLng: lng
    }));
    setShowHospitalSuggestions(false);
    setSelectedHospitalIndex(-1);
  };

  const handleCustomSearchInSurat = async (customQuery) => {
    if (!customQuery || !customQuery.trim()) return;
    setIsSearchingLocation(true);
    try {
      const result = await geocodeLocation(customQuery);
      if (result) {
        setBookingForm(prev => ({
          ...prev,
          dropAddress: result.displayName || `${customQuery}, Surat`,
          dropLat: result.lat,
          dropLng: result.lng
        }));
        setShowHospitalSuggestions(false);
      } else {
        alert(`Could not find "${customQuery}" on map. Please select a hospital from the list or enter a known area in Surat.`);
      }
    } catch (err) {
      console.error('Error finding location:', err);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handlePickupChangeFromMap = ({ lat, lng, address }) => {
    setBookingForm(prev => ({
      ...prev,
      pickupLat: lat,
      pickupLng: lng,
      pickupAddress: address || prev.pickupAddress
    }));
  };

  const handleDropChangeFromMap = ({ lat, lng, address }) => {
    setBookingForm(prev => ({
      ...prev,
      dropLat: lat,
      dropLng: lng,
      dropAddress: address || prev.dropAddress
    }));
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
    const type = ambulanceTypes.find(t => t.value === bookingForm.ambulanceType) || ambulanceTypes[0];
    const base = type.baseFare || 200;
    const perKm = type.perKm || 15;
    const fare = base + (distance * perKm);
    return { distance: distance, fare: Math.round(fare) };
  };

  const [estimatedFare, setEstimatedFare] = useState(() => {
    const dist = calculateDistance(21.1950, 72.7950, 21.1702, 72.8311);
    return { distance: dist.toFixed(2), fare: Math.round(200 + dist * 15) };
  });

  useEffect(() => {
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
        
        if (orderData.isMock || !window.Razorpay) {
          // Seamless test/demo mode payment
          const verifyData = {
            razorpay_order_id: orderData.orderId,
            razorpay_payment_id: `pay_demo_${Date.now()}`,
            razorpay_signature: 'mock_signature',
            bookingId: booking._id
          };
          await api.verifyRazorpayPayment(verifyData);
          alert(`✅ Online Payment Successful! (₹${pendingBookingData.fare})\n\nBooking Confirmed!\nBooking ID: ${booking.bookingId || booking._id}\nPayment ID: ${verifyData.razorpay_payment_id}`);
          setShowPaymentConfirmModal(false);
          setPendingBookingData(null);
          loadBookings();
          setActiveTab('history');
          return;
        }

        // Initialize Razorpay checkout with live keys
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
                {/* Pickup Location */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pickup Location
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={bookingForm.pickupAddress}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBookingForm({...bookingForm, pickupAddress: val});
                          setShowPickupSuggestions(true);
                          setSelectedPickupIndex(-1);
                          triggerPickupSearch(val);
                        }}
                        onFocus={() => setShowPickupSuggestions(true)}
                        onBlur={() => {
                          setTimeout(() => setShowPickupSuggestions(false), 250);
                        }}
                        onKeyDown={(e) => {
                          const filtered = getFilteredPickupSuggestions();
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setSelectedPickupIndex(prev => (prev < filtered.length - 1 ? prev + 1 : 0));
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setSelectedPickupIndex(prev => (prev > 0 ? prev - 1 : filtered.length - 1));
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            if (selectedPickupIndex >= 0 && selectedPickupIndex < filtered.length) {
                              handlePickupSelect(filtered[selectedPickupIndex]);
                            } else if (filtered.length > 0 && bookingForm.pickupAddress.trim()) {
                              handlePickupSelect(filtered[0]);
                            } else {
                              handleGeocodeAddress(bookingForm.pickupAddress, 'pickup');
                              setShowPickupSuggestions(false);
                            }
                          } else if (e.key === 'Escape') {
                            setShowPickupSuggestions(false);
                          }
                        }}
                        className="w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent shadow-sm"
                        placeholder="Search pickup address, society, landmark, or area..."
                        required
                        autoComplete="off"
                      />
                      <MapPin className="w-4 h-4 text-blue-500 absolute left-3 top-3.5 pointer-events-none" />
                      {bookingForm.pickupAddress && (
                        <button
                          type="button"
                          onClick={() => {
                            setBookingForm({ ...bookingForm, pickupAddress: '' });
                            setShowPickupSuggestions(true);
                          }}
                          className="absolute right-2.5 top-3 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100"
                          title="Clear Pickup"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Pickup Suggestions Dropdown */}
                      {showPickupSuggestions && (
                        <div className="absolute z-30 w-full min-w-[320px] mt-1.5 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-2xl max-h-80 overflow-y-auto custom-scrollbar divide-y divide-slate-100 ring-1 ring-black/5 animate-in fade-in-50 duration-150">
                          <div className="px-3 py-2 bg-gradient-to-r from-blue-50/90 via-sky-50/60 to-indigo-50/50 border-b border-blue-100 text-[11px] font-semibold text-blue-900 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>{bookingForm.pickupAddress.trim().length >= 2 ? `Matching Locations` : 'Popular Surat Areas'}</span>
                              {isSearchingPickup && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 font-medium bg-blue-100/70 px-1.5 py-0.5 rounded-full animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                                  Searching...
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-600 bg-white/90 px-2 py-0.5 rounded-full border border-blue-200/60 font-medium shadow-2xs">
                              {getFilteredPickupSuggestions().length} found
                            </span>
                          </div>

                          {(() => {
                            const filtered = getFilteredPickupSuggestions();
                            if (filtered.length === 0) {
                              return (
                                <div className="p-4 text-center">
                                  <p className="text-xs text-gray-600 mb-2">
                                    No direct match for "<strong>{bookingForm.pickupAddress}</strong>"
                                  </p>
                                  <button
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleGeocodeAddress(bookingForm.pickupAddress, 'pickup');
                                      setShowPickupSuggestions(false);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl shadow-sm transition-colors"
                                  >
                                    <Search className="w-3 h-3" />
                                    Search exact location on Map
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <>
                                {filtered.slice(0, 10).map((loc, idx) => {
                                  const isSelected = selectedPickupIndex === idx;
                                  const isHosp = loc.type === 'hospital';
                                  return (
                                    <div
                                      key={idx}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        handlePickupSelect(loc);
                                      }}
                                      onMouseEnter={() => setSelectedPickupIndex(idx)}
                                      className={`p-3 cursor-pointer transition-all flex items-start gap-3 ${
                                        isSelected
                                          ? 'bg-blue-50/90 border-l-4 border-blue-600 pl-2'
                                          : 'hover:bg-slate-50/90'
                                      }`}
                                    >
                                      <div className={`p-2 rounded-xl shrink-0 mt-0.5 border ${
                                        isHosp
                                          ? (isSelected ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'bg-red-50 text-red-600 border-red-100')
                                          : (isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-blue-50 text-blue-600 border-blue-100')
                                      }`}>
                                        {isHosp ? (
                                          <Building2 className="w-4 h-4" />
                                        ) : (
                                          <MapPin className="w-4 h-4" />
                                        )}
                                      </div>

                                      <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-xs text-slate-900 truncate" title={loc.name}>
                                          {loc.name}
                                        </div>
                                        <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1" title={loc.address}>
                                          <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                                          <span>{loc.address}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}

                                {bookingForm.pickupAddress.trim().length >= 2 && (
                                  <div
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleGeocodeAddress(bookingForm.pickupAddress, 'pickup');
                                      setShowPickupSuggestions(false);
                                    }}
                                    className="p-2.5 bg-slate-50/80 hover:bg-slate-100/90 cursor-pointer text-xs text-blue-600 flex items-center justify-between font-medium border-t border-slate-100 transition-colors"
                                  >
                                    <span className="flex items-center gap-1.5">
                                      <Search className="w-3.5 h-3.5 text-blue-500" />
                                      Search "{bookingForm.pickupAddress}" across Map
                                    </span>
                                    <span className="text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">↵ Enter</span>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={getCurrentLocation}
                      className="p-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 shrink-0"
                      title="Use Current GPS Location"
                    >
                      <Navigation className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Drop Location / Hospital */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Drop Location / Hospital
                  </label>

                  <div className="relative">
                    <input
                      type="text"
                      value={bookingForm.dropAddress}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBookingForm({...bookingForm, dropAddress: val});
                        setShowHospitalSuggestions(true);
                        setSelectedHospitalIndex(-1);
                        // Live search from MongoDB database
                        triggerDBSearch(val);
                      }}
                      onFocus={() => setShowHospitalSuggestions(true)}
                      onBlur={() => {
                        setTimeout(() => setShowHospitalSuggestions(false), 250);
                      }}
                      onKeyDown={(e) => {
                        const filtered = getFilteredHospitalSuggestions();
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setSelectedHospitalIndex(prev => (prev < filtered.length - 1 ? prev + 1 : 0));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setSelectedHospitalIndex(prev => (prev > 0 ? prev - 1 : filtered.length - 1));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (selectedHospitalIndex >= 0 && selectedHospitalIndex < filtered.length) {
                            handleHospitalSelect(filtered[selectedHospitalIndex]);
                          } else if (filtered.length > 0 && bookingForm.dropAddress.trim()) {
                            handleHospitalSelect(filtered[0]);
                          } else {
                            handleGeocodeAddress(bookingForm.dropAddress, 'drop');
                            setShowHospitalSuggestions(false);
                          }
                        } else if (e.key === 'Escape') {
                          setShowHospitalSuggestions(false);
                        }
                      }}
                      className="w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent shadow-sm"
                      placeholder="Search hospital (e.g. Kiran, Civil, Sunshine, BAPS, Apple, Shelby)"
                      required
                      autoComplete="off"
                    />
                    <Building2 className="w-4 h-4 text-red-500 absolute left-3 top-3.5 pointer-events-none" />

                    {bookingForm.dropAddress && (
                      <button
                        type="button"
                        onClick={() => {
                          setBookingForm({ ...bookingForm, dropAddress: '' });
                          setShowHospitalSuggestions(true);
                        }}
                        className="absolute right-2.5 top-3 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Suggestions List */}
                  {showHospitalSuggestions && (
                    <div className="absolute z-30 w-full min-w-[320px] mt-1.5 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-2xl max-h-80 overflow-y-auto custom-scrollbar divide-y divide-slate-100 ring-1 ring-black/5 animate-in fade-in-50 duration-150">
                      {/* Header */}
                      <div className="px-3 py-2 bg-gradient-to-r from-rose-50/90 via-red-50/60 to-amber-50/50 border-b border-rose-100 text-[11px] font-semibold text-rose-900 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span>{bookingForm.dropAddress.trim() ? `Matching Hospitals` : 'Surat Hospitals & Clinics'}</span>
                          {isSearchingDB && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-medium bg-amber-100/70 px-1.5 py-0.5 rounded-full animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                              Searching...
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-600 bg-white/90 px-2 py-0.5 rounded-full border border-rose-200/60 shadow-2xs font-medium">
                          {getFilteredHospitalSuggestions().length} found
                        </span>
                      </div>

                      {(() => {
                        const filtered = getFilteredHospitalSuggestions();
                        if (filtered.length === 0) {
                          return (
                            <div className="p-4 text-center">
                              <p className="text-xs text-gray-600 mb-2.5">
                                No hospital found matching "<strong>{bookingForm.dropAddress}</strong>"
                              </p>
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleCustomSearchInSurat(bookingForm.dropAddress);
                                }}
                                disabled={isSearchingLocation}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-xl shadow-md transition-colors"
                              >
                                <Search className="w-3.5 h-3.5" />
                                {isSearchingLocation ? 'Searching Map...' : `Search "${bookingForm.dropAddress}" on Map`}
                              </button>
                            </div>
                          );
                        }

                        return (
                          <>
                            {filtered.slice(0, 12).map((hospital, idx) => {
                              const isSelected = selectedHospitalIndex === idx;
                              const isHosp = hospital.isHospital !== false;
                              return (
                                <div
                                  key={hospital.id || hospital._id || idx}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleHospitalSelect(hospital);
                                  }}
                                  onMouseEnter={() => setSelectedHospitalIndex(idx)}
                                  className={`p-3 cursor-pointer transition-all flex items-start gap-3 ${
                                    isSelected
                                      ? 'bg-red-50/90 border-l-4 border-red-600 pl-2'
                                      : 'hover:bg-slate-50/90'
                                  }`}
                                >
                                  <div className={`p-2 rounded-xl shrink-0 mt-0.5 border ${
                                    isHosp
                                      ? (isSelected ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'bg-red-50 text-red-600 border-red-100')
                                      : (isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-blue-50 text-blue-600 border-blue-100')
                                  }`}>
                                    {isHosp ? (
                                      <Building2 className="w-4 h-4" />
                                    ) : (
                                      <MapPin className="w-4 h-4" />
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="font-semibold text-xs text-slate-900 truncate" title={hospital.name}>
                                        {hospital.name}
                                      </div>
                                      {hospital.distanceKm !== undefined && (
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0 border border-emerald-200">
                                          {hospital.distanceKm < 1
                                            ? `${(hospital.distanceKm * 1000).toFixed(0)} m`
                                            : `${hospital.distanceKm.toFixed(1)} km`}
                                        </span>
                                      )}
                                    </div>

                                    <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1" title={hospital.address}>
                                      <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                                      <span>{hospital.address}</span>
                                    </div>

                                    {hospital.specialties && hospital.specialties.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {hospital.specialties.slice(0, 2).map((spec, sIdx) => (
                                          <span
                                            key={sIdx}
                                            className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-medium border border-slate-200/60"
                                          >
                                            {spec}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {bookingForm.dropAddress.trim() && (
                              <div
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleCustomSearchInSurat(bookingForm.dropAddress);
                                }}
                                className="p-2.5 bg-slate-50/80 hover:bg-slate-100/90 cursor-pointer text-xs text-blue-600 flex items-center justify-between font-medium border-t border-slate-100 transition-colors"
                              >
                                <span className="flex items-center gap-1.5">
                                  <Search className="w-3.5 h-3.5 text-blue-500" />
                                  Search "{bookingForm.dropAddress}" across Map
                                </span>
                                <span className="text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">↵ Enter</span>
                              </div>
                            )}
                          </>
                        );
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
                  <div className="bg-gradient-to-r from-red-50/90 via-orange-50/70 to-rose-50/80 p-4 rounded-2xl border border-red-200/80 shadow-sm">
                    <div className="flex justify-between items-center pb-2.5 border-b border-red-100/90">
                      <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <Navigation className="w-3.5 h-3.5 text-red-600" />
                        Estimated Distance
                      </span>
                      <span className="font-bold text-sm text-red-700 bg-white px-2.5 py-0.5 rounded-full border border-red-200 shadow-2xs">
                        {estimatedFare.distance} km
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2.5 text-gray-900">
                      <div>
                        <span className="text-xs text-gray-500 font-medium block">Total Estimated Fare</span>
                        <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                          Pay on Drop (Cash / Online)
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-red-600">₹{estimatedFare.fare}</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-red-600 text-white py-3.5 rounded-xl font-semibold hover:bg-red-700 transition-colors shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                >
                  <Ambulance className="w-5 h-5" />
                  Confirm Booking • ₹{estimatedFare?.fare || 200}
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
                onPickupChange={handlePickupChangeFromMap}
                onDropChange={handleDropChangeFromMap}
                showRoute={true}
              />
              
              <div className="mt-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-1.5 text-sm">
                    <MapPin className="w-4 h-4 text-red-500" />
                    Trip & Location Summary
                  </h3>
                  {estimatedFare && (
                    <span className="text-xs font-bold text-red-700 bg-red-50 px-3 py-1 rounded-full border border-red-200">
                      📍 {estimatedFare.distance} km • ₹{estimatedFare.fare}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <p className="text-gray-500 font-medium">Pickup Coordinates</p>
                    <p className="font-mono text-gray-800 font-semibold mt-0.5">{bookingForm.pickupLat.toFixed(4)}, {bookingForm.pickupLng.toFixed(4)}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <p className="text-gray-500 font-medium">Drop Coordinates</p>
                    <p className="font-mono text-gray-800 font-semibold mt-0.5">{bookingForm.dropLat.toFixed(4)}, {bookingForm.dropLng.toFixed(4)}</p>
                  </div>
                  <div className="bg-red-50/80 p-2.5 rounded-xl border border-red-100">
                    <p className="text-red-600 font-medium">Trip Distance</p>
                    <p className="font-bold text-red-700 text-sm mt-0.5">{estimatedFare?.distance || '0.00'} km</p>
                  </div>
                  <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-100">
                    <p className="text-emerald-700 font-medium">Estimated Fare</p>
                    <p className="font-bold text-emerald-800 text-sm mt-0.5">₹{estimatedFare?.fare || 0}</p>
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
