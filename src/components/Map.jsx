import { useEffect, useRef } from 'preact/hooks';
import L from 'leaflet';

export function Map({ guess, onGuessSelect, actual, isRevealed }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const guessMarkerRef = useRef(null);
  const actualMarkerRef = useRef(null);
  const lineRef = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Create Leaflet map instance
    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 2,
      attributionControl: false,
      minZoom: 1.5,
      zoomControl: window.innerWidth > 640,
      maxBounds: [
        [-90, -180],
        [90, 180]
      ],
      maxBoundsViscosity: 1.0,
      worldCopyJump: true
    });

    // Add CartoDB Dark Matter tile layer (gorgeous muted dark map)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 18,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle map click events based on state
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = (e) => {
      if (isRevealed) return;
      let lon = e.latlng.lng;
      // Normalize longitude to [-180, 180]
      lon = ((lon + 180) % 360);
      if (lon < 0) lon += 360;
      lon -= 180;
      onGuessSelect({ lat: e.latlng.lat, lon });
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isRevealed, onGuessSelect]);

  // Handle Guess Pin placement
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!guess) {
      if (guessMarkerRef.current) {
        guessMarkerRef.current.remove();
        guessMarkerRef.current = null;
      }
      return;
    }

    const guessIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div class="guess-marker"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    if (guessMarkerRef.current) {
      guessMarkerRef.current.setLatLng([guess.lat, guess.lon]);
    } else {
      guessMarkerRef.current = L.marker([guess.lat, guess.lon], { icon: guessIcon }).addTo(map);
    }
  }, [guess]);

  // Handle Reveal details (Actual location pin, geodesic line, fit bounds)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!isRevealed || !guess || !actual) {
      // Clean up reveal artifacts if they exist
      if (actualMarkerRef.current) {
        actualMarkerRef.current.remove();
        actualMarkerRef.current = null;
      }
      if (lineRef.current) {
        lineRef.current.remove();
        lineRef.current = null;
      }
      return;
    }

    const stationIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div class="station-marker"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    // Create actual location marker
    actualMarkerRef.current = L.marker([actual.lat, actual.lon], { icon: stationIcon }).addTo(map);

    // Draw geodesic / dotted connecting line
    lineRef.current = L.polyline(
      [[guess.lat, guess.lon], [actual.lat, actual.lon]],
      {
        color: 'var(--accent)',
        weight: 2,
        dashArray: '6, 8',
        opacity: 0.85
      }
    ).addTo(map);

    // Pan and zoom to show both pins with padding
    const bounds = L.latLngBounds([
      [guess.lat, guess.lon],
      [actual.lat, actual.lon]
    ]);
    map.fitBounds(bounds, {
      padding: [80, 80],
      maxZoom: 6,
      animate: true,
      duration: 1.2
    });
  }, [isRevealed, guess, actual]);

  // Reset map zoom when a new round starts
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!guess && !actual && !isRevealed) {
      map.setView([20, 0], 2, { animate: true, duration: 1.0 });
    }
  }, [guess, actual, isRevealed]);

  return (
    <div ref={containerRef} class="map-container-wrapper" />
  );
}
