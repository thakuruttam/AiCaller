import React, { useState, useRef, useEffect } from 'react';
import { Button, IconButton } from '../components/ui';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react';

const AudioPlayer = ({ src, onTimeUpdate }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);
  // Read via a ref (not a dependency) so an inline arrow passed by the
  // parent on every render doesn't force this effect to keep tearing down
  // and re-adding the audio element's listeners.
  const onTimeUpdateRef = useRef(onTimeUpdate);
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
      onTimeUpdateRef.current?.(audio.currentTime, audio.duration);
    };

    const setAudioTime = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdateRef.current?.(audio.currentTime, audio.duration);
    };

    const onAudioEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', onAudioEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', onAudioEnded);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime += 10;
    }
  };

  const skipBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime -= 10;
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    audioRef.current.volume = val;
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    if (isMuted) {
      audioRef.current.volume = volume || 1;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="w-full bg-ink-50 border border-ink-400 rounded-card p-4 shadow-overlay">
      <audio ref={audioRef} src={src} />
      
      {/* Controls */}
      <div className="flex flex-col gap-4">
        
        {/* Progress Bar */}
        <div className="flex items-center gap-4 w-full">
          <span className="text-xs text-ink-700 w-10">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1.5 bg-ink-300 rounded-control appearance-none cursor-pointer accent-white"
          />
          <span className="text-xs text-ink-800 w-10">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <IconButton tone="neutral" size="md" title="Backward 10s" onClick={skipBackward}><RotateCcw size={20} /></IconButton>

            <Button variant="ghost" size="lg" onClick={togglePlayPause}>
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
            </Button>

            <IconButton tone="neutral" size="md" title="Forward 10s" onClick={skipForward}><RotateCw size={20} /></IconButton>
          </div>

          <div className="flex items-center gap-3 w-32 group">
            <Button variant="ghost" size="md" onClick={toggleMute}>
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </Button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="flex-1 h-1 bg-ink-300 rounded-control appearance-none cursor-pointer accent-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
