import { useEffect, useRef } from 'preact/hooks';
import L from 'leaflet';

export function RoundSummary({ rounds, totalScore, onRestart }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // Compute Rank/Title
  const getRank = () => {
    if (totalScore >= 80000) return { title: 'Global Radio Master', color: 'var(--accent)' };
    if (totalScore >= 60000) return { title: 'Expert Cartographer', color: 'var(--success)' };
    if (totalScore >= 40000) return { title: 'Broadcasting Scout', color: '#ffb300' };
    if (totalScore >= 20000) return { title: 'Casual Listener', color: 'var(--text-secondary)' };
    return { title: 'Lost in Transmission', color: 'var(--error)' };
  };

  const rank = getRank();

  // Initialize Summary Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [20, 0],
      attributionControl: false,
      zoom: 1,
      minZoom: 1,
      zoomControl: false, // Clean look, no zoom buttons needed on summary map
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 18,
    }).addTo(map);

    mapRef.current = map;

    // Add markers and lines for each round
    const validPoints = [];

    rounds.forEach((round, index) => {
      if (!round.guess || !round.actual) return;

      const guessIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="guess-marker" style="width: 14px; height: 14px; border-width: 2px; animation: none;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const stationIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="station-marker" style="width: 14px; height: 14px; border-width: 2px; animation: none;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      // Add Guess marker
      L.marker([round.guess.lat, round.guess.lon], { icon: guessIcon })
        .addTo(map)
        .bindPopup(`Round ${index + 1}: Your Guess`);

      // Add Actual marker
      L.marker([round.actual.lat, round.actual.lon], { icon: stationIcon })
        .addTo(map)
        .bindPopup(`Round ${index + 1}: Broadcast Location`);

      // Add Polyline
      L.polyline(
        [[round.guess.lat, round.guess.lon], [round.actual.lat, round.actual.lon]],
        {
          color: 'var(--accent)',
          weight: 2.5,
          opacity: 0.85
        }
      ).addTo(map);

      validPoints.push([round.guess.lat, round.guess.lon]);
      validPoints.push([round.actual.lat, round.actual.lon]);
    });

    // Zoom map to fit all points
    if (validPoints.length > 0) {
      const bounds = L.latLngBounds(validPoints);
      map.fitBounds(bounds, { padding: [30, 30] });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [rounds]);

  return (
    <div class="screen-overlay">
      <div class="screen-card screen-card-large">
        <h2 class="summary-title">Campaign Completed</h2>
        
        <div class="summary-score-container">
          <div class="summary-score-large">{totalScore.toLocaleString()}</div>
          <div class="summary-rank" style={{ color: rank.color }}>
            {rank.title}
          </div>
        </div>

        <div class="summary-content-grid">
          {/* Left panel: Map Summary */}
          <div class="summary-map-wrapper">
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
          </div>

          {/* Right panel: Details list */}
          <div class="rounds-list">
            {rounds.map((round, idx) => {
              const flagUrl = round.station.countrycode
                ? `https://flagcdn.com/w40/${round.station.countrycode.toLowerCase()}.png`
                : null;
              
              return (
                <div key={idx} class="round-row-card">
                  <div class="round-info-left">
                    <div class="round-row-num">Round {idx + 1}</div>
                    {/* <div class="round-row-station">Station {idx + 1}</div> */}
                    <span class="round-row-station">{round.station.name}</span>
                    <div class="round-row-country" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {flagUrl && (
                        <img 
                          src={flagUrl} 
                          alt="" 
                          style={{ width: '14px', height: 'auto', borderRadius: '1px' }}
                        />
                      )}
                      <span>{round.station.country}</span>
                    </div>
                  </div>
                  <div class="round-info-right">
                    <div class="round-row-score">+{round.score.toLocaleString()}</div>
                    <div class="round-row-distance">{Math.round(round.distance).toLocaleString()} km</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button onClick={onRestart} class="btn btn-primary" style={{ padding: '14px 32px' }}>
          PLAY AGAIN
        </button>
      </div>
    </div>
  );
}
