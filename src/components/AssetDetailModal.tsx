import React, { useState } from "react";
import {
  X,
  Sparkles,
  Tag,
  Plus,
  Save,
  ExternalLink,
  FolderPlus,
  Play,
  Pause,
  Repeat,
  ZoomIn,
  ZoomOut,
  Folder,
  Check,
} from "lucide-react";
import { EnrichedAsset, AssetCategory, SmartMetadata } from "../types";
import { CATEGORIES, getCategoryInfo, formatFileSize } from "../data/categories";
import { updateDriveAssetMetadata, generateClientSmartMetadata } from "../services/driveService";
import { saveAssetToDb } from "../services/dbService";
import { Star, Database } from "lucide-react";

interface AssetDetailModalProps {
  asset: EnrichedAsset | null;
  onClose: () => void;
  onUpdateAsset: (updated: EnrichedAsset) => void;
  accessToken: string | null;
  userId?: string | null;
  onPlayAudio?: (asset: EnrichedAsset) => void;
  isPlayingAudio?: boolean;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  asset,
  onClose,
  onUpdateAsset,
  accessToken,
  userId,
  onPlayAudio,
  isPlayingAudio = false,
}) => {
  if (!asset) return null;

  const [currentCategory, setCurrentCategory] = useState<AssetCategory>(asset.category);
  const [tags, setTags] = useState<string[]>(() => {
    const list = [...asset.userTags, ...(asset.smart?.smartTags || [])];
    return Array.from(new Set(list.map((t) => t.replace(/^#/, "").toLowerCase())));
  });
  const [notes, setNotes] = useState<string>(asset.notes || "");
  const [isFavorite, setIsFavorite] = useState<boolean>(Boolean(asset.isFavorite));
  const [newTagInput, setNewTagInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [smartMeta, setSmartMeta] = useState<SmartMetadata | undefined>(asset.smart);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [pixelated, setPixelated] = useState<boolean>(true);

  const categoryInfo = getCategoryInfo(currentCategory);
  const isImage = currentCategory === "imagery" || currentCategory === "ui";
  const isAudio = currentCategory === "music" || currentCategory === "sound";

  // Image source resolution
  const imagePreviewSrc = React.useMemo(() => {
    if (asset.thumbnailLink) {
      return asset.thumbnailLink.replace(/=s\d+/, "=s800");
    }
    if (accessToken && isImage && !asset.id.startsWith("sample-")) {
      return `/api/drive-proxy/file/${asset.id}?token=${encodeURIComponent(accessToken)}`;
    }
    return null;
  }, [asset, accessToken, isImage]);

  const handleAddTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newTagInput.trim().replace(/^#/, "").toLowerCase();
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setNewTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Run Gemini Smart Analysis on this asset
  const handleRunAiAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/smart-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assets: [
            {
              id: asset.id,
              name: asset.name,
              mimeType: asset.mimeType,
              size: asset.size,
              description: asset.description,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const result = data.results?.[0];
        if (result) {
          setSmartMeta(result);
          setCurrentCategory(result.category as AssetCategory);
          // Merge newly generated smart tags with existing
          const merged = Array.from(new Set([...tags, ...result.smartTags]));
          setTags(merged);
        }
      } else {
        // Fallback for static hosts (GitHub Pages)
        const clientMeta = generateClientSmartMetadata(asset);
        setSmartMeta(clientMeta);
        setCurrentCategory(clientMeta.category);
        const merged = Array.from(new Set([...tags, ...clientMeta.smartTags]));
        setTags(merged);
      }
    } catch (err) {
      console.warn("AI analysis endpoint unavailable, using client fallback:", err);
      const clientMeta = generateClientSmartMetadata(asset);
      setSmartMeta(clientMeta);
      setCurrentCategory(clientMeta.category);
      const merged = Array.from(new Set([...tags, ...clientMeta.smartTags]));
      setTags(merged);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Save changes to Google Drive properties & local state
  const handleSaveMetadata = async () => {
    setIsSaving(true);
    try {
      if (accessToken && !asset.id.startsWith("sample-")) {
        await updateDriveAssetMetadata(accessToken, asset.id, {
          category: currentCategory,
          tags,
          smartMeta,
        });
      }

      // Update local asset state
      const updated: EnrichedAsset = {
        ...asset,
        category: currentCategory,
        userTags: tags,
        smart: smartMeta,
        notes,
        isFavorite,
        userId: userId || asset.userId,
        updatedAt: new Date().toISOString(),
      };

      // Persist to Cloud Firestore database if authenticated
      if (userId) {
        try {
          await saveAssetToDb(userId, updated);
        } catch (dbErr) {
          console.warn("Could not persist to Firestore:", dbErr);
        }
      }

      onUpdateAsset(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      alert(`Error saving metadata: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="asset-detail-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="asset-detail-modal-dialog"
        className="relative w-full sm:max-w-4xl bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md z-20">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span
              className={`text-xs font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border ${categoryInfo.bgLight} flex-shrink-0`}
            >
              {categoryInfo.label}
            </span>
            <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {asset.name}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              id="modal-toggle-favorite-button"
              type="button"
              onClick={() => setIsFavorite(!isFavorite)}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                isFavorite
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
                  : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              }`}
              title={isFavorite ? "Favorited (Stored in Database)" : "Mark as Favorite"}
            >
              <Star className={`w-4 h-4 ${isFavorite ? "fill-amber-500 text-amber-500" : ""}`} />
            </button>

            <button
              id="close-detail-modal-button"
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
          {/* Left Column: Asset Media Preview */}
          <div className="md:col-span-6 flex flex-col gap-3">
            <div className="relative w-full h-60 sm:h-80 bg-zinc-950 rounded-2xl border border-zinc-800 flex items-center justify-center overflow-hidden">
              {/* Alpha checkerboard pattern */}
              <div
                className="absolute inset-0 opacity-25 pointer-events-none"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg, #777 25%, transparent 25%), linear-gradient(-45deg, #777 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #777 75%), linear-gradient(-45deg, transparent 75%, #777 75%)",
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                }}
              />

              {isImage && imagePreviewSrc ? (
                <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
                  <img
                    src={imagePreviewSrc}
                    alt={asset.name}
                    className="max-h-full max-w-full object-contain transition-transform"
                    style={{
                      transform: `scale(${zoomLevel})`,
                      imageRendering: pixelated ? "pixelated" : "auto",
                    }}
                  />
                </div>
              ) : isAudio ? (
                <div className="flex flex-col items-center justify-center gap-4 z-10 text-center px-4">
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/20 text-violet-400 border border-violet-500/30 flex items-center justify-center">
                    <Repeat className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{asset.name}</h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {smartMeta?.moodStyle || "Game Audio Track"}
                    </p>
                  </div>

                  {onPlayAudio && (
                    <button
                      type="button"
                      onClick={() => onPlayAudio(asset)}
                      className="flex items-center gap-2 px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg transition-all active:scale-95 cursor-pointer"
                    >
                      {isPlayingAudio ? (
                        <>
                          <Pause className="w-4 h-4" />
                          <span>Pause Audio</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 ml-0.5" />
                          <span>Play Audio Track</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-zinc-500 z-10">
                  <Folder className="w-12 h-12 text-zinc-600" />
                  <span className="text-xs font-mono uppercase">
                    .{asset.extension} File
                  </span>
                </div>
              )}
            </div>

            {/* Visual zoom & pixel controls for sprites */}
            {isImage && (
              <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="tabular-nums font-mono">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(4, z + 0.25))}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={pixelated}
                    onChange={(e) => setPixelated(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Pixel-art crisp mode</span>
                </label>
              </div>
            )}

            {/* File Info Specs */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5 text-zinc-600 dark:text-zinc-400">
              <div className="flex justify-between">
                <span>File Size:</span>
                <strong className="text-zinc-800 dark:text-zinc-200 font-mono">
                  {formatFileSize(asset.size)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>MIME Type:</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-300 truncate max-w-xs">
                  {asset.mimeType}
                </span>
              </div>
              {asset.modifiedTime && (
                <div className="flex justify-between">
                  <span>Modified:</span>
                  <span>{new Date(asset.modifiedTime).toLocaleDateString()}</span>
                </div>
              )}
              {asset.webViewLink && (
                <div className="pt-1 border-t border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
                  <span>Google Drive:</span>
                  <a
                    href={asset.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 font-medium inline-flex items-center gap-1 hover:underline"
                  >
                    <span>Open in Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: AI Analysis, Smart Tags, Category */}
          <div className="md:col-span-6 flex flex-col gap-5">
            {/* Gemini Smart Analysis Header */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                    Gemini Smart Intelligence
                  </h4>
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-400">
                    Game asset classification & mood analysis
                  </p>
                </div>
              </div>

              <button
                id="run-gemini-analysis-button"
                type="button"
                onClick={handleRunAiAnalysis}
                disabled={isAnalyzing}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
                <span>{isAnalyzing ? "Analyzing..." : "Re-Analyze"}</span>
              </button>
            </div>

            {/* Smart Analysis Output */}
            {smartMeta && (
              <div className="space-y-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-xs">
                <div>
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Mood & Aesthetic Style
                  </span>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                    {smartMeta.moodStyle}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Recommended Game Engine Path
                  </span>
                  <p className="font-mono text-indigo-600 dark:text-indigo-400 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 mt-0.5 select-all">
                    {smartMeta.suggestedFolder}
                  </p>
                </div>

                {smartMeta.summary && (
                  <div>
                    <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Game Dev Summary
                    </span>
                    <p className="text-zinc-600 dark:text-zinc-300 mt-0.5 leading-relaxed">
                      {smartMeta.summary}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Category Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Asset Category
              </label>
              <select
                id="modal-category-select"
                value={currentCategory}
                onChange={(e) => setCurrentCategory(e.target.value as AssetCategory)}
                className="w-full min-h-[44px] px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label} ({cat.description.split(",")[0]})
                  </option>
                ))}
              </select>
            </div>

            {/* Smart Tags Manager */}
            <div className="space-y-2 flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Smart & Custom Tags ({tags.length})</span>
                </label>
              </div>

              {/* Tag Chips */}
              <div className="flex flex-wrap gap-1.5 min-h-12 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                {tags.length === 0 && (
                  <span className="text-xs text-zinc-400 italic">No tags added yet.</span>
                )}
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 min-h-[34px] px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium border border-zinc-200 dark:border-zinc-700 shadow-xs"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="min-h-[28px] min-w-[28px] flex items-center justify-center text-zinc-400 hover:text-rose-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Add New Tag Input */}
              <form onSubmit={handleAddTag} className="flex gap-2">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="Add custom tag (e.g. boss-battle, pixel)..."
                  className="flex-1 min-h-[44px] px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!newTagInput.trim()}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
              {/* Developer Notes (Persists in Cloud Firestore) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Developer Notes & Engine Specs</span>
                  </label>
                  {userId ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Cloud DB Active
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-400">
                      Sign in to sync with Cloud DB
                    </span>
                  )}
                </div>
                <textarea
                  id="asset-developer-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes for game devs: loop points, tile bounds, audio channel, licensing info, usage tips..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 resize-y"
                />
              </div>
            </div>

            {/* Modal Footer: Save changes */}
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
              {saveSuccess && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <Check className="w-4 h-4" /> Saved!
                </span>
              )}
              {!saveSuccess && <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Close
                </button>

                <button
                  id="save-asset-tags-button"
                  type="button"
                  onClick={handleSaveMetadata}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? "Saving..." : "Save to Database"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
