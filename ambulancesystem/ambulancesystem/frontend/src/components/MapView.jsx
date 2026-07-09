import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Clock, Navigation } from 'lucide-react';

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icons
const ambulanceIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2636/2636282.png', // Ambulance icon
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20]
});

const patientIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/236/236831.png', // User/Patient icon
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35]
});

const destinationIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/854/854878.png', // Map pin/Destination
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35]
});

// Component to update map center when props change
const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, map.getZoom());
    }
  }, [center, map]);
  return null;
};

export const MapView = ({ pickup, drop, driverLocation, showRoute = false }) => {
  const suratCenter = [21.1702, 72.8311];
  const [eta, setEta] = useState(null);

  // Calculate ETA if driver and pickup are available
  useEffect(() => {
    if (driverLocation && pickup) {
      const dist = calculateDistance(
        driverLocation.lat, driverLocation.lng,
        pickup.lat, pickup.lng
      );
      // Assume average speed 30km/h
      const timeInHours = dist / 30;
      const timeInMinutes = Math.round(timeInHours * 60);
      setEta(timeInMinutes);
    }
  }, [driverLocation, pickup]);

  // Helper to calculate distance (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
  };

  return (
    <div className="relative w-full h-[400px] bg-gray-100 rounded-xl overflow-hidden shadow-lg border border-gray-200">
      <MapContainer 
        center={pickup ? [pickup.lat, pickup.lng] : suratCenter} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Pickup Marker (Patient) */}
        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]} icon={patientIcon}>
            <Popup>
              <div className="font-semibold">Patient Location</div>
              <div className="text-xs">{pickup.address}</div>
            </Popup>
          </Marker>
        )}

        {/* Drop Marker */}
        {drop && (
          <Marker position={[drop.lat, drop.lng]} icon={destinationIcon}>
            <Popup>
              <div className="font-semibold">Destination</div>
              <div className="text-xs">{drop.address}</div>
            </Popup>
          </Marker>
        )}

        {/* Driver Marker */}
        {driverLocation && (
          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={ambulanceIcon}>
            <Popup>
              <div className="font-semibold">Ambulance</div>
              <div className="text-xs">Driver is here</div>
            </Popup>
          </Marker>
        )}

        <MapUpdater center={driverLocation ? [driverLocation.lat, driverLocation.lng] : (pickup ? [pickup.lat, pickup.lng] : suratCenter)} />
      </MapContainer>

      {/* ETA Overlay */}
      {eta !== null && (
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-4 py-3 rounded-xl shadow-lg z-[1000] border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase">Estimated Arrival</p>
              <p className="text-lg font-bold text-gray-900">{eta} mins</p>
            </div>
          </div>
        </div>
      )}

      {/* Location Info Overlay */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg z-[1000] border border-gray-200 max-w-xs">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Navigation className="w-4 h-4 text-red-600" />
          <span>Surat, Gujarat</span>
        </div>
      </div>
    </div>
  );
};
