import { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  Clock, 
  Navigation, 
  MapPin, 
  Building2, 
  Car, 
  ArrowRight, 
  ArrowUp, 
  CornerUpRight, 
  CornerUpLeft, 
  RotateCw, 
  CheckCircle, 
  ExternalLink,
  X,
  ListOrdered
} from 'lucide-react';
import { reverseGeocodeLocation } from '../utils/geocoding';

// Fix for default Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Google Maps Style Custom SVG HTML Markers
const createGooglePickupIcon = () => {
  return L.divIcon({
    className: 'custom-google-pickup-pin',
    html: `
      <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 28px; height: 28px; background: rgba(66, 133, 244, 0.25); border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="width: 18px; height: 18px; background: #1A73E8; border: 3px solid #FFFFFF; border-radius: 50%; box-shadow: 0 3px 8px rgba(0,0,0,0.35); z-index: 2;"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

const createGoogleDestinationIcon = () => {
  return L.divIcon({
    className: 'custom-google-drop-pin',
    html: `
      <div style="position: relative; width: 36px; height: 44px; display: flex; flex-direction: column; align-items: center;">
        <div style="width: 34px; height: 34px; background: linear-gradient(135deg, #EA4335 0%, #D93025 100%); border: 2.5px solid #FFFFFF; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 4px 10px rgba(217, 48, 37, 0.45); display: flex; align-items: center; justify-content: center;">
          <div style="transform: rotate(45deg); width: 10px; height: 10px; background: #FFFFFF; border-radius: 50%;"></div>
        </div>
      </div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 40],
    popupAnchor: [0, -40]
  });
};

const createGoogleAmbulanceIcon = () => {
  return L.divIcon({
    className: 'custom-google-ambulance-pin',
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 40px; height: 40px; background: rgba(234, 67, 53, 0.2); border-radius: 50%; animation: pulse 1.5s infinite;"></div>
        <div style="width: 32px; height: 32px; background: #FFFFFF; border: 2.5px solid #EA4335; border-radius: 50%; box-shadow: 0 3px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 16px; z-index: 2;">
          🚑
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22]
  });
};

const googlePickupIcon = createGooglePickupIcon();
const googleDestinationIcon = createGoogleDestinationIcon();
const googleAmbulanceIcon = createGoogleAmbulanceIcon();

// Helper to convert OSRM step maneuver to friendly text and icon
const formatManeuver = (step, idx, total) => {
  const type = step.maneuver?.type || '';
  const modifier = step.maneuver?.modifier || '';
  const road = step.name || 'Road';
  const dist = step.distance > 1000 
    ? `${(step.distance / 1000).toFixed(1)} km` 
    : `${Math.round(step.distance)} m`;

  if (idx === 0) {
    return {
      icon: <ArrowUp className="w-4 h-4 text-blue-600" />,
      text: `Start from Pickup Point onto ${road}`,
      distance: dist
    };
  }
  if (idx === total - 1 || type === 'arrive') {
    return {
      icon: <CheckCircle className="w-4 h-4 text-emerald-600" />,
      text: `Arrive at Destination (${road})`,
      distance: dist
    };
  }
  if (type === 'roundabout') {
    return {
      icon: <RotateCw className="w-4 h-4 text-indigo-600" />,
      text: `Take roundabout onto ${road}`,
      distance: dist
    };
  }
  if (modifier.includes('right')) {
    return {
      icon: <CornerUpRight className="w-4 h-4 text-blue-600" />,
      text: `Turn right onto ${road}`,
      distance: dist
    };
  }
  if (modifier.includes('left')) {
    return {
      icon: <CornerUpLeft className="w-4 h-4 text-blue-600" />,
      text: `Turn left onto ${road}`,
      distance: dist
    };
  }
  return {
    icon: <ArrowUp className="w-4 h-4 text-blue-600" />,
    text: `Continue straight on ${road}`,
    distance: dist
  };
};

