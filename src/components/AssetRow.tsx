import React from "react";
import {
  Play,
  Pause,
  ExternalLink,
  Info,
  Sparkles,
  Image,
  Music,
  Volume2,
  Box,
  Type,
  FileText,
} from "lucide-react";
import { EnrichedAsset } from "../types";
import { getCategoryInfo, formatFileSize } from "../data/categories";

interface AssetRowProps {
  asset: EnrichedAsset;
  isPlaying?: boolean;
  onPlayAudio?: (asset: EnrichedAsset) => void;
  onInspect: (asset: EnrichedAsset) => void;
  onTagClick: (tag: string) => void;
}

export const AssetRow: React.FC<AssetRowProps> = ({
  asset,
  isPlaying = false,
  onPlayAudio,
  onInspect,
  onTagClick,
}) => {
  const categoryInfo = getCategoryInfo(asset.category);
  const isAudio = asset.category === "music" || asset.category === "sound";

  const allTags = React.useMemo(() => {
    const list = [...asset.userTags, ...(asset.smart?.smartTags || [])];
    return Array.from(new Set(list.map((t) => t.replace(/^#/, "").toLowerCase())));
  }, [asset]);

  const getCategoryIcon = () => {
    switch (asset.category) {
      case "imagery":
        return <Image className="w-4 h-4 text-emerald-500" />;
      case "music":
        return <Music className="w-4 h-4 text-violet-500" />;
      case "sound":
        return <Volume2 className="w-4 h-4 text-amber-500" />;
      case "3d":
        return <Box className="w-4 h-4 text-pink-500" />;
      case "fonts":
        return <Type className="w-4 h-4 text-cyan-500" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div
      id={`asset-row-${asset.id}`}
      className="group flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all gap-4 text-sm"
    >
      {/* Left icon & name */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
          {getCategoryIcon()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              onClick={() => onInspect(asset)}
              className="font-medium text-zinc-900 dark:text-zinc-100 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {asset.name}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
              {asset.extension}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>{categoryInfo.label}</span>
            {asset.smart?.moodStyle && (
              <>
                <span>•</span>
                <span className="text-indigo-500 dark:text-indigo-400 truncate">
                  {asset.smart.moodStyle}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Center tags */}
      <div className="hidden md:flex items-center gap-1.5 max-w-xs flex-wrap">
        {allTags.slice(0, 3).map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onTagClick(tag)}
            className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 hover:text-indigo-600 cursor-pointer"
          >
            #{tag}
          </button>
        ))}
      </div>

      {/* Right meta & actions */}
      <div className="flex items-center gap-3 text-xs text-zinc-400 flex-shrink-0">
        <span className="tabular-nums w-18 text-right hidden sm:inline">
          {formatFileSize(asset.size)}
        </span>

        {isAudio && onPlayAudio && (
          <button
            type="button"
            onClick={() => onPlayAudio(asset)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isPlaying
                ? "bg-indigo-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 hover:text-indigo-600"
            }`}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        )}

        <button
          type="button"
          onClick={() => onInspect(asset)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Inspect & Edit Tags"
        >
          <Info className="w-4 h-4" />
        </button>

        {asset.webViewLink && (
          <a
            href={asset.webViewLink}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Open in Drive"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
};
