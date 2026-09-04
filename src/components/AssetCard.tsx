import React from "react";
import {
  Play,
  Pause,
  ExternalLink,
  Tag,
  Sparkles,
  Info,
  Layers,
  Image,
  Music,
  Volume2,
  Box,
  Type,
  FileText,
  Star,
  StickyNote,
} from "lucide-react";
import { EnrichedAsset } from "../types";
import { getCategoryInfo, formatFileSize } from "../data/categories";

interface AssetCardProps {
  asset: EnrichedAsset;
  isPlaying?: boolean;
  onPlayAudio?: (asset: EnrichedAsset) => void;
  onInspect: (asset: EnrichedAsset) => void;
  onTagClick: (tag: string) => void;
  onToggleFavorite?: (asset: EnrichedAsset) => void;
  accessToken?: string | null;
}

export const AssetCard: React.FC<AssetCardProps> = ({
  asset,
  isPlaying = false,
  onPlayAudio,
  onInspect,
  onTagClick,
  onToggleFavorite,
  accessToken,
}) => {
  const categoryInfo = getCategoryInfo(asset.category);
  const isAudio = asset.category === "music" || asset.category === "sound";
  const isImage = asset.category === "imagery" || asset.category === "ui";

  // Combine smart tags and user tags
  const allTags = React.useMemo(() => {
    const list = [...asset.userTags, ...(asset.smart?.smartTags || [])];
    return Array.from(new Set(list.map((t) => t.replace(/^#/, "").toLowerCase())));
  }, [asset]);

  // Image source resolution
  const imagePreviewSrc = React.useMemo(() => {
    if (asset.thumbnailLink) {
      // Replace size query if present to get crisp preview
      return asset.thumbnailLink.replace(/=s\d+/, "=s400");
    }
    if (accessToken && isImage && !asset.id.startsWith("sample-")) {
      return `/api/drive-proxy/file/${asset.id}?token=${encodeURIComponent(accessToken)}`;
    }
    return null;
  }, [asset, accessToken, isImage]);

  return (
    <div
      id={`asset-card-${asset.id}`}
      className="group flex flex-col justify-between rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-lg transition-all duration-200 overflow-hidden"
    >
      {/* Visual Asset Preview Box */}
      <div className="relative w-full h-44 bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center overflow-hidden border-b border-zinc-100 dark:border-zinc-800/80">
        {/* Alpha checkerboard pattern background for game sprites */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(45deg, #888 25%, transparent 25%), linear-gradient(-45deg, #888 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #888 75%), linear-gradient(-45deg, transparent 75%, #888 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
          }}
        />

        {/* Media Preview based on Category */}
        {isImage && imagePreviewSrc ? (
          <img
            src={imagePreviewSrc}
            alt={asset.name}
            className="max-h-full max-w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
            style={{ imageRendering: asset.name.includes("pixel") ? "pixelated" : "auto" }}
            loading="lazy"
          />
        ) : isAudio ? (
          <div className="flex flex-col items-center justify-center gap-3 p-4 z-10">
            {/* Animated waveform visualizer bars */}
            <div className="flex items-end gap-1 h-12">
              {[40, 70, 90, 50, 100, 60, 85, 45, 95, 65, 30].map((h, i) => (
                <div
                  key={i}
                  className={`w-1.5 rounded-full transition-all duration-300 ${
                    isPlaying
                      ? "bg-indigo-500 animate-pulse"
                      : "bg-zinc-300 dark:bg-zinc-700"
                  }`}
                  style={{
                    height: isPlaying ? `${Math.min(100, h * 0.8 + 20)}%` : `${h * 0.5}%`,
                    animationDelay: `${i * 80}ms`,
                  }}
                />
              ))}
            </div>

            {/* In-Card Quick Play Button */}
            {onPlayAudio && (
              <button
                type="button"
                onClick={() => onPlayAudio(asset)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer ${
                  isPlaying
                    ? "bg-indigo-600 text-white"
                    : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-indigo-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700"
                }`}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause Audio</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 ml-0.5" />
                    <span>Play Audio</span>
                  </>
                )}
              </button>
            )}
          </div>
        ) : asset.category === "3d" ? (
          <div className="flex flex-col items-center justify-center gap-2 text-pink-500 z-10">
            <div className="w-14 h-14 rounded-2xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20">
              <Box className="w-7 h-7" />
            </div>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              3D Mesh / Rigged Asset
            </span>
          </div>
        ) : asset.category === "fonts" ? (
          <div className="flex flex-col items-center justify-center gap-1 z-10">
            <span className="text-3xl font-bold font-mono tracking-wider text-cyan-600 dark:text-cyan-400">
              Aa Bb 123
            </span>
            <span className="text-xs text-zinc-400">Game Font Face</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-slate-400 z-10">
            <FileText className="w-8 h-8" />
            <span className="text-xs font-mono uppercase">{asset.extension || "DATA"}</span>
          </div>
        )}

        {/* Top Badges: Category, Format & Favorite */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-20">
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border pointer-events-none ${categoryInfo.bgLight}`}
          >
            {categoryInfo.label.split(" ")[0]}
          </span>

          <div className="flex items-center gap-1.5">
            {onToggleFavorite && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(asset);
                }}
                className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg backdrop-blur-xs transition-colors cursor-pointer ${
                  asset.isFavorite
                    ? "bg-amber-500 text-white shadow-xs"
                    : "bg-zinc-900/60 text-zinc-300 hover:text-amber-300 hover:bg-zinc-900/80"
                }`}
                title={asset.isFavorite ? "Favorited (Stored in DB)" : "Mark Favorite"}
              >
                <Star className={`w-3.5 h-3.5 ${asset.isFavorite ? "fill-white" : ""}`} />
              </button>
            )}

            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md bg-zinc-900/80 text-white backdrop-blur-xs pointer-events-none">
              {asset.extension || "FILE"}
            </span>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* File Name */}
          <h3
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            title={asset.name}
            onClick={() => onInspect(asset)}
          >
            {asset.name}
          </h3>

          {/* Smart Subcategory / Mood descriptor */}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            {asset.smart?.moodStyle ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                <Sparkles className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{asset.smart.moodStyle}</span>
              </span>
            ) : (
              <span className="text-xs text-zinc-400">{categoryInfo.description.split(",")[0]}</span>
            )}
          </div>
        </div>

        {/* Tags List */}
        <div className="flex flex-wrap gap-1 min-h-6">
          {allTags.slice(0, 4).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTagClick(tag)}
              className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer"
            >
              #{tag}
            </button>
          ))}
          {allTags.length > 4 && (
            <span
              onClick={() => onInspect(asset)}
              className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-50 dark:bg-zinc-800/40 text-zinc-400 cursor-pointer"
            >
              +{allTags.length - 4}
            </span>
          )}
        </div>

        {/* Bottom meta & action bar */}
        <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span className="tabular-nums">{formatFileSize(asset.size)}</span>
            {asset.notes && (
              <span
                className="inline-flex items-center text-indigo-500 dark:text-indigo-400"
                title="Has Developer Notes"
              >
                <StickyNote className="w-3 h-3" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {asset.webViewLink && (
              <a
                href={asset.webViewLink}
                target="_blank"
                rel="noreferrer"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Open in Google Drive"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              type="button"
              onClick={() => onInspect(asset)}
              className="inline-flex items-center gap-1 min-h-[36px] px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-medium transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5" />
              <span>Inspect</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
