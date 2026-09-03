import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, X, Music, Repeat } from "lucide-react";
import { EnrichedAsset } from "../types";
import { getCategoryInfo } from "../data/categories";

interface AudioPlayerBarProps {
  asset: EnrichedAsset | null;
  accessToken: string | null;
  onClose: () => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  asset,
  accessToken,
  onClose,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLooping, setIsLooping] = useState(true); // Default loop true for game loops!
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [clientBlobUrl, setClientBlobUrl] = useState<string | null>(null);

  // For Google Drive assets, generate a direct blob URL as fallback for static deployments (GitHub Pages)
  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    if (asset && accessToken && !asset.id.startsWith("sample-")) {
      // Test proxy availability or fetch direct blob
      fetch(`/api/drive-proxy/file/${asset.id}?token=${encodeURIComponent(accessToken)}`, { method: "HEAD" })
        .then((res) => {
          if (!res.ok) {
            // Static host (GitHub Pages) or proxy unavailable: fetch directly from Drive API
            return fetch(`https://www.googleapis.com/drive/v3/files/${asset.id}?alt=media`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
              .then((r) => r.blob())
              .then((blob) => {
                if (active) {
                  createdUrl = URL.createObjectURL(blob);
                  setClientBlobUrl(createdUrl);
                }
              });
          } else {
            if (active) setClientBlobUrl(null);
          }
        })
        .catch(() => {
          // Network or static host fallback
          fetch(`https://www.googleapis.com/drive/v3/files/${asset.id}?alt=media`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
            .then((r) => r.blob())
            .then((blob) => {
              if (active) {
                createdUrl = URL.createObjectURL(blob);
                setClientBlobUrl(createdUrl);
              }
            })
            .catch((e) => console.warn("Could not fetch direct Drive audio blob:", e));
        });
    } else {
      setClientBlobUrl(null);
    }

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [asset?.id, accessToken]);

  // Determine media URL: use blob fallback if static, otherwise proxy
  const audioSrc = React.useMemo(() => {
    if (!asset) return "";
    if (clientBlobUrl) return clientBlobUrl;
    if (accessToken && !asset.id.startsWith("sample-")) {
      return `/api/drive-proxy/file/${asset.id}?token=${encodeURIComponent(accessToken)}`;
    }
    // For sample assets or fallback
    if (asset.id === "sample-audio-bgm-boss") {
      return "https://actions.google.com/sounds/v1/science_fiction/alien_hum.ogg";
    }
    if (asset.id === "sample-audio-bgm-town") {
      return "https://actions.google.com/sounds/v1/ambiences/tavern_room_ambience.ogg";
    }
    if (asset.id === "sample-sfx-sword-slash") {
      return "https://actions.google.com/sounds/v1/foley/swoosh_transition.ogg";
    }
    if (asset.id === "sample-sfx-laser-pulse") {
      return "https://actions.google.com/sounds/v1/science_fiction/laser_burst.ogg";
    }
    if (asset.id === "sample-sfx-ui-click") {
      return "https://actions.google.com/sounds/v1/cartoon/pop.ogg";
    }
    return "";
  }, [asset, accessToken]);

  useEffect(() => {
    if (audioRef.current && audioSrc) {
      setHasError(false);
      audioRef.current.load();
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.warn("Autoplay blocked or waiting for user interaction:", e);
        setIsPlaying(false);
      });
    }
  }, [audioSrc]);

  if (!asset) return null;

  const categoryInfo = getCategoryInfo(asset.category);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setHasError(true));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const toggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    if (audioRef.current) {
      audioRef.current.loop = next;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const formatSeconds = (s: number) => {
    if (isNaN(s)) return "0:00";
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div
      id="game-asset-audio-player-bar"
      className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-900/95 border-t border-zinc-800 text-zinc-100 backdrop-blur-md px-4 sm:px-8 py-3 shadow-2xl transition-all"
    >
      <audio
        ref={audioRef}
        src={audioSrc}
        loop={isLooping}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={() => {
          if (!isLooping) setIsPlaying(false);
        }}
        onError={() => setHasError(true)}
      />

      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Track info */}
        <div className="flex items-center gap-3 w-full sm:w-1/3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-violet-500/20 text-violet-400 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
            <Music className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white truncate">
                {asset.name}
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider bg-zinc-800 text-zinc-400">
                {asset.extension}
              </span>
            </div>
            <p className="text-xs text-zinc-400 truncate">
              {asset.smart?.moodStyle || categoryInfo.label}
            </p>
          </div>
        </div>

        {/* Playback controls & timeline */}
        <div className="flex flex-col items-center gap-1.5 w-full sm:w-1/2">
          <div className="flex items-center gap-4">
            <button
              id="audio-rewind-button"
              type="button"
              onClick={() => {
                if (audioRef.current) audioRef.current.currentTime = 0;
              }}
              className="p-1.5 text-zinc-400 hover:text-white transition-colors"
              title="Restart"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              id="audio-play-toggle-button"
              type="button"
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-md transition-all active:scale-95"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            {/* Loop Toggle - essential for game development! */}
            <button
              id="audio-loop-toggle-button"
              type="button"
              onClick={toggleLoop}
              className={`p-1.5 rounded-md flex items-center gap-1 text-xs transition-colors ${
                isLooping
                  ? "text-emerald-400 bg-emerald-500/10 font-medium"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              title={isLooping ? "Seamless Game Loop: Enabled" : "Loop: Disabled"}
            >
              <Repeat className="w-4 h-4" />
              <span className="hidden md:inline">Loop</span>
            </button>
          </div>

          <div className="w-full flex items-center gap-2 text-xs text-zinc-400">
            <span className="w-10 text-right tabular-nums">{formatSeconds(currentTime)}</span>
            <input
              id="audio-seek-slider"
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="w-10 tabular-nums">{formatSeconds(duration)}</span>
          </div>
          {hasError && (
            <span className="text-[11px] text-amber-400">
              Note: Direct stream preview limited by audio codec or permission.
            </span>
          )}
        </div>

        {/* Volume & Close */}
        <div className="flex items-center justify-end gap-3 w-full sm:w-1/4">
          <div className="hidden lg:flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="text-zinc-400 hover:text-white"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              id="audio-volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-18 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <button
            id="audio-player-close-button"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors ml-2"
            title="Close Player"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
