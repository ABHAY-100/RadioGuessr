import { useState, useEffect, useCallback } from 'preact/hooks';
import { Map } from './components/Map';
import { AudioPlayer } from './components/AudioPlayer';
import { RevealCard } from './components/RevealCard';
import { RoundSummary } from './components/RoundSummary';
import { ToastContainer } from './components/Toast';

export function App() {
  const [stations, setStations] = useState([]);
  const [unusedStations, setUnusedStations] = useState([]);
  const [toasts, setToasts] = useState([]);
  
  // Game state
  const [gameState, setGameState] = useState('welcome'); // 'welcome' | 'playing' | 'revealed' | 'summary'
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [currentStation, setCurrentStation] = useState(null);
  const [guessCoordinates, setGuessCoordinates] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [totalScore, setTotalScore] = useState(0);
  const [cluesRevealed, setCluesRevealed] = useState({ language: false, currency: false, region: false });
  const [highScore, setHighScore] = useState(() => {
    return Number(localStorage.getItem('radioguessr_high_score')) || 0;
  });

  // Load stations data from public/stations.json
  useEffect(() => {
    fetch('/stations.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch stations list');
        return res.json();
      })
      .then((data) => {
        setStations(data);
      })
      .catch((err) => {
        console.error(err);
        addToast('Error loading radio stations data.', 'error');
      });
  }, []);

  // Toast utilities
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Haversine distance helper (km)
  const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Exponential score decay: halves around 2500 km, near 0 past 12,000 km
  const calculateScore = (distance) => {
    const rawScore = Math.round(5000 * Math.exp(-distance / 2500));
    return rawScore < 50 ? 0 : rawScore;
  };

  // Select a random station and exclude it from unused pool
  const selectRandomStation = (pool) => {
    if (pool.length === 0) {
      // Fallback: recycle everything if we somehow run out
      const freshPool = [...stations];
      const randomIndex = Math.floor(Math.random() * freshPool.length);
      const station = freshPool[randomIndex];
      freshPool.splice(randomIndex, 1);
      setUnusedStations(freshPool);
      return station;
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    const station = pool[randomIndex];
    
    const newPool = [...pool];
    newPool.splice(randomIndex, 1);
    setUnusedStations(newPool);

    return station;
  };

  // Start a fresh game session
  const startGame = () => {
    if (stations.length === 0) {
      addToast('Radio data not fully loaded yet. Please wait a moment.', 'error');
      return;
    }
    const freshPool = [...stations];
    const firstStation = selectRandomStation(freshPool);
    
    setRounds([]);
    setTotalScore(0);
    setCurrentRoundIndex(0);
    setCurrentStation(firstStation);
    setGuessCoordinates(null);
    setCluesRevealed({ language: false, currency: false, region: false });
    setGameState('playing');
    addToast('Round 1: Listen carefully and guess the country!', 'info');
  };

  // Submit current guess and compute results
  const submitGuess = () => {
    if (!guessCoordinates) {
      addToast('Please click a location on the map to place your guess first!', 'info');
      return;
    }

    const distance = getHaversineDistance(
      guessCoordinates.lat,
      guessCoordinates.lon,
      currentStation.lat,
      currentStation.lon
    );
    
    const baseScore = calculateScore(distance);
    
    // Calculate score penalty based on clues revealed
    const count = Object.values(cluesRevealed).filter(Boolean).length;
    let multiplier = 1.0;
    if (count === 1) multiplier = 0.7;
    else if (count === 2) multiplier = 0.4;
    else if (count === 3) multiplier = 0.1;

    const score = Math.round(baseScore * multiplier);

    const roundResult = {
      station: currentStation,
      guess: guessCoordinates,
      actual: { lat: currentStation.lat, lon: currentStation.lon },
      distance,
      score
    };

    setRounds((prev) => [...prev, roundResult]);
    setTotalScore((prev) => prev + score);
    setGameState('revealed');
  };

  // Move to next round or show summary
  const nextRound = () => {
    if (currentRoundIndex >= 19) {
      setGameState('summary');
      if (totalScore > highScore) {
        localStorage.setItem('radioguessr_high_score', totalScore);
        setHighScore(totalScore);
      }
    } else {
      const nextStation = selectRandomStation(unusedStations);
      setCurrentStation(nextStation);
      setGuessCoordinates(null);
      setCluesRevealed({ language: false, currency: false, region: false });
      setCurrentRoundIndex((prev) => prev + 1);
      setGameState('playing');
      addToast(`Round ${currentRoundIndex + 2}: Listen and guess!`, 'info');
    }
  };

  // Stream failure or manual skip handler
  const handleStreamSkip = useCallback((reason) => {
    // We only swap stations if the user is in 'playing' state
    if (gameState !== 'playing') return;

    addToast(reason || 'Skipping offline stream. Swapping station...', 'error');
    
    setUnusedStations((prevPool) => {
      const pool = prevPool.length > 0 ? prevPool : [...stations];
      const randomIndex = Math.floor(Math.random() * pool.length);
      const replacementStation = pool[randomIndex];
      
      const newPool = [...pool];
      newPool.splice(randomIndex, 1);
      
      setCurrentStation(replacementStation);
      setGuessCoordinates(null);
      setCluesRevealed({ language: false, currency: false, region: false });
      
      return newPool;
    });
  }, [gameState, stations, addToast]);

  const handleManualSkip = () => {
    handleStreamSkip('Skipping current radio station...');
  };

  return (
    <div class="app-container">
      {/* Toast Manager */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Main Game Header */}
      <header class="main-header">
        <div class="logo-container">
          <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
          <span class="logo-text">RadioGuessr</span>
        </div>

        {gameState !== 'welcome' && gameState !== 'summary' && (
          <div class="game-stats">
            <div class="stat-item">
              <span class="label-micro">Round</span>
              <span class="stat-value">{currentRoundIndex + 1} / 20</span>
            </div>
            <div class="header-score-pill">
              <span class="label-micro">Total Score:</span>
              <span class="stat-value" style={{ color: 'var(--accent)' }}>{totalScore.toLocaleString()}</span>
            </div>
          </div>
        )}
      </header>

      {/* Welcome Screen Overlay */}
      {gameState === 'welcome' && (
        <div class="screen-overlay">
          <div class="screen-card">
            <div class="welcome-logo-pulse">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="2" />
                <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
              </svg>
            </div>
            
            <h1 class="welcome-title">RadioGuessr</h1>
            <p class="welcome-desc">
              Listen to live news radio broadcasts from around the world, pinpoint where the station is airing from, and drop your pin on the map.
            </p>

            {highScore > 0 && (
              <div class="welcome-scores-row" style={{ display: 'flex', gap: '20px', marginBottom: '24px', backgroundColor: 'var(--bg-elevated)', padding: '10px 20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span class="label-micro" style={{ fontSize: '9px', marginBottom: '2px' }}>Personal Best</span>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--accent)' }}>{highScore.toLocaleString()}</span>
                </div>
              </div>
            )}

            <div class="how-to-play-grid">
              <div class="step-card">
                <div class="step-icon">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                  </svg>
                </div>
                <div class="step-text">Listen closely for accents, language, and news clues.</div>
              </div>
              <div class="step-card">
                <div class="step-icon">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div class="step-text">Navigate the world map and drop a pin on your guess.</div>
              </div>
              <div class="step-card">
                <div class="step-icon">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="8" r="7" />
                    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                  </svg>
                </div>
                <div class="step-text">Submit your guess and score points based on accuracy.</div>
              </div>
            </div>

            <button onClick={startGame} class="btn-start">
              <span>Play Now</span>
            </button>
          </div>
        </div>
      )}

      {/* Primary Gameplay Screen */}
      {gameState !== 'welcome' && gameState !== 'summary' && (
        <div class="game-layout">
          {/* Leaflet Map Area */}
          <Map
            guess={guessCoordinates}
            onGuessSelect={setGuessCoordinates}
            actual={gameState === 'revealed' ? { lat: currentStation.lat, lon: currentStation.lon } : null}
            isRevealed={gameState === 'revealed'}
          />

          {/* Action Dock (Guess / Submit button) */}
          {gameState === 'playing' && (
            <div class="submit-dock">
              <button
                onClick={submitGuess}
                disabled={!guessCoordinates}
                class="btn-submit"
              >
                <span>Submit Guess</span>
              </button>
            </div>
          )}

          {/* Reveal details Panel */}
          {gameState === 'revealed' && (
            <RevealCard
              score={rounds[rounds.length - 1]?.score || 0}
              distance={rounds[rounds.length - 1]?.distance || 0}
              station={currentStation}
              onNext={nextRound}
              isLastRound={currentRoundIndex === 19}
            />
          )}

          {/* Custom audio controls wrapper */}
          {currentStation && (
            <AudioPlayer
              key={currentStation.url}
              station={currentStation}
              onStreamFailure={handleStreamSkip}
              onSkip={handleManualSkip}
              hideName={true}
            />
          )}

          {/* Clues Panel */}
          {gameState === 'playing' && currentStation && (
            <div class="clues-dock">
              <div class="clues-header">
                <span class="label-micro" style={{ fontWeight: 800 }}>Radio Clues</span>
                <span class={`multiplier-indicator penalty-${Object.values(cluesRevealed).filter(Boolean).length}`}>
                  {Object.values(cluesRevealed).filter(Boolean).length === 0 ? '100% Score' :
                   Object.values(cluesRevealed).filter(Boolean).length === 1 ? '70% Score' :
                   Object.values(cluesRevealed).filter(Boolean).length === 2 ? '40% Score' : '10% Score'}
                </span>
              </div>
              
              <div class="clues-subinfo">
                Every clue you unlock provides valuable details at the cost of your maximum round score.
              </div>

              <div class="clues-score-display">
                <span class="label-micro" style={{ fontSize: '10px' }}>Max Score:</span>
                <span class="clues-max-points">
                  {Object.values(cluesRevealed).filter(Boolean).length === 0 ? '5,000' :
                   Object.values(cluesRevealed).filter(Boolean).length === 1 ? '3,500' :
                   Object.values(cluesRevealed).filter(Boolean).length === 2 ? '2,000' : '500'} pts
                </span>
              </div>

              <div class="clues-meter-container">
                <div 
                  class="clues-meter-bar" 
                  style={{ 
                    width: `${Object.values(cluesRevealed).filter(Boolean).length === 0 ? 100 : Object.values(cluesRevealed).filter(Boolean).length === 1 ? 70 : Object.values(cluesRevealed).filter(Boolean).length === 2 ? 40 : 10}%`,
                    backgroundColor: Object.values(cluesRevealed).filter(Boolean).length === 0 ? 'var(--success)' : Object.values(cluesRevealed).filter(Boolean).length === 1 ? '#ffa000' : Object.values(cluesRevealed).filter(Boolean).length === 2 ? '#ff6f00' : 'var(--error)'
                  }} 
                />
              </div>

              <div class="clues-list">
                {/* Clue 1: Region */}
                <div class="clue-item">
                  {cluesRevealed.region ? (
                    <div class="clue-revealed-box">
                      <span class="clue-label">Region</span>
                      <span class="clue-value">{currentStation.region}</span>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setCluesRevealed(prev => ({ ...prev, region: true }))}
                      class="btn-clue-reveal"
                    >
                      <span>Unlock Region</span>
                      <span class="clue-penalty-badge">-30%</span>
                    </button>
                  )}
                </div>

                {/* Clue 2: Currency */}
                <div class="clue-item">
                  {cluesRevealed.currency ? (
                    <div class="clue-revealed-box">
                      <span class="clue-label">Currency</span>
                      <span class="clue-value">{currentStation.currency?.name} ({currentStation.currency?.code})</span>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setCluesRevealed(prev => ({ ...prev, currency: true }))}
                      disabled={!cluesRevealed.region}
                      class="btn-clue-reveal"
                      title={!cluesRevealed.region ? "Reveal Region clue first" : "Reveal Currency Clue"}
                    >
                      <span>{cluesRevealed.region ? 'Unlock Currency' : 'Currency Clue (Locked)'}</span>
                      <span class="clue-penalty-badge">-30%</span>
                    </button>
                  )}
                </div>

                {/* Clue 3: Language */}
                <div class="clue-item">
                  {cluesRevealed.language ? (
                    <div class="clue-revealed-box">
                      <span class="clue-label">Language</span>
                      <span class="clue-value">{currentStation.language?.join(', ')}</span>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setCluesRevealed(prev => ({ ...prev, language: true }))}
                      disabled={!cluesRevealed.currency}
                      class="btn-clue-reveal"
                      title={!cluesRevealed.currency ? "Reveal Currency clue first" : "Reveal Language Clue"}
                    >
                      <span>{cluesRevealed.currency ? 'Unlock Language' : 'Language Clue (Locked)'}</span>
                      <span class="clue-penalty-badge">-30%</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Campaign Summary Screen Overlay */}
      {gameState === 'summary' && (
        <RoundSummary
          rounds={rounds}
          totalScore={totalScore}
          onRestart={startGame}
        />
      )}
    </div>
  );
}
