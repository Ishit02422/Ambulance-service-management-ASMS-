import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Ambulance Icons by Type
const createAmbulanceIcon = (type, isOnline) => {
  // Normalize type to lowercase and handle different formats
  const normalizedType = type?.toLowerCase().replace(/\s+/g, '_') || 'normal';
  
  const colors = {
    normal: isOnline ? '#10b981' : '#6b7280',
    icu: isOnline ? '#3b82f6' : '#6b7280',
    cardiac: isOnline ? '#ef4444' : '#6b7280',
    deadbodyvan: isOnline ? '#8b5cf6' : '#6b7280',
    dead_body_van: isOnline ? '#8b5cf6' : '#6b7280'
  };

  const color = colors[normalizedType] || colors.normal;

  const svgIcon = `
    <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="15" fill="${color}" opacity="0.9"/>
      <text x="20" y="26" font-size="20" text-anchor="middle" fill="white">🚑</text>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-ambulance-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
};

const DriverRoute = ({ start, end, color }) => {
  const [routeCoords, setRouteCoords] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const fetchRoute = async () => {
      try {
        // start and end are [lng, lat] from MongoDB
        const url = `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=simplified&geometries=geojson`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.routes && data.routes.length > 0 && isMounted) {
            const coordinates = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]); // [lat, lng] for Leaflet
            setRouteCoords(coordinates);
          }
        }
      } catch (err) {
        console.warn('OSRM routing fallback:', err);
        if (isMounted) {
          setRouteCoords([[start[1], start[0]], [end[1], end[0]]]);
        }
      }
    };
    if (start && end) {
      fetchRoute();
    }
    return () => { isMounted = false; };
  }, [start, end]);

  if (!routeCoords || routeCoords.length === 0) return null;

  return (
    <Polyline 
      positions={routeCoords} 
      pathOptions={{ color: color || '#3b82f6', weight: 4, opacity: 0.7, dashArray: '10, 10' }} 
    />
  );
};

export const GodModeMap = ({ drivers, bookings = [] }) => {
  const suratCenter = [21.1702, 72.8311];
  const [mapType, setMapType] = useState('roadmap');

  const GOOGLE_MAPS_TILES = {
    roadmap: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    satellite: "https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}",
    terrain: "https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
  };

  // Helper function to generate random coordinates around Surat
  const generateRandomSuratLocation = (index) => {
    const baseLatitudes = [21.1702, 21.2050, 21.1590, 21.1850, 21.1950];
    const baseLongitudes = [72.8311, 72.8653, 72.7750, 72.8150, 72.8550];
    
    const randomOffset = () => (Math.random() - 0.5) * 0.02; // ~1km radius
    
    const lat = baseLatitudes[index % baseLatitudes.length] + randomOffset();
    const lng = baseLongitudes[index % baseLongitudes.length] + randomOffset();
    
    return [lng, lat];
  };

  // Process drivers: use their location if available, otherwise generate mock location
  const processedDrivers = drivers.map((driver, index) => {
    let coordinates;
    
    if (driver.location && driver.location.coordinates && 
        driver.location.coordinates.length === 2 &&
        driver.location.coordinates[0] !== 0 && 
        driver.location.coordinates[1] !== 0) {
      // Driver has valid location
      coordinates = driver.location.coordinates;
    } else {
      // Generate mock location for visualization
      coordinates = generateRandomSuratLocation(index);
    }
    
    const activeBooking = bookings.find(b => 
      (b.driverId?._id === driver._id || b.driverId === driver._id) && 
      ['accepted', 'assigned', 'on_the_way', 'reached', 'picked', 'in_progress'].includes(b.status)
    );

    return {
      ...driver,
      displayLocation: coordinates,
      activeBooking: activeBooking || driver.currentBooking
    };
  });

  return (
    <div className="relative w-full h-full bg-gray-100 rounded-xl overflow-hidden shadow-lg border border-gray-200">
      <MapContainer 
        center={suratCenter} 
        zoom={12} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; Google Maps'
          url={GOOGLE_MAPS_TILES[mapType]}
          maxZoom={20}
        />
        
        {/* Render all driver markers */}
        {processedDrivers.map((driver) => {
          const [lng, lat] = driver.displayLocation;
          const isOnline = driver.status === 'online';
          const hasRealLocation = driver.location && 
                                  driver.location.coordinates && 
                                  driver.location.coordinates[0] !== 0 && 
                                  driver.location.coordinates[1] !== 0;
          
          return (
            <Marker 
              key={driver._id} 
              position={[lat, lng]} 
              icon={createAmbulanceIcon(driver.ambulanceType, isOnline)}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <div className="font-semibold text-lg mb-1">{driver.name}</div>
                  {!hasRealLocation && (
                    <div className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded mb-2">
                      📍 Mock Location (Demo)
                    </div>
                  )}
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium">Vehicle:</span>
                      <span>{driver.vehicleNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Type:</span>
                      <span className="capitalize">{driver.ambulanceType?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Status:</span>
                      <span className={`px-2 py-0.5 rounded text-white ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`}>
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Rating:</span>
                      <span>{driver.rating || 0} ⭐</span>
                    </div>
                    {driver.activeBooking && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                          On Trip ({driver.activeBooking.status})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Render Routes for Active Bookings */}
        {processedDrivers.map(driver => {
          if (!driver.activeBooking || !driver.displayLocation) return null;
          
          const booking = driver.activeBooking;
          const isGoingToDrop = ['picked', 'reached', 'in_progress'].includes(booking.status);
          
          // Destination coordinates from booking [lng, lat]
          const destCoords = isGoingToDrop && booking.dropLocation?.coordinates 
            ? booking.dropLocation.coordinates 
            : booking.pickupLocation?.coordinates;
            
          if (!destCoords || destCoords.length !== 2 || destCoords[0] === 0) return null;

          // Determine line color based on ambulance type
          const colorMap = {
            normal: '#10b981',
            icu: '#3b82f6',
            cardiac: '#ef4444',
            deadbodyvan: '#8b5cf6',
            dead_body_van: '#8b5cf6'
          };
          const type = driver.ambulanceType?.toLowerCase().replace(/\s+/g, '_') || 'normal';
          const routeColor = colorMap[type] || '#3b82f6';

          return (
            <DriverRoute 
              key={`route-${driver._id}`} 
              start={driver.displayLocation} 
              end={destCoords} 
              color={routeColor}
            />
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg z-[1000] border border-gray-200">
        <div className="text-xs font-semibold text-gray-700 mb-2">Ambulance Types</div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Normal (Online)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>ICU (Online)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Cardiac (Online)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span>Dead Body Van (Online)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span>Offline</span>
          </div>
        </div>
      </div>

      {/* Stats Overlay */}
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg z-[1000] border border-gray-200">
        <div className="text-xs font-semibold text-gray-700 mb-2">Live Stats</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Total Drivers:</span>
            <span className="font-bold">{drivers.length}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-green-600">Online:</span>
            <span className="font-bold text-green-600">
              {drivers.filter(d => d.status === 'online').length}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Offline:</span>
            <span className="font-bold">{drivers.filter(d => d.status === 'offline').length}</span>
          </div>
        </div>
      </div>

      {/* Map Type Controls */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg z-[1000] overflow-hidden flex text-sm border border-gray-200">
        <button 
          onClick={() => setMapType('roadmap')}
          className={`px-3 py-2 ${mapType === 'roadmap' ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}
        >
          Map
        </button>
        <button 
          onClick={() => setMapType('satellite')}
          className={`px-3 py-2 border-l border-r border-gray-200 ${mapType === 'satellite' ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}
        >
          Satellite
        </button>
        <button 
          onClick={() => setMapType('terrain')}
          className={`px-3 py-2 ${mapType === 'terrain' ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}
        >
          Terrain
        </button>
      </div>
    </div>
  );
};
