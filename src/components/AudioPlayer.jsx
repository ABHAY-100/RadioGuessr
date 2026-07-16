import { useState, useEffect, useRef } from 'preact/hooks';
import Hls from 'hls.js';

export function AudioPlayer({ station, onStreamFailure, onSkip, hideName }) {
  const audioRef = useRef(null);
  const hlsRef = useRef(null);
  const playTimeoutRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState('loading'); // 'loading' | 'playing' | 'paused' | 'buffering' | 'error'
  const [volume, setVolume] = useState(0.5);

  // Set up audio source whenever the station changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !station) return;

    // Reset state for new stream
    setIsPlaying(false);
    setStatus('loading');
    
    // Clear any previous error/loading timeouts
    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
    }
    
    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const url = station.url;
    const isM3U8 = url.includes('.m3u8');

    // Start a 6-second timeout. If it doesn't play in 6s, trigger failure skip.
    playTimeoutRef.current = setTimeout(() => {
      if (audio.paused || audio.readyState < 2) {
        console.warn('Stream load timeout for:', station.name);
        setStatus('error');
        onStreamFailure(`Connection timed out for ${station.name}`);
      }
    }, 6000);

    if (isM3U8) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          maxMaxBufferLength: 10,
          enableWorker: true,
        });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(audio);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          audio.play().catch(handlePlayError);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error('HLS fatal error:', data);
            setStatus('error');
            onStreamFailure(`Failed to stream ${station.name}`);
          }
        });
      } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari)
        audio.src = url;
        audio.play().catch(handlePlayError);
      } else {
        // Not supported
        setStatus('error');
        onStreamFailure('HLS playback is not supported in this browser');
      }
    } else {
      // Standard progressive MP3/AAC stream
      audio.src = url;
      audio.load();
      audio.play().catch(handlePlayError);
    }

    function handlePlayError(err) {
      console.warn('Autoplay prevented or stream issue:', err);
      // If autoplay was blocked, we don't skip immediately. We let the user click play.
      // But if the source itself failed, it's handled by 'error' listeners or timeout.
      if (err.name === 'NotAllowedError') {
        setStatus('paused');
        setIsPlaying(false);
        if (playTimeoutRef.current) {
          clearTimeout(playTimeoutRef.current);
        }
      }
    }

    // Audio Event Handlers
    const onPlay = () => {
      setIsPlaying(true);
      setStatus('playing');
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
      }
    };

    const onPlaying = () => {
      setIsPlaying(true);
      setStatus('playing');
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
      }
    };

    const onPause = () => {
      setIsPlaying(false);
      setStatus('paused');
    };

    const onWaiting = () => {
      setStatus('buffering');
    };

    const onError = (e) => {
      console.error('Audio stream error event:', e);
      setStatus('error');
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
      }
      onStreamFailure(`Failed to connect to ${station.name}`);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('error', onError);
      
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      audio.pause();
      audio.src = '';
    };
  }, [station, onStreamFailure]);

  // Handle play/pause toggling
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      setStatus('loading');
      audio.play().catch((err) => {
        console.error('Manual play trigger failed:', err);
        setStatus('error');
      });
    }
  };

  // Sync volume with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Helper for UI status text
  const getStatusText = () => {
    switch (status) {
      case 'loading':
        return 'Connecting stream...';
      case 'buffering':
        return 'Buffering stream...';
      case 'playing':
        return 'Live Radio Playing';
      case 'paused':
        return 'Paused';
      case 'error':
        return 'Stream offline / error';
      default:
        return 'Status unknown';
    }
  };

  return (
    <div class="player-dock">
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="auto" crossOrigin="anonymous" />

      <div class="player-controls">
        <button 
          onClick={togglePlay} 
          class="play-pause-btn"
          aria-label={isPlaying ? 'Pause stream' : 'Play stream'}
          disabled={status === 'error'}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        
        {/* Equalizer animation, only pulses when playing */}
        <div class="pulse-visualizer-container">
          <div class={`equalizer ${isPlaying && status === 'playing' ? 'active' : ''}`}>
            <span class="equalizer-bar" />
            <span class="equalizer-bar" />
            <span class="equalizer-bar" />
            <span class="equalizer-bar" />
          </div>
        </div>
      </div>

      <div class="player-info">
        <div class="player-title">{station ? (hideName ? 'Tuned In • Live Radio' : station.name) : 'Selecting station...'}</div>
        <div class="player-status-row">
          <div class={`player-status-dot ${status}`} />
          <span class="player-status-text">{getStatusText()}</span>
        </div>
      </div>

      <div class="player-actions">
        <div class="volume-control">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style={{ color: 'var(--text-secondary)' }}>
            {volume === 0 ? (
              <>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </>
            ) : volume < 0.5 ? (
              <>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </>
            ) : (
              <>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </>
            )}
          </svg>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05" 
            value={volume} 
            onInput={(e) => setVolume(parseFloat(e.currentTarget.value))}
            class="volume-slider"
            aria-label="Volume Control"
          />
        </div>

        <button 
          onClick={onSkip} 
          class="skip-btn" 
          title="Skip offline stream"
          aria-label="Skip offline stream"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 4 15 12 5 20 5 4" />
            <line x1="19" y1="5" x2="19" y2="19" />
          </svg>
        </button>
      </div>
    </div>
  );
}
