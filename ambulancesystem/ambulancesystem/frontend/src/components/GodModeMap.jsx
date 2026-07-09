import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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

export const GodModeMap = ({ drivers }) => {
  const suratCenter = [21.1702, 72.8311];

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
    
    return {
      ...driver,
      displayLocation: coordinates
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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
                    {driver.currentBooking && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                          On Trip
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
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
    </div>
  );
};
