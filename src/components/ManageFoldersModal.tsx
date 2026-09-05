import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Folder,
  Star,
  Search,
  Plus,
  X,
  Zap,
  Globe,
  RefreshCw,
  Check,
  FolderPlus,
  AlertCircle,
  FolderOpen,
  HardDrive,
  ChevronRight,
  ChevronLeft,
  Copy,
  Layers,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  createDriveFolder,
  fetchDriveFolders,
  fetchFolderDetails,
} from "../services/driveService";
import { DriveFolderItem } from "../types";

interface BreadcrumbItem {
  id: string;
  name: string;
  path: string;
  segments: string[];
}

interface ManageFoldersModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: DriveFolderItem[];
  importantFolderIds: string[];
  scanScope: "important" | "all";
  onUpdateImportantFolders: (newImportantIds: string[]) => void;
  onUpdateScanScope: (newScope: "important" | "all") => void;
  accessToken?: string | null;
  onRefreshFolders?: () => void;
  onScanNow?: (folderIdsToScan: string[]) => void;
  isScanning?: boolean;
}

export const ManageFoldersModal: React.FC<ManageFoldersModalProps> = ({
  isOpen,
  onClose,
  folders,
  importantFolderIds,
  scanScope,
  onUpdateImportantFolders,
  onUpdateScanScope,
  accessToken,
  onRefreshFolders,
  onScanNow,
  isScanning = false,
}) => {
  // Navigation & breadcrumb state
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: "root", name: "My Drive", path: "My Drive", segments: ["My Drive"] },
  ]);
  const currentFolder = breadcrumbs[breadcrumbs.length - 1] || {
    id: "root",
    name: "My Drive",
    path: "My Drive",
    segments: ["My Drive"],
  };

  const [activeTab, setActiveTab] = useState<"browse" | "starred">("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DriveFolderItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Dynamic folder cache: parentId -> DriveFolderItem[]
  const [folderCache, setFolderCache] = useState<Record<string, DriveFolderItem[]>>({});
  const [isLoadingFolder, setIsLoadingFolder] = useState(false);
  const [folderLoadError, setFolderLoadError] = useState<string | null>(null);

  // Map of all known folders (for quick lookups, starred tab, etc.)
  const [knownFoldersMap, setKnownFoldersMap] = useState<Map<string, DriveFolderItem>>(
    () => new Map<string, DriveFolderItem>()
  );

  // Create folder form state
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<string>("root");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folderCreateError, setFolderCreateError] = useState<string | null>(null);
  const [folderCreateSuccess, setFolderCreateSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Local state copy for responsive updates
  const [selectedIds, setSelectedIds] = useState<string[]>(importantFolderIds);
  const [selectedScope, setSelectedScope] = useState<"important" | "all">(scanScope);

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Pre-seed knownFoldersMap with passed props
  useEffect(() => {
    setKnownFoldersMap((prev) => {
      const next = new Map(prev);
      for (const f of folders) {
        if (!next.has(f.id)) next.set(f.id, f);
      }
      return next;
    });
  }, [folders]);

  // Sync state when modal opens or props update
  useEffect(() => {
    setSelectedIds(importantFolderIds);
    setSelectedScope(scanScope);
    if (isOpen) {
      setBreadcrumbs([
        { id: "root", name: "My Drive", path: "My Drive", segments: ["My Drive"] },
      ]);
      setSearchQuery("");
      setSearchResults([]);
      setActiveTab("browse");
      setFolderLoadError(null);
    }
  }, [importantFolderIds, scanScope, isOpen]);

  // Fetch folders for a specific parent directory
  const loadFolderChildren = useCallback(
    async (parentId: string, parentPath: string, parentSegments: string[]) => {
      if (!accessToken) {
        // Sample Mode: filter folders from sample data where parent is parentId
        const sampleChildren = folders.filter((f) => {
          if (parentId === "root") {
            return !f.parents || f.parents.length === 0 || f.parents.includes("root");
          }
          return f.parents && f.parents.includes(parentId);
        });

        setFolderCache((prev) => ({
          ...prev,
          [parentId]: sampleChildren,
        }));
        return;
      }

      setIsLoadingFolder(true);
      setFolderLoadError(null);

      try {
        const items = await fetchDriveFolders(accessToken, {
          parentId,
          parentPath,
          parentSegments,
        });

        // Cache children for this parent
        setFolderCache((prev) => ({
          ...prev,
          [parentId]: items,
        }));

        // Add to known folders map
        setKnownFoldersMap((prev) => {
          const next = new Map(prev);
          for (const item of items) {
            next.set(item.id, item);
          }
          return next;
        });
      } catch (err: any) {
        setFolderLoadError(
          err.message || "Failed to load folders from Google Drive"
        );
      } finally {
        setIsLoadingFolder(false);
      }
    },
    [accessToken, folders]
  );

  // Trigger loading when entering a folder if not cached
  useEffect(() => {
    if (!isOpen) return;

    const parentId = currentFolder.id;
    if (!folderCache[parentId]) {
      loadFolderChildren(parentId, currentFolder.path, currentFolder.segments);
    }
  }, [isOpen, currentFolder.id, currentFolder.path, currentFolder.segments, folderCache, loadFolderChildren]);

  // Fetch details for any starred folders that might not be in knownFoldersMap yet
  useEffect(() => {
    if (!isOpen || !accessToken || selectedIds.length === 0) return;

    const missingIds = selectedIds.filter((id) => !knownFoldersMap.has(id));
    if (missingIds.length === 0) return;

    // Fetch details in background
    Promise.allSettled(
      missingIds.slice(0, 10).map((id) => fetchFolderDetails(accessToken, id))
    ).then((results) => {
      setKnownFoldersMap((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const res of results) {
          if (res.status === "fulfilled" && res.value) {
            next.set(res.value.id, res.value);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });
  }, [isOpen, accessToken, selectedIds, knownFoldersMap]);

  // Sync new folder default parent location with currently viewed directory
  useEffect(() => {
    setNewFolderParentId(currentFolder.id);
  }, [currentFolder.id]);

  // Debounced search across Google Drive
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      const q = searchQuery.trim().toLowerCase();

      if (!accessToken) {
        // Local search in sample mode
        const matched = folders.filter((f) =>
          f.name.toLowerCase().includes(q) || (f.path || "").toLowerCase().includes(q)
        );
        setSearchResults(matched);
        setIsSearching(false);
        return;
      }

      try {
        const results = await fetchDriveFolders(accessToken, {
          searchQuery: searchQuery.trim(),
        });
        setSearchResults(results);

        setKnownFoldersMap((prev) => {
          const next = new Map(prev);
          for (const item of results) {
            next.set(item.id, item);
          }
          return next;
        });
      } catch {
        // Fallback to searching known folders
        const fallback = Array.from(knownFoldersMap.values()).filter(
          (f: DriveFolderItem) => f.name.toLowerCase().includes(q)
        );
        setSearchResults(fallback);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchQuery, accessToken, folders, knownFoldersMap]);

  // Folders to display at current directory
  const currentLevelFolders = useMemo(() => {
    const list = folderCache[currentFolder.id] || [];
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [folderCache, currentFolder.id]);

  // Starred folders list
  const starredFoldersList = useMemo(() => {
    return selectedIds
      .map((id) => {
        return (
          knownFoldersMap.get(id) || {
            id,
            name: `Folder (${id.slice(0, 8)}...)`,
            path: `My Drive / ...`,
            pathSegments: ["My Drive", "..."],
          }
        );
      })
      .sort((a, b) =>
        (a.path || a.name).localeCompare(b.path || b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );
  }, [selectedIds, knownFoldersMap]);

  // Navigate deeper into a folder
  const handleOpenFolder = (folder: DriveFolderItem) => {
    const nextPath = folder.path || `${currentFolder.path} / ${folder.name}`;
    const nextSegments = folder.pathSegments || [
      ...currentFolder.segments,
      folder.name,
    ];

    setBreadcrumbs((prev) => [
      ...prev,
      {
        id: folder.id,
        name: folder.name,
        path: nextPath,
        segments: nextSegments,
      },
    ]);

    if (searchQuery) {
      setSearchQuery("");
      setSearchResults([]);
    }
    if (activeTab === "starred") {
      setActiveTab("browse");
    }
  };

  // Jump to specific breadcrumb
  const handleBreadcrumbClick = (index: number) => {
    if (index === breadcrumbs.length - 1) return;
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    if (searchQuery) {
      setSearchQuery("");
      setSearchResults([]);
    }
    if (activeTab === "starred") {
      setActiveTab("browse");
    }
  };

  // Go up one level
  const handleGoUp = () => {
    if (breadcrumbs.length <= 1) return;
    setBreadcrumbs((prev) => prev.slice(0, -1));
  };

  const toggleFolder = (folderId: string, folderItem?: DriveFolderItem) => {
    setSelectedIds((prev) => {
      const next = prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId];
      onUpdateImportantFolders(next);
      return next;
    });

    if (folderItem) {
      setKnownFoldersMap((prev) => new Map(prev).set(folderItem.id, folderItem));
    }
  };

  const handleScopeChange = (scope: "important" | "all") => {
    setSelectedScope(scope);
    onUpdateScanScope(scope);
  };

  const handleCopyPath = (e: React.MouseEvent, path: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !accessToken) return;

    setIsCreatingFolder(true);
    setFolderCreateError(null);
    setFolderCreateSuccess(null);

    try {
      const parentIdArg =
        newFolderParentId === "root" ? undefined : newFolderParentId;
      const created = await createDriveFolder(
        accessToken,
        newFolderName.trim(),
        parentIdArg
      );

      // Determine parent info
      const parentCrumb = breadcrumbs.find((b) => b.id === newFolderParentId);
      const parentPath = parentCrumb?.path || "My Drive";
      const parentSegments = parentCrumb?.segments || ["My Drive"];

      const newFolderItem: DriveFolderItem = {
        id: created.id,
        name: created.name,
        parents: created.parents || [newFolderParentId],
        path: `${parentPath} / ${created.name}`,
        pathSegments: [...parentSegments, created.name],
      };

      // Add to known folders map
      setKnownFoldersMap((prev) => new Map(prev).set(created.id, newFolderItem));

      // Append to active cache if in that directory
      setFolderCache((prev) => {
        const existing = prev[newFolderParentId] || [];
        return {
          ...prev,
          [newFolderParentId]: [...existing, newFolderItem],
        };
      });

      // Automatically mark newly created folder as important
      const next = [...selectedIds, created.id];
      setSelectedIds(next);
      onUpdateImportantFolders(next);

      setFolderCreateSuccess(
        `Created "${created.name}" in "${parentPath}" and marked as Important!`
      );
      setNewFolderName("");

      if (onRefreshFolders) {
        onRefreshFolders();
      }
    } catch (err: any) {
      setFolderCreateError(
        err.message || "Failed to create folder on Google Drive"
      );
    } finally {
      setIsCreatingFolder(false);
    }
  };

  if (!isOpen) return null;

  const directParentName =
    breadcrumbs.length > 1
      ? breadcrumbs[breadcrumbs.length - 2].name
      : null;

  return (
    <div
      id="manage-folders-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="manage-folders-modal-panel"
        className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Star className="w-5 h-5 fill-amber-500" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Define Important Folders
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                Browse your Google Drive folders starting from <strong>My Drive</strong>. Click any folder to go inside it, and star your project folders to index game assets quickly.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Scan Scope Toggle */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Default Scan & Search Scope
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleScopeChange("important")}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  selectedScope === "important"
                    ? "bg-amber-500/10 border-amber-500/60 dark:border-amber-500/50 shadow-xs"
                    : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedScope === "important"
                      ? "bg-amber-500 text-white"
                      : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  <Zap className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>Important Folders Only</span>
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded-sm">
                      Recommended
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                    High speed scans. Focuses indexing strictly on your starred folders.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleScopeChange("all")}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  selectedScope === "all"
                    ? "bg-indigo-500/10 border-indigo-500/60 dark:border-indigo-500/50 shadow-xs"
                    : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedScope === "all"
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  <Globe className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    Entire Google Drive
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                    Broad scan. Queries across all folders in your Google Drive account.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Navigation Bar & Mode Switcher */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              {/* Tab Pills: Browse Hierarchy vs Starred Folders */}
              <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("browse");
                    setSearchQuery("");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "browse" && !searchQuery
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Browse Drive Hierarchy</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("starred");
                    setSearchQuery("");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "starred" && !searchQuery
                      ? "bg-white dark:bg-zinc-900 text-amber-700 dark:text-amber-300 shadow-xs"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span>Starred Important ({selectedIds.length})</span>
                </button>
              </div>

              {accessToken && (
                <button
                  type="button"
                  onClick={() => {
                    // Force refresh current folder
                    setFolderCache((prev) => {
                      const copy = { ...prev };
                      delete copy[currentFolder.id];
                      return copy;
                    });
                    loadFolderChildren(
                      currentFolder.id,
                      currentFolder.path,
                      currentFolder.segments
                    );
                    if (onRefreshFolders) onRefreshFolders();
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer self-end sm:self-center"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh Current View</span>
                </button>
              )}
            </div>

            {/* Search Input across Google Drive */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search across all Drive folders by name..."
                className="w-full pl-9 pr-16 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100"
              />
              <div className="absolute right-2.5 top-2 flex items-center gap-1">
                {isSearching && (
                  <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                )}
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
                    title="Clear filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {searchQuery && !isSearching && (
                  <span className="text-[10px] text-zinc-400">
                    {searchResults.length} found
                  </span>
                )}
              </div>
            </div>

            {/* Folder Explorer Container */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
              {/* Google Drive Breadcrumbs Bar (shown in Browse mode) */}
              {!searchQuery && activeTab === "browse" && (
                <div className="px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                  {/* Breadcrumb Trail */}
                  <nav
                    className="flex items-center gap-1 text-xs flex-wrap min-w-0"
                    aria-label="Folder Breadcrumbs"
                  >
                    {breadcrumbs.map((crumb, idx) => {
                      const isLast = idx === breadcrumbs.length - 1;
                      return (
                        <React.Fragment key={crumb.id}>
                          {idx > 0 && (
                            <ChevronRight className="w-3 h-3 text-zinc-400 shrink-0" />
                          )}
                          {isLast ? (
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 truncate max-w-[200px]">
                              {idx === 0 && (
                                <HardDrive className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              )}
                              <span>{crumb.name}</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleBreadcrumbClick(idx)}
                              className="text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors flex items-center gap-1.5 cursor-pointer truncate max-w-[150px]"
                              title={`Jump to ${crumb.name}`}
                            >
                              {idx === 0 && (
                                <HardDrive className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              )}
                              <span>{crumb.name}</span>
                            </button>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </nav>

                  {/* Actions: Go Up + Star Current Folder */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    {breadcrumbs.length > 1 && (
                      <button
                        type="button"
                        onClick={handleGoUp}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 transition-colors cursor-pointer"
                        title={`Go up to ${directParentName}`}
                      >
                        <ChevronLeft className="w-3 h-3" />
                        <span>Up to {directParentName}</span>
                      </button>
                    )}

                    {currentFolder.id !== "root" && (
                      <button
                        type="button"
                        onClick={() =>
                          toggleFolder(currentFolder.id, {
                            id: currentFolder.id,
                            name: currentFolder.name,
                            path: currentFolder.path,
                            pathSegments: currentFolder.segments,
                          })
                        }
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors cursor-pointer border ${
                          selectedIds.includes(currentFolder.id)
                            ? "text-amber-700 dark:text-amber-300 bg-amber-500/15 border-amber-500/30"
                            : "text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                        }`}
                        title={
                          selectedIds.includes(currentFolder.id)
                            ? "Unstar this current directory"
                            : "Star this current directory as Important"
                        }
                      >
                        <Star
                          className={`w-3 h-3 ${
                            selectedIds.includes(currentFolder.id)
                              ? "fill-amber-500 text-amber-500"
                              : "text-zinc-400"
                          }`}
                        />
                        <span>
                          {selectedIds.includes(currentFolder.id)
                            ? "Current Starred"
                            : "Star Current Folder"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Starred Tab Header */}
              {!searchQuery && activeTab === "starred" && (
                <div className="px-3.5 py-2.5 bg-amber-500/5 dark:bg-amber-500/10 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span>
                      Your {selectedIds.length} Starred Important Folder
                      {selectedIds.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Click &ldquo;Browse Drive Hierarchy&rdquo; to explore all directories
                  </span>
                </div>
              )}

              {/* Search Results Header */}
              {searchQuery && (
                <div className="px-3.5 py-2.5 bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    {isSearching ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    ) : (
                      <Search className="w-3.5 h-3.5 text-indigo-600" />
                    )}
                    <span>
                      {isSearching
                        ? `Searching Google Drive for "${searchQuery}"...`
                        : `Results for "${searchQuery}" (${searchResults.length})`}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Clear Search
                  </button>
                </div>
              )}

              {/* Loading State */}
              {isLoadingFolder && !searchQuery && activeTab === "browse" && (
                <div className="p-8 text-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    Loading folders in {currentFolder.name}...
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Directly retrieving your Google Drive directories
                  </p>
                </div>
              )}

              {/* Error State */}
              {folderLoadError && !isLoadingFolder && (
                <div className="p-6 text-center space-y-2">
                  <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {folderLoadError}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      loadFolderChildren(
                        currentFolder.id,
                        currentFolder.path,
                        currentFolder.segments
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Try Again</span>
                  </button>
                </div>
              )}

              {/* Folder List Items */}
              {!isLoadingFolder && !folderLoadError && (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-72 overflow-y-auto">
                  {/* Search Results Display */}
                  {searchQuery ? (
                    searchResults.length === 0 ? (
                      <div className="p-8 text-center space-y-2 text-zinc-500 dark:text-zinc-400">
                        <FolderOpen className="w-8 h-8 mx-auto text-zinc-400 opacity-60" />
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                          {isSearching ? "Searching Drive..." : `No folders matching "${searchQuery}"`}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          Try typing another term or clear the search to browse My Drive.
                        </p>
                      </div>
                    ) : (
                      searchResults.map((f) => {
                        const isImp = selectedIds.includes(f.id);
                        const fullPath = f.path || `My Drive / ... / ${f.name}`;
                        return (
                          <div
                            key={f.id}
                            className={`px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group ${
                              isImp ? "bg-amber-500/5 dark:bg-amber-500/10" : ""
                            }`}
                          >
                            <div
                              onClick={() => handleOpenFolder(f)}
                              className="flex items-start gap-3 min-w-0 flex-1 text-left cursor-pointer"
                            >
                              <Folder
                                className={`w-4 h-4 mt-0.5 shrink-0 ${
                                  isImp
                                    ? "text-amber-500 fill-amber-500/20"
                                    : "text-zinc-400 group-hover:text-indigo-500"
                                }`}
                              />
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <span className="text-xs block font-semibold truncate text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                  {f.name}
                                </span>
                                <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                                  <span className="truncate max-w-[280px] sm:max-w-md">
                                    {fullPath}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleCopyPath(e, fullPath, f.id)}
                                    className="p-0.5 text-zinc-400 hover:text-zinc-600 rounded shrink-0 cursor-pointer"
                                    title="Copy path"
                                  >
                                    {copiedId === f.id ? (
                                      <Check className="w-2.5 h-2.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-2.5 h-2.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenFolder(f)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                              >
                                <span>Open</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleFolder(f.id, f)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isImp
                                    ? "text-amber-500 bg-amber-500/20 hover:bg-amber-500/30"
                                    : "text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                }`}
                                title={isImp ? "Unstar folder" : "Mark as Important"}
                              >
                                <Star
                                  className={`w-4 h-4 ${isImp ? "fill-amber-500" : ""}`}
                                />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )
                  ) : activeTab === "starred" ? (
                    // Starred Folders View
                    starredFoldersList.length === 0 ? (
                      <div className="p-8 text-center space-y-2 text-zinc-500 dark:text-zinc-400">
                        <Star className="w-8 h-8 mx-auto text-zinc-400 opacity-60" />
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                          No folders marked as Important yet
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          Switch to &ldquo;Browse Drive Hierarchy&rdquo; and click the Star icon on any folder to mark it.
                        </p>
                      </div>
                    ) : (
                      starredFoldersList.map((f) => {
                        const fullPath = f.path || `My Drive / ... / ${f.name}`;
                        return (
                          <div
                            key={f.id}
                            className="px-3.5 py-2.5 flex items-center justify-between gap-3 bg-amber-500/5 dark:bg-amber-500/10 hover:bg-amber-500/10 transition-colors group"
                          >
                            <div
                              onClick={() => handleOpenFolder(f)}
                              className="flex items-start gap-3 min-w-0 flex-1 text-left cursor-pointer"
                            >
                              <Folder className="w-4 h-4 mt-0.5 shrink-0 text-amber-500 fill-amber-500/20" />
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <span className="text-xs block font-semibold truncate text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                  {f.name}
                                </span>
                                <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                                  <span className="truncate max-w-[280px] sm:max-w-md">
                                    {fullPath}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleCopyPath(e, fullPath, f.id)}
                                    className="p-0.5 text-zinc-400 hover:text-zinc-600 rounded shrink-0 cursor-pointer"
                                    title="Copy full path"
                                  >
                                    {copiedId === f.id ? (
                                      <Check className="w-2.5 h-2.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-2.5 h-2.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenFolder(f)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                              >
                                <span>Open</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleFolder(f.id)}
                                className="p-1.5 rounded-lg text-amber-500 bg-amber-500/20 hover:bg-amber-500/30 transition-colors cursor-pointer"
                                title="Remove from Important"
                              >
                                <Star className="w-4 h-4 fill-amber-500" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )
                  ) : (
                    // Browse Mode: Folders inside current directory
                    currentLevelFolders.length === 0 ? (
                      <div className="p-8 text-center space-y-2 text-zinc-500 dark:text-zinc-400">
                        <FolderOpen className="w-8 h-8 mx-auto text-zinc-400 opacity-60" />
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                          {currentFolder.id === "root"
                            ? "No folders found in My Drive"
                            : `No subfolders inside "${currentFolder.name}"`}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          {currentFolder.id === "root"
                            ? "Create a new folder below to begin organizing game assets."
                            : "This folder contains no subfolders. You can star it directly or create one below."}
                        </p>
                        {breadcrumbs.length > 1 && (
                          <button
                            type="button"
                            onClick={handleGoUp}
                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>Go back to {directParentName}</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      currentLevelFolders.map((f) => {
                        const isImp = selectedIds.includes(f.id);
                        const fullPath =
                          f.path || `${currentFolder.path} / ${f.name}`;

                        return (
                          <div
                            key={f.id}
                            className={`px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group ${
                              isImp ? "bg-amber-500/5 dark:bg-amber-500/10" : ""
                            }`}
                          >
                            {/* Tap folder row to go inside */}
                            <div
                              onClick={() => handleOpenFolder(f)}
                              className="flex items-start gap-3 min-w-0 flex-1 text-left cursor-pointer"
                              title={`Click to open "${f.name}"`}
                            >
                              <div className="pt-0.5 shrink-0">
                                <Folder
                                  className={`w-4 h-4 ${
                                    isImp
                                      ? "text-amber-500 fill-amber-500/20"
                                      : "text-zinc-400 group-hover:text-indigo-500 transition-colors"
                                  }`}
                                />
                              </div>

                              <div className="min-w-0 flex-1 space-y-1">
                                <span
                                  className={`text-xs block font-semibold truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ${
                                    isImp
                                      ? "text-zinc-900 dark:text-zinc-100"
                                      : "text-zinc-800 dark:text-zinc-200"
                                  }`}
                                >
                                  {f.name}
                                </span>

                                <div
                                  className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono flex-wrap"
                                  title={`Drive path: ${fullPath}`}
                                >
                                  <span className="truncate max-w-[280px] sm:max-w-md">
                                    {fullPath}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleCopyPath(e, fullPath, f.id)}
                                    className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded shrink-0 cursor-pointer"
                                    title="Copy full path"
                                  >
                                    {copiedId === f.id ? (
                                      <Check className="w-2.5 h-2.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-2.5 h-2.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Open button & Star toggle */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenFolder(f)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                title={`Open folder ${f.name}`}
                              >
                                <span>Open</span>
                                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFolder(f.id, f);
                                }}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isImp
                                    ? "text-amber-500 bg-amber-500/20 hover:bg-amber-500/30"
                                    : "text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                }`}
                                title={
                                  isImp
                                    ? "Remove from Important"
                                    : "Mark as Important folder"
                                }
                              >
                                <Star
                                  className={`w-4 h-4 ${isImp ? "fill-amber-500" : ""}`}
                                />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Create New Game Asset Folder directly on Drive */}
          {accessToken && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                <FolderPlus className="w-3.5 h-3.5 text-indigo-500" />
                <span>Create New Game Folder on Google Drive</span>
              </label>

              {/* Destination selector (defaults to current folder view) */}
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
                  Location:
                </label>
                <select
                  value={newFolderParentId}
                  onChange={(e) => setNewFolderParentId(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 flex-1 max-w-full truncate"
                >
                  <option value="root">My Drive (Root)</option>
                  {breadcrumbs
                    .filter((b) => b.id !== "root")
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.path}
                      </option>
                    ))}
                  {Array.from(knownFoldersMap.values())
                    .filter(
                      (f: DriveFolderItem) =>
                        !breadcrumbs.some((b) => b.id === f.id) &&
                        f.id !== "root"
                    )
                    .slice(0, 30)
                    .map((f: DriveFolderItem) => (
                      <option key={f.id} value={f.id}>
                        {f.path || f.name}
                      </option>
                    ))}
                </select>
              </div>

              <form onSubmit={handleCreateFolder} className="flex gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Pixel Sprites, SFX Audio, 3D Props"
                  className="flex-1 px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100"
                  disabled={isCreatingFolder}
                />
                <button
                  type="submit"
                  disabled={!newFolderName.trim() || isCreatingFolder}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                >
                  {isCreatingFolder ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>{isCreatingFolder ? "Creating..." : "Create & Star"}</span>
                </button>
              </form>

              {folderCreateSuccess && (
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>{folderCreateSuccess}</span>
                </div>
              )}

              {folderCreateError && (
                <div className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{folderCreateError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {selectedIds.length > 0 ? (
              <span>
                <strong className="text-zinc-900 dark:text-zinc-100">
                  {selectedIds.length}
                </strong>{" "}
                folder{selectedIds.length === 1 ? "" : "s"} designated as Important
              </span>
            ) : (
              <span>No folders marked yet (all folders will be scanned)</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Done
            </button>

            {onScanNow && accessToken && selectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onScanNow(selectedIds);
                  onClose();
                }}
                disabled={isScanning}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isScanning ? "Scanning..." : "Scan Important Now"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
