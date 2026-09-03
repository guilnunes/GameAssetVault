import React, { useState, useEffect, useMemo, useCallback } from "react";
import { User } from "firebase/auth";
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  setAccessToken,
} from "./services/authService";
import {
  fetchDriveFiles,
  fetchDriveFolders,
  generateClientSmartMetadata,
} from "./services/driveService";
import { SAMPLE_GAME_ASSETS } from "./data/sampleAssets";
import { CATEGORIES, getCategoryInfo } from "./data/categories";
import {
  EnrichedAsset,
  SearchFilterState,
  SmartSearchResponse,
  AssetCategory,
} from "./types";
import { Navbar } from "./components/Navbar";
import { SearchBar } from "./components/SearchBar";
import { CategoryFilter } from "./components/CategoryFilter";
import { AssetCard } from "./components/AssetCard";
import { AssetRow } from "./components/AssetRow";
import { AudioPlayerBar } from "./components/AudioPlayerBar";
import { AssetDetailModal } from "./components/AssetDetailModal";
import { OrganizeModal } from "./components/OrganizeModal";
import {
  Folder,
  Sparkles,
  Layers,
  HardDrive,
  RefreshCw,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [assets, setAssets] = useState<EnrichedAsset[]>(SAMPLE_GAME_ASSETS);
  const [isSampleMode, setIsSampleMode] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isBatchTagging, setIsBatchTagging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Folder navigation
  const [driveFolders, setDriveFolders] = useState<
    { id: string; name: string }[]
  >([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");

  // Interaction modals & audio
  const [activeAudio, setActiveAudio] = useState<EnrichedAsset | null>(null);
  const [inspectAsset, setInspectAsset] = useState<EnrichedAsset | null>(null);
  const [isOrganizeOpen, setIsOrganizeOpen] = useState(false);

  // Filter & search state
  const [filters, setFilters] = useState<SearchFilterState>({
    searchQuery: "",
    category: "all",
    selectedTags: [],
    extension: "all",
    folderId: "all",
    sortBy: "name",
    sortOrder: "asc",
    viewMode: "grid",
  });

  // Initialize Auth state listener on app load
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setToken(token);
        setIsSampleMode(false);
      },
      () => {
        // Fallback to sample mode if not authenticated
        setUser(null);
        setToken(null);
        setIsSampleMode(true);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Scan user's Google Drive files
  const scanDriveFiles = useCallback(
    async (token: string, folderId: string = "all") => {
      setIsScanning(true);
      setErrorMsg(null);
      try {
        const files = await fetchDriveFiles(token, {
          parentFolderId: folderId,
        });

        if (files.length === 0) {
          // Keep sample assets available as reference if user's Drive has no game assets
          setErrorMsg(
            "No game assets found in this Google Drive folder. Showing sample game assets for reference."
          );
          setAssets(SAMPLE_GAME_ASSETS);
          setIsSampleMode(true);
        } else {
          setAssets(files);
          setIsSampleMode(false);
        }

        // Also fetch user's top-level folders for browsing
        try {
          const folders = await fetchDriveFolders(token);
          setDriveFolders(folders);
        } catch {
          // ignore folder list failure
        }
      } catch (err: any) {
        console.error("Failed to scan Google Drive:", err);
        setErrorMsg(err.message || "Failed to scan Google Drive files");
      } finally {
        setIsScanning(false);
      }
    },
    []
  );

  // Handle Google Sign In
  const handleSignIn = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setAccessToken(result.accessToken);
        setIsSampleMode(false);
        await scanDriveFiles(result.accessToken, "all");
      }
    } catch (err: any) {
      console.error("Sign in failed:", err);
      setErrorMsg("Failed to sign in with Google: " + (err.message || ""));
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setAssets(SAMPLE_GAME_ASSETS);
    setIsSampleMode(true);
    setActiveAudio(null);
  };

  // Batch Auto-Tag untagged assets with Gemini AI
  const handleBatchAutoTag = async () => {
    setIsBatchTagging(true);
    try {
      // Find assets that haven't been tagged yet or need deeper AI tags
      const untagged = assets.filter(
        (a) => !a.smart || a.smart.smartTags.length === 0
      );
      const batchToProcess = (untagged.length > 0 ? untagged : assets).slice(
        0,
        10
      );

      const res = await fetch("/api/smart-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assets: batchToProcess.map((a) => ({
            id: a.id,
            name: a.name,
            mimeType: a.mimeType,
            size: a.size,
            description: a.description,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const resultsMap = new Map<string, any>();
        (data.results || []).forEach((r: any) => resultsMap.set(r.id, r));

        setAssets((prev) =>
          prev.map((item) => {
            const aiData = resultsMap.get(item.id);
            if (aiData) {
              return {
                ...item,
                category: aiData.category as AssetCategory,
                smart: aiData,
                userTags: Array.from(
                  new Set([...item.userTags, ...aiData.smartTags])
                ),
              };
            }
            return item;
          })
        );
      } else {
        // Fallback for static environments (e.g. GitHub Pages) without an Express server
        setAssets((prev) =>
          prev.map((item) => {
            const meta = generateClientSmartMetadata(item);
            return {
              ...item,
              category: meta.category,
              smart: meta,
              userTags: Array.from(new Set([...item.userTags, ...meta.smartTags])),
            };
          })
        );
      }
    } catch (err: any) {
      console.warn("Backend auto-tag unavailable, using client-side smart categorizer:", err);
      // Fallback for static host / offline
      setAssets((prev) =>
        prev.map((item) => {
          const meta = generateClientSmartMetadata(item);
          return {
            ...item,
            category: meta.category,
            smart: meta,
            userTags: Array.from(new Set([...item.userTags, ...meta.smartTags])),
          };
        })
      );
    } finally {
      setIsBatchTagging(false);
    }
  };

  // Handle Smart Search parsed from Gemini NLP
  const handleSmartSearchParsed = (smartData: SmartSearchResponse) => {
    if (smartData.categories.length === 1) {
      const cat = smartData.categories[0] as AssetCategory;
      if (CATEGORIES.some((c) => c.id === cat)) {
        setFilters((f) => ({ ...f, category: cat }));
      }
    }
  };

  // Update single asset metadata (from detail modal)
  const handleUpdateAsset = (updated: EnrichedAsset) => {
    setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    if (inspectAsset?.id === updated.id) {
      setInspectAsset(updated);
    }
  };

  // Filtered & Sorted Assets
  const filteredAssets = useMemo(() => {
    return assets
      .filter((asset) => {
        // Category filter
        if (filters.category !== "all" && asset.category !== filters.category) {
          return false;
        }

        // Extension filter
        if (
          filters.extension !== "all" &&
          asset.extension !== filters.extension
        ) {
          return false;
        }

        // Selected tags filter (AND logic)
        if (filters.selectedTags.length > 0) {
          const assetTags = [
            ...asset.userTags,
            ...(asset.smart?.smartTags || []),
          ].map((t) => t.replace(/^#/, "").toLowerCase());

          const hasAll = filters.selectedTags.every((t) =>
            assetTags.includes(t.toLowerCase())
          );
          if (!hasAll) return false;
        }

        // Search query filter
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase().trim();
          const cleanQ = q.replace(/^#/, "");

          const matchName = asset.name.toLowerCase().includes(q);
          const matchCategory = asset.category.toLowerCase().includes(q);
          const matchMood = asset.smart?.moodStyle?.toLowerCase().includes(q);
          const matchSummary = asset.smart?.summary?.toLowerCase().includes(q);
          const matchFolder = asset.smart?.suggestedFolder
            ?.toLowerCase()
            .includes(q);
          const matchTags = [
            ...asset.userTags,
            ...(asset.smart?.smartTags || []),
          ].some((t) => t.toLowerCase().includes(cleanQ));

          if (
            !matchName &&
            !matchCategory &&
            !matchMood &&
            !matchSummary &&
            !matchFolder &&
            !matchTags
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const factor = filters.sortOrder === "asc" ? 1 : -1;
        switch (filters.sortBy) {
          case "name":
            return factor * a.name.localeCompare(b.name);
          case "modifiedTime":
            return (
              factor *
              (new Date(a.modifiedTime || 0).getTime() -
                new Date(b.modifiedTime || 0).getTime())
            );
          case "size":
            return (
              factor *
              (parseInt(a.size || "0", 10) - parseInt(b.size || "0", 10))
            );
          case "category":
            return factor * a.category.localeCompare(b.category);
          default:
            return 0;
        }
      });
  }, [assets, filters]);

  // Category counts breakdown
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    assets.forEach((a) => {
      stats[a.category] = (stats[a.category] || 0) + 1;
    });
    return stats;
  }, [assets]);

  return (
    <div
      id="game-asset-organizer-app"
      className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors pb-24"
    >
      {/* Navbar */}
      <Navbar
        user={user}
        isConnectedToDrive={Boolean(user && accessToken)}
        isScanning={isScanning}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onScanDrive={() =>
          accessToken && scanDriveFiles(accessToken, selectedFolderId)
        }
        onOpenOrganize={() => setIsOrganizeOpen(true)}
        onBatchAutoTag={handleBatchAutoTag}
        isBatchTagging={isBatchTagging}
        isSampleMode={isSampleMode}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Sample Mode / Drive Connect Banner */}
        {isSampleMode && !user && (
          <div
            id="drive-connect-prompt-banner"
            className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-900/90 via-violet-900/90 to-purple-900/90 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-indigo-700/50"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Interactive Demo
                </span>
                <h2 className="text-base font-bold">
                  Game Development Asset Library
                </h2>
              </div>
              <p className="text-xs text-indigo-100/90 max-w-2xl leading-relaxed">
                Currently showcasing curated game development assets (sprites,
                looping audio, foley SFX, UI frames, 3D low-poly models).
                Connect your Google Drive account above to automatically scan,
                tag, and organize your own game assets!
              </p>
            </div>

            <button
              type="button"
              onClick={handleSignIn}
              className="px-5 py-2.5 rounded-xl bg-white text-zinc-900 hover:bg-zinc-100 font-semibold text-xs shadow-md transition-all whitespace-nowrap cursor-pointer"
            >
              Connect My Google Drive
            </button>
          </div>
        )}

        {/* Error notification banner */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-xs underline hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Drive Folder Selector (when connected) */}
        {user && driveFolders.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 overflow-x-auto pb-1">
            <span className="font-semibold text-zinc-400 flex items-center gap-1">
              <FolderOpen className="w-3.5 h-3.5" /> Drive Folder:
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedFolderId("all");
                if (accessToken) scanDriveFiles(accessToken, "all");
              }}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                selectedFolderId === "all"
                  ? "bg-indigo-600 text-white font-medium"
                  : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              Entire Google Drive
            </button>
            {driveFolders.slice(0, 8).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setSelectedFolderId(f.id);
                  if (accessToken) scanDriveFiles(accessToken, f.id);
                }}
                className={`px-2.5 py-1 rounded-lg transition-colors truncate max-w-44 ${
                  selectedFolderId === f.id
                    ? "bg-indigo-600 text-white font-medium"
                    : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
                title={f.name}
              >
                {f.name}
              </button>
            ))}
          </div>
        )}

        {/* Search & NLP Section */}
        <SearchBar
          filters={filters}
          onFilterChange={setFilters}
          onSmartSearchParsed={handleSmartSearchParsed}
          totalCount={assets.length}
          filteredCount={filteredAssets.length}
        />

        {/* Category & Smart Tags Filtering Section */}
        <CategoryFilter
          filters={filters}
          onFilterChange={setFilters}
          assets={assets}
        />

        {/* Assets Grid or Table View */}
        {filteredAssets.length === 0 ? (
          <div
            id="empty-asset-state"
            className="py-16 text-center space-y-3 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-6"
          >
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mx-auto flex items-center justify-center">
              <Folder className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              No game assets match your current filter
            </h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Try resetting your search query, clearing active smart tags, or
              selecting "All Game Assets".
            </p>
            <button
              type="button"
              onClick={() =>
                setFilters({
                  ...filters,
                  category: "all",
                  selectedTags: [],
                  extension: "all",
                  searchQuery: "",
                })
              }
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : filters.viewMode === "grid" ? (
          <div
            id="game-assets-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5"
          >
            {filteredAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                isPlaying={activeAudio?.id === asset.id}
                onPlayAudio={(a) => setActiveAudio(a)}
                onInspect={(a) => setInspectAsset(a)}
                onTagClick={(tag) => {
                  if (!filters.selectedTags.includes(tag)) {
                    setFilters({
                      ...filters,
                      selectedTags: [...filters.selectedTags, tag],
                    });
                  }
                }}
                accessToken={accessToken}
              />
            ))}
          </div>
        ) : (
          <div id="game-assets-list" className="space-y-2">
            {filteredAssets.map((asset) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                isPlaying={activeAudio?.id === asset.id}
                onPlayAudio={(a) => setActiveAudio(a)}
                onInspect={(a) => setInspectAsset(a)}
                onTagClick={(tag) => {
                  if (!filters.selectedTags.includes(tag)) {
                    setFilters({
                      ...filters,
                      selectedTags: [...filters.selectedTags, tag],
                    });
                  }
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* Persistent Audio Player Bar */}
      <AudioPlayerBar
        asset={activeAudio}
        accessToken={accessToken}
        onClose={() => setActiveAudio(null)}
      />

      {/* Asset Inspector & Tag Editor Modal */}
      <AssetDetailModal
        asset={inspectAsset}
        onClose={() => setInspectAsset(null)}
        onUpdateAsset={handleUpdateAsset}
        accessToken={accessToken}
        onPlayAudio={(a) => setActiveAudio(a)}
        isPlayingAudio={activeAudio?.id === inspectAsset?.id}
      />

      {/* Google Drive Folder Organization Modal */}
      <OrganizeModal
        isOpen={isOrganizeOpen}
        onClose={() => setIsOrganizeOpen(false)}
        assets={assets}
        accessToken={accessToken}
        onOrganizeComplete={() => {
          if (accessToken) scanDriveFiles(accessToken, selectedFolderId);
        }}
      />
    </div>
  );
}
