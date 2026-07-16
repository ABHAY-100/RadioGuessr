import { useState, useEffect } from 'preact/hooks';

export function RevealCard({ score, distance, station, onNext, isLastRound }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  // Smooth score count-up animation
  useEffect(() => {
    let startTimestamp = null;
    const duration = 1200; // 1.2 seconds
    
    let animationFrameId;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Easing out quadratic
      const easeOutQuad = progress * (2 - progress);
      
      setAnimatedScore(Math.floor(easeOutQuad * score));
      
      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      }
    };

    animationFrameId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [score]);

  // Clean flag source
  const flagUrl = station?.countrycode 
    ? `https://flagcdn.com/w80/${station.countrycode.toLowerCase()}.png`
    : null;

  return (
    <div class="reveal-container">
      <div class="reveal-header">
        <div class="score-reveal">
          <span class="label-micro">Points Earned</span>
          <div class="score-num">{animatedScore.toLocaleString()}</div>
        </div>
        <div class="distance-text">
          Distance: <strong>{Math.round(distance).toLocaleString()} km</strong> away
        </div>
      </div>

      <div class="reveal-body">
        <div>
          <div class="station-meta-title">{station.name}</div>
          <div class="station-meta-subtitle">
            {flagUrl && (
              <img 
                src={flagUrl} 
                alt={`${station.country} flag`}
                style={{ width: '20px', height: 'auto', borderRadius: '2px', display: 'inline-block', objectFit: 'cover' }}
              />
            )}
            <span>{station.country} ({station.region})</span>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-row">
            <span class="meta-label">Languages</span>
            <span class="meta-value" title={station.language?.join(', ')}>
              {station.language?.join(', ') || 'N/A'}
            </span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Currency</span>
            <span class="meta-value">
              {station.currency?.name} ({station.currency?.code})
            </span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Coordinates</span>
            <span class="meta-value" style={{ fontFamily: 'var(--font-mono)' }}>
              {station.lat.toFixed(4)}, {station.lon.toFixed(4)}
            </span>
          </div>
        </div>
      </div>

      <div class="reveal-footer">
        <button onClick={onNext} class="btn btn-primary">
          {isLastRound ? 'See Final Score' : 'Next Round'}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  );
}
