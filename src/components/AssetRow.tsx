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
  Star,
  StickyNote,
  Folder,
} from "lucide-react";
import { EnrichedAsset } from "../types";
import { getCategoryInfo, formatFileSize } from "../data/categories";

interface AssetRowProps {
  asset: EnrichedAsset;
  isPlaying?: boolean;
  onPlayAudio?: (asset: EnrichedAsset) => void;
  onInspect: (asset: EnrichedAsset) => void;
  onTagClick: (tag: string) => void;
  onToggleFavorite?: (asset: EnrichedAsset) => void;
  onFolderClick?: (folderName: string, folderId?: string) => void;
}

export const AssetRow: React.FC<AssetRowProps> = ({
  asset,
  isPlaying = false,
  onPlayAudio,
  onInspect,
  onTagClick,
  onToggleFavorite,
  onFolderClick,
}) => {
  const categoryInfo = getCategoryInfo(asset.category);
  const isAudio = asset.category === "music" || asset.category === "sound";

  const allTags = React.useMemo(() => {
    const list = [...asset.userTags, ...(asset.smart?.smartTags || [])];
    return Array.from(new Set(list.map((t) => t.replace(/^#/, "").toLowerCase())));
  }, [asset]);

  // Folder location resolution
  const folderDisplayName = React.useMemo(() => {
    if (asset.folderName) return asset.folderName;
    if (asset.smart?.suggestedFolder) {
      const cleaned = asset.smart.suggestedFolder
        .replace(/^Assets\//i, "")
        .replace(/\/+$/, "");
      if (cleaned) return cleaned;
    }
    if (asset.parents && asset.parents.length > 0) return "Drive Folder";
    return "My Drive";
  }, [asset.folderName, asset.smart?.suggestedFolder, asset.parents]);

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
          <div className="flex items-center gap-2 flex-wrap">
            <span
              onClick={() => onInspect(asset)}
              className="font-medium text-zinc-900 dark:text-zinc-100 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {asset.name}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
              {asset.extension}
            </span>
            {/* Folder badge */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onFolderClick) {
                  onFolderClick(folderDisplayName, asset.folderId);
                }
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-[11px] font-mono hover:bg-amber-500/20 transition-colors cursor-pointer"
              title={`Folder: ${folderDisplayName} (click to filter)`}
            >
              <Folder className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0 fill-amber-500/20" />
              <span className="truncate max-w-[140px]">{folderDisplayName}</span>
            </button>
            {asset.notes && (
              <span className="text-indigo-500 dark:text-indigo-400" title="Has Developer Notes">
                <StickyNote className="w-3.5 h-3.5" />
              </span>
            )}
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
      <div className="flex items-center gap-1.5 sm:gap-3 text-xs text-zinc-400 flex-shrink-0">
        <span className="tabular-nums w-18 text-right hidden sm:inline">
          {formatFileSize(asset.size)}
        </span>

        {isAudio && onPlayAudio && (
          <button
            type="button"
            onClick={() => onPlayAudio(asset)}
            className={`min-h-[40px] min-w-[40px] sm:min-h-[34px] sm:min-w-[34px] flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
              isPlaying
                ? "bg-indigo-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 hover:text-indigo-600"
            }`}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        )}

        {onToggleFavorite && (
          <button
            type="button"
            onClick={() => onToggleFavorite(asset)}
            className={`min-h-[40px] min-w-[40px] sm:min-h-[34px] sm:min-w-[34px] flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
              asset.isFavorite
                ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                : "text-zinc-400 hover:text-amber-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
            title={asset.isFavorite ? "Favorited (Stored in DB)" : "Mark Favorite"}
          >
            <Star className={`w-4 h-4 ${asset.isFavorite ? "fill-amber-500" : ""}`} />
          </button>
        )}

        <button
          type="button"
          onClick={() => onInspect(asset)}
          className="min-h-[40px] min-w-[40px] sm:min-h-[34px] sm:min-w-[34px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Inspect & Edit Tags"
        >
          <Info className="w-4 h-4" />
        </button>

        {asset.webViewLink && (
          <a
            href={asset.webViewLink}
            target="_blank"
            rel="noreferrer"
            className="min-h-[40px] min-w-[40px] sm:min-h-[34px] sm:min-w-[34px] hidden sm:flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Open in Drive"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
};