// Map Bounds & Center Updater
const MapBoundsUpdater = ({ pickup, drop, driverLocation, routeCoordinates }) => {
  const map = useMap();

  useEffect(() => {
    if (routeCoordinates && routeCoordinates.length > 1) {
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (pickup && drop) {
      const bounds = L.latLngBounds(
        [pickup.lat, pickup.lng],
        [drop.lat, drop.lng]
      );
      if (driverLocation) {
        bounds.extend([driverLocation.lat, driverLocation.lng]);
      }
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else if (pickup) {
      map.flyTo([pickup.lat, pickup.lng], 15);
    } else if (driverLocation) {
      map.flyTo([driverLocation.lat, driverLocation.lng], 15);
    }
  }, [pickup?.lat, pickup?.lng, drop?.lat, drop?.lng, driverLocation?.lat, driverLocation?.lng, routeCoordinates, map]);

  return null;
};

export const MapView = ({ 
  pickup, 
  drop, 
  driverLocation, 
  showRoute = true,
  onPickupChange,
  onDropChange,
  interactive = true
}) => {
  const defaultCenter = [21.1702, 72.8311]; // Surat Center
  const [mapType, setMapType] = useState('roadmap'); // 'roadmap' | 'satellite' | 'terrain'
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null); // { distanceKm, durationMins }
  const [routeSteps, setRouteSteps] = useState([]); // Turn-by-turn navigation steps
  const [showDirections, setShowDirections] = useState(false);
  const [eta, setEta] = useState(null);

  // Google Maps Tile Layer Configs
  const tileLayers = {
    roadmap: {
      url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; Google Maps'
    },
    satellite: {
      url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; Google Maps Satellite'
    },
    terrain: {
      url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; Google Maps Terrain'
    }
  };

  // Fetch real road driving route & turn-by-turn steps via OSRM
  useEffect(() => {
    if (!showRoute || !pickup || !drop) {
      setRouteCoords([]);
      setRouteInfo(null);
      setRouteSteps([]);
      return;
    }

    let isMounted = true;

    const fetchRealRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${drop.lng},${drop.lat}?overview=full&geometries=geojson&steps=true`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && data.routes && data.routes.length > 0 && isMounted) {
            const primaryRoute = data.routes[0];
            const coordinates = primaryRoute.geometry.coordinates.map(c => [c[1], c[0]]);
            const distanceKm = (primaryRoute.distance / 1000).toFixed(1);
            const durationMins = Math.max(1, Math.round(primaryRoute.duration / 60));
            
            const rawSteps = primaryRoute.legs?.[0]?.steps || [];
            const parsedSteps = rawSteps.map((s, idx) => formatManeuver(s, idx, rawSteps.length));

            setRouteCoords(coordinates);
            setRouteInfo({ distanceKm, durationMins });
            setRouteSteps(parsedSteps);
            return;
          }
        }
      } catch (err) {
        console.warn('OSM routing fallback to straight polyline:', err);
      }

      // Fallback straight line
      if (isMounted) {
        setRouteCoords([
          [pickup.lat, pickup.lng],
          [drop.lat, drop.lng]
        ]);
        setRouteSteps([]);
      }
    };

    fetchRealRoute();

    return () => {
      isMounted = false;
    };
  }, [pickup?.lat, pickup?.lng, drop?.lat, drop?.lng, showRoute]);

  // Driver ETA calculation
  useEffect(() => {
    if (driverLocation && pickup) {
      const R = 6371;
      const dLat = (pickup.lat - driverLocation.lat) * (Math.PI / 180);
      const dLon = (pickup.lng - driverLocation.lng) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(driverLocation.lat * (Math.PI / 180)) * Math.cos(pickup.lat * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = R * c;
      const timeInMinutes = Math.max(1, Math.round((dist / 30) * 60));
      setEta(timeInMinutes);
    } else {
      setEta(null);
    }
  }, [driverLocation, pickup]);

  const mapCenter = useMemo(() => {
    if (pickup) return [pickup.lat, pickup.lng];
    if (drop) return [drop.lat, drop.lng];
    if (driverLocation) return [driverLocation.lat, driverLocation.lng];
    return defaultCenter;
  }, [pickup, drop, driverLocation]);

  const openGoogleMapsLive = () => {
    if (!pickup || !drop) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${pickup.lat},${pickup.lng}&destination=${drop.lat},${drop.lng}&travelmode=driving`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="relative w-full h-[470px] bg-slate-100 rounded-2xl overflow-hidden shadow-xl border border-slate-200 group">
      <MapContainer 
        center={mapCenter} 
        zoom={13} 
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <ZoomControl position="bottomright" />

        {/* Google Maps Real Tile Layer */}
        <TileLayer
          key={mapType}
          attribution={tileLayers[mapType].attribution}
          url={tileLayers[mapType].url}
          subdomains={tileLayers[mapType].subdomains}
          maxZoom={20}
        />

        {/* Pickup Marker (Google Blue Dot) */}
        {pickup && (
          <Marker 
            position={[pickup.lat, pickup.lng]} 
            icon={googlePickupIcon}
            draggable={interactive && !!onPickupChange}
            eventHandlers={{
              dragend: async (e) => {
                const marker = e.target;
                const pos = marker.getLatLng();
                const address = await reverseGeocodeLocation(pos.lat, pos.lng);
                if (onPickupChange) {
                  onPickupChange({ lat: pos.lat, lng: pos.lng, address });
                }
              }
            }}
          >
            <Popup className="google-maps-popup">
              <div className="p-1">
                <div className="font-bold text-xs text-blue-700 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Pickup Point (Patient)
                </div>
                <div className="text-[11px] text-gray-600 mt-1 leading-snug font-medium">
                  {pickup.address || 'Pickup Location'}
                </div>
                {interactive && onPickupChange && (
                  <div className="text-[9px] text-gray-400 mt-1 italic">
                    💡 Drag pin to adjust exact location
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Drop Marker (Google Red Destination Pin) */}
        {drop && (
          <Marker 
            position={[drop.lat, drop.lng]} 
            icon={googleDestinationIcon}
            draggable={interactive && !!onDropChange}
            eventHandlers={{
              dragend: async (e) => {
                const marker = e.target;
                const pos = marker.getLatLng();
                const address = await reverseGeocodeLocation(pos.lat, pos.lng);
                if (onDropChange) {
                  onDropChange({ lat: pos.lat, lng: pos.lng, address });
                }
              }
            }}
          >
            <Popup className="google-maps-popup">
              <div className="p-1">
                <div className="font-bold text-xs text-red-600 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  Hospital / Drop Location
                </div>
                <div className="text-[11px] text-gray-600 mt-1 leading-snug font-medium">
                  {drop.address || 'Destination Hospital'}
                </div>
                {interactive && onDropChange && (
                  <div className="text-[9px] text-gray-400 mt-1 italic">
                    💡 Drag pin to adjust exact location
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Ambulance Driver Live Marker */}
        {driverLocation && (
          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={googleAmbulanceIcon}>
            <Popup>
              <div className="p-1">
                <div className="font-bold text-xs text-red-600 flex items-center gap-1">
                  <Car className="w-3.5 h-3.5" />
                  Ambulance Live Tracking
                </div>
                <div className="text-[11px] text-gray-600 mt-1">
                  {driverLocation.speed ? `Speed: ${driverLocation.speed.toFixed(1)} km/h` : 'Driver En Route'}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Real Google Maps Navigation Blue Polyline Route */}
        {showRoute && routeCoords.length > 1 && (
          <>
            {/* White outline casing for road contrast */}
            <Polyline
              positions={routeCoords}
              color="#FFFFFF"
              weight={8}
              opacity={0.9}
              lineCap="round"
              lineJoin="round"
            />
            {/* Google Maps vibrant royal blue route line */}
            <Polyline
              positions={routeCoords}
              color="#1A73E8"
              weight={5}
              opacity={0.95}
              lineCap="round"
              lineJoin="round"
            />
          </>
        )}

        <MapBoundsUpdater 
          pickup={pickup} 
          drop={drop} 
          driverLocation={driverLocation}
          routeCoordinates={routeCoords}
        />
      </MapContainer>

      {/* Google Maps Layer Switcher (Top Right) */}
      <div className="absolute top-3 right-3 z-[1000] flex bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/80 p-1 gap-1">
        <button
          type="button"
          onClick={() => setMapType('roadmap')}
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
            mapType === 'roadmap'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Google Roadmap View"
        >
          <span>Map</span>
        </button>
        <button
          type="button"
          onClick={() => setMapType('satellite')}
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
            mapType === 'satellite'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Google Satellite View"
        >
          <span>Satellite</span>
        </button>
        <button
          type="button"
          onClick={() => setMapType('terrain')}
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
            mapType === 'terrain'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Google Terrain View"
        >
          <span>Terrain</span>
        </button>
      </div>

      {/* Google Maps Live Route Info & Directions Trigger (Top Left) */}
      {routeInfo && (
        <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2">
          <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-xl border border-slate-200/80 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold text-sm shrink-0">
              <Navigation className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-slate-900">{routeInfo.durationMins} mins</span>
                <span className="text-xs font-semibold text-slate-500">({routeInfo.distanceKm} km)</span>
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Fastest road route
              </div>
            </div>
          </div>

          {/* Directions / રસ્તો જુઓ Button */}
          <button
            type="button"
            onClick={() => setShowDirections(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2.5 rounded-2xl shadow-xl border border-blue-700 flex items-center gap-2 text-xs font-bold transition-all transform active:scale-95 shrink-0"
            title="View Turn-by-Turn Road Directions"
          >
            <Navigation className="w-4 h-4" />
            <span>Directions</span>
          </button>
        </div>
      )}

      {/* Google Maps Turn-by-Turn Directions Slide-over Drawer */}
      {showDirections && (
        <div className="absolute inset-y-0 left-0 w-full sm:w-80 md:w-96 bg-white/98 backdrop-blur-lg shadow-2xl z-[1500] border-r border-slate-200 flex flex-col animate-in slide-in-from-left duration-200">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              <div>
                <h4 className="font-bold text-sm leading-tight">Turn-by-Turn Directions</h4>
                <p className="text-[11px] text-blue-100">
                  {routeInfo?.durationMins} mins • {routeInfo?.distanceKm} km
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowDirections(false)}
              className="p-1 rounded-full hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Route Start and Destination Info */}
          <div className="p-3 bg-slate-50 border-b border-slate-100 text-xs space-y-1.5">
            <div className="flex items-start gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-1 shrink-0" />
              <div className="text-slate-700 line-clamp-1">
                <span className="font-semibold text-slate-900">Pickup: </span>
                {pickup?.address || 'Pickup Point'}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-600 mt-1 shrink-0" />
              <div className="text-slate-700 line-clamp-1">
                <span className="font-semibold text-slate-900">Destination: </span>
                {drop?.address || 'Hospital'}
              </div>
            </div>
          </div>

          {/* Step-by-Step Directions List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 divide-y divide-slate-100">
            {routeSteps.length > 0 ? (
              routeSteps.map((step, idx) => (
                <div key={idx} className="py-2.5 flex items-start gap-3 hover:bg-slate-50 rounded-xl px-2 transition-colors">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0 mt-0.5">
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 leading-snug">
                      {step.text}
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium">
                      In {step.distance}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-slate-500 text-xs">
                Direct route plotted on map.
              </div>
            )}
          </div>

          {/* Footer Action: Open in Official Google Maps App */}
          <div className="p-3 bg-slate-50 border-t border-slate-200">
            <button
              type="button"
              onClick={openGoogleMapsLive}
              className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Open Live GPS in Google Maps
            </button>
          </div>
        </div>
      )}

      {/* Driver ETA Overlay */}
      {eta !== null && (
        <div className="absolute bottom-4 left-3 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl z-[1000] border border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className="bg-red-50 p-2 rounded-xl text-red-600 border border-red-100">
              <Clock className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Driver Arrival</p>
              <p className="text-sm font-extrabold text-slate-900">{eta} mins</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
