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
  isGameAsset,
} from "./services/driveService";
import {
  loadUserAssetsFromDb,
  batchSaveAssetsToDb,
  saveAssetToDb,
  toggleFavoriteInDb,
  loadUserPreferences,
  saveUserPreferences,
} from "./services/dbService";
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
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [dbAssetCount, setDbAssetCount] = useState<number>(0);
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
    onlyFavorites: false,
  });

  // Load user data & preferences from Cloud Firestore
  const loadUserDataFromDb = useCallback(
    async (uid: string, token: string | null) => {
      setIsDbLoading(true);
      try {
        // 1. Load preferences
        const prefs = await loadUserPreferences(uid);
        if (prefs) {
          setFilters((f) => ({
            ...f,
            viewMode: prefs.defaultViewMode || f.viewMode,
            sortBy: prefs.defaultSortBy || f.sortBy,
          }));
          if (prefs.savedFolders && prefs.savedFolders.length > 0) {
            setDriveFolders(prefs.savedFolders);
          }
        }

        // 2. Load stored assets from Cloud Firestore
        const dbAssets = await loadUserAssetsFromDb(uid);
        const validGameAssets = dbAssets ? dbAssets.filter(isGameAsset) : [];
        if (validGameAssets.length > 0) {
          setAssets(validGameAssets);
          setIsSampleMode(false);
          setDbAssetCount(validGameAssets.length);
        } else if (token) {
          // If Firestore is empty for this user, automatically scan their Google Drive
          await scanDriveFiles(token, "all", uid);
        } else {
          setAssets(SAMPLE_GAME_ASSETS);
          setIsSampleMode(true);
        }
      } catch (dbErr) {
        console.warn("Could not load assets from Firestore:", dbErr);
      } finally {
        setIsDbLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Scan user's Google Drive files and persist to Firestore
  const scanDriveFiles = useCallback(
    async (token: string, folderId: string = "all", uid?: string) => {
      setIsScanning(true);
      setErrorMsg(null);
      try {
        // Fetch files and folders concurrently so we can resolve parent folder names
        const [files, folders] = await Promise.all([
          fetchDriveFiles(token, { parentFolderId: folderId }),
          fetchDriveFolders(token).catch(() => []),
        ]);

        if (folders.length > 0) {
          setDriveFolders(folders);
          const currentUid = uid || user?.uid;
          if (currentUid) {
            saveUserPreferences(currentUid, { savedFolders: folders }).catch(() => {});
          }
        }

        const folderMap = new Map<string, string>(
          folders.map((f): [string, string] => [f.id, f.name])
        );

        if (files.length === 0) {
          setErrorMsg(
            "No game assets (.png, .wav, .mp3, .fbx, etc.) found in this Google Drive folder. Showing sample game assets for preview."
          );
          setAssets(SAMPLE_GAME_ASSETS);
          setIsSampleMode(true);
        } else {
          // Merge newly scanned files with existing state to preserve local/custom notes, favorites, and folder names
          setAssets((prev) => {
            const existingMap = new Map<string, EnrichedAsset>(
              prev.map((p) => [p.id, p])
            );
            const merged = files.map((file) => {
              const existing = existingMap.get(file.id);
              const parentId = file.parents?.[0] || (folderId !== "all" ? folderId : undefined);
              const resolvedFolderName =
                file.folderName ||
                (parentId ? folderMap.get(parentId) : undefined) ||
                existing?.folderName;

              if (existing) {
                return {
                  ...file,
                  folderName: resolvedFolderName,
                  folderId: parentId || existing.folderId,
                  isFavorite: existing.isFavorite,
                  notes: existing.notes,
                  userTags: Array.from(
                    new Set([...file.userTags, ...existing.userTags])
                  ),
                  smart: file.smart || existing.smart,
                };
              }
              return {
                ...file,
                folderName: resolvedFolderName,
                folderId: parentId,
              };
            });

            const targetUid = uid || user?.uid;
            if (targetUid) {
              batchSaveAssetsToDb(targetUid, merged).catch((err) =>
                console.warn("Could not persist assets to Firestore:", err)
              );
              setDbAssetCount(merged.length);
            }

            return merged;
          });
          setIsSampleMode(false);
        }
      } catch (err: any) {
        console.error("Failed to scan Google Drive:", err);
        setErrorMsg(err.message || "Failed to scan Google Drive files");
      } finally {
        setIsScanning(false);
      }
    },
    [user?.uid]
  );

  // Initialize Auth state listener on app load
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setToken(token);
        setIsSampleMode(false);
        if (currentUser) {
          loadUserDataFromDb(currentUser.uid, token);
        }
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
  }, [loadUserDataFromDb]);

  // Handle Google Sign In
  const handleSignIn = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setAccessToken(result.accessToken);
        setIsSampleMode(false);
        await loadUserDataFromDb(result.user.uid, result.accessToken);
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

  // Batch Auto-Tag untagged assets with Gemini AI & save to Firestore
  const handleBatchAutoTag = async () => {
    setIsBatchTagging(true);
    try {
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

        setAssets((prev) => {
          const updated = prev.map((item) => {
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
          });

          if (user?.uid) {
            batchSaveAssetsToDb(user.uid, updated).catch(console.warn);
          }
          return updated;
        });
      } else {
        // Fallback for static environments without an Express server
        setAssets((prev) => {
          const updated = prev.map((item) => {
            const meta = generateClientSmartMetadata(item);
            return {
              ...item,
              category: meta.category,
              smart: meta,
              userTags: Array.from(
                new Set([...item.userTags, ...meta.smartTags])
              ),
            };
          });
          if (user?.uid) {
            batchSaveAssetsToDb(user.uid, updated).catch(console.warn);
          }
          return updated;
        });
      }
    } catch (err: any) {
      console.warn(
        "Backend auto-tag unavailable, using client-side smart categorizer:",
        err
      );
      setAssets((prev) => {
        const updated = prev.map((item) => {
          const meta = generateClientSmartMetadata(item);
          return {
            ...item,
            category: meta.category,
            smart: meta,
            userTags: Array.from(
              new Set([...item.userTags, ...meta.smartTags])
            ),
          };
        });
        if (user?.uid) {
          batchSaveAssetsToDb(user.uid, updated).catch(console.warn);
        }
        return updated;
      });
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

  // Handle filter changes and persist user preferences
  const handleFilterChange = (newFilters: SearchFilterState) => {
    setFilters(newFilters);
    if (
      user?.uid &&
      (newFilters.viewMode !== filters.viewMode ||
        newFilters.sortBy !== filters.sortBy)
    ) {
      saveUserPreferences(user.uid, {
        defaultViewMode: newFilters.viewMode,
        defaultSortBy: newFilters.sortBy,
      }).catch((err) => console.warn("Could not save preferences:", err));
    }
  };

  // Handle clicking on a folder badge on any asset card or row
  const handleFolderClick = (folderName: string, folderId?: string) => {
    if (folderId && driveFolders.some((f) => f.id === folderId)) {
      setSelectedFolderId(folderId);
      if (accessToken) {
        scanDriveFiles(accessToken, folderId);
      }
      return;
    }
    const matched = driveFolders.find(
      (f) =>
        f.name.toLowerCase() === folderName.toLowerCase() ||
        folderName.toLowerCase().includes(f.name.toLowerCase())
    );
    if (matched) {
      setSelectedFolderId(matched.id);
      if (accessToken) {
        scanDriveFiles(accessToken, matched.id);
      }
      return;
    }
    // Filter locally via search query if not directly a root Drive folder
    setFilters((prev) => ({
      ...prev,
      searchQuery: folderName,
    }));
  };

  // Toggle favorite with Firestore persistence
  const handleToggleFavorite = async (asset: EnrichedAsset) => {
    const nextFavorite = !asset.isFavorite;
    const updated: EnrichedAsset = {
      ...asset,
      isFavorite: nextFavorite,
      updatedAt: new Date().toISOString(),
    };

    setAssets((prev) => prev.map((a) => (a.id === asset.id ? updated : a)));
    if (inspectAsset?.id === asset.id) {
      setInspectAsset(updated);
    }

    if (user?.uid) {
      try {
        await toggleFavoriteInDb(user.uid, asset.id, nextFavorite);
      } catch (err) {
        console.warn("Could not persist favorite toggle:", err);
      }
    }
  };

  // Update single asset metadata (from detail modal) with Firestore persistence
  const handleUpdateAsset = async (updated: EnrichedAsset) => {
    setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    if (inspectAsset?.id === updated.id) {
      setInspectAsset(updated);
    }

    if (user?.uid) {
      try {
        await saveAssetToDb(user.uid, updated);
      } catch (err) {
        console.warn("Could not save updated asset to Firestore:", err);
      }
    }
  };

  // Filtered & Sorted Assets
  const filteredAssets = useMemo(() => {
    return assets
      .filter((asset) => {
        // Only favorites filter
        if (filters.onlyFavorites && !asset.isFavorite) {
          return false;
        }

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

        // Drive folder filter (selected from top folder bar)
        if (selectedFolderId !== "all") {
          const selectedFolder = driveFolders.find((f) => f.id === selectedFolderId);
          const selectedFolderName = selectedFolder?.name?.toLowerCase();

          const matchesId =
            asset.folderId === selectedFolderId ||
            (asset.parents && asset.parents.includes(selectedFolderId));
          const matchesName =
            selectedFolderName &&
            asset.folderName?.toLowerCase() === selectedFolderName;

          if (!matchesId && !matchesName) {
            return false;
          }
        }

        // Search query filter
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase().trim();
          const cleanQ = q.replace(/^#/, "");

          const matchName = asset.name.toLowerCase().includes(q);
          const matchCategory = asset.category.toLowerCase().includes(q);
          const matchMood = asset.smart?.moodStyle?.toLowerCase().includes(q);
          const matchSummary = asset.smart?.summary?.toLowerCase().includes(q);
          const matchFolder =
            asset.folderName?.toLowerCase().includes(q) ||
            asset.smart?.suggestedFolder?.toLowerCase().includes(q);
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
  }, [assets, filters, selectedFolderId, driveFolders]);

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
      className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors pb-28 sm:pb-24"
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
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
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-white text-zinc-900 hover:bg-zinc-100 font-semibold text-xs shadow-md transition-all whitespace-nowrap cursor-pointer text-center"
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
          <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 overflow-x-auto pb-1 no-scrollbar">
            <span className="font-semibold text-zinc-400 flex items-center gap-1 flex-shrink-0">
              <FolderOpen className="w-3.5 h-3.5" /> Drive Folder:
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedFolderId("all");
                if (accessToken) scanDriveFiles(accessToken, "all");
              }}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
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
                className={`min-h-[36px] px-3 py-1.5 rounded-lg transition-colors truncate max-w-44 whitespace-nowrap flex-shrink-0 ${
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
          onFilterChange={handleFilterChange}
          onSmartSearchParsed={handleSmartSearchParsed}
          totalCount={assets.length}
          filteredCount={filteredAssets.length}
        />

        {/* Category & Smart Tags Filtering Section */}
        <CategoryFilter
          filters={filters}
          onFilterChange={handleFilterChange}
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
                handleFilterChange({
                  ...filters,
                  category: "all",
                  selectedTags: [],
                  extension: "all",
                  searchQuery: "",
                  onlyFavorites: false,
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
                onToggleFavorite={handleToggleFavorite}
                onFolderClick={handleFolderClick}
                onTagClick={(tag) => {
                  if (!filters.selectedTags.includes(tag)) {
                    handleFilterChange({
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
                onToggleFavorite={handleToggleFavorite}
                onFolderClick={handleFolderClick}
                onTagClick={(tag) => {
                  if (!filters.selectedTags.includes(tag)) {
                    handleFilterChange({
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
        userId={user?.uid}
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
