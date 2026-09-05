import React, { useState, useMemo, useEffect } from "react";
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
  ArrowRight,
} from "lucide-react";
import { createDriveFolder } from "../services/driveService";
import { DriveFolderItem } from "../types";

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
  // Navigation state (Google Drive hierarchy: "root" is "My Drive")
  const [currentFolderId, setCurrentFolderId] = useState<string>("root");
  const [activeTab, setActiveTab] = useState<"browse" | "starred">("browse");
  const [searchQuery, setSearchQuery] = useState("");

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

  // Sync state when modal opens or props update
  useEffect(() => {
    setSelectedIds(importantFolderIds);
    setSelectedScope(scanScope);
    if (isOpen) {
      setCurrentFolderId("root");
      setSearchQuery("");
      setActiveTab("browse");
    }
  }, [importantFolderIds, scanScope, isOpen]);

  // Sync new folder default parent location with currently viewed directory
  useEffect(() => {
    setNewFolderParentId(currentFolderId === "root" ? "root" : currentFolderId);
  }, [currentFolderId]);

  // Ensure all folders have complete hierarchical path starting with "My Drive"
  const resolvedFolders = useMemo(() => {
    const folderMap = new Map<string, DriveFolderItem>();
    for (const f of folders) {
      folderMap.set(f.id, f);
    }

    return folders.map((f) => {
      if (
        f.pathSegments &&
        f.pathSegments.length > 0 &&
        f.pathSegments[0] === "My Drive"
      ) {
        return f;
      }

      // Build path segments upward to root
      const segments: string[] = [f.name];
      const visited = new Set<string>([f.id]);
      let current = f;

      while (current.parents && current.parents.length > 0) {
        const pId = current.parents[0];
        if (pId === "root" || visited.has(pId)) break;
        visited.add(pId);
        const parent = folderMap.get(pId);
        if (parent) {
          segments.unshift(parent.name);
          current = parent;
        } else {
          break;
        }
      }

      // Root is always "My Drive"
      segments.unshift("My Drive");

      return {
        ...f,
        path: segments.join(" / "),
        pathSegments: segments,
      };
    });
  }, [folders]);

  // Detect folders that share the exact same name across different directories
  const duplicateNameSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of resolvedFolders) {
      counts.set(f.name, (counts.get(f.name) || 0) + 1);
    }
    const duplicates = new Set<string>();
    for (const [name, count] of counts.entries()) {
      if (count > 1) duplicates.add(name);
    }
    return duplicates;
  }, [resolvedFolders]);

  // Pre-calculate parent-child tree relationships
  const { rootFolders, childrenByParentId, parentOfMap, folderById } = useMemo(() => {
    const folderMap = new Map<string, DriveFolderItem>();
    for (const f of resolvedFolders) {
      folderMap.set(f.id, f);
    }

    const rootList: DriveFolderItem[] = [];
    const childrenMap = new Map<string, DriveFolderItem[]>();
    const parentMap = new Map<string, string>(); // childId -> parentId

    for (const f of resolvedFolders) {
      let parentId: string | null = null;
      if (f.parents && f.parents.length > 0) {
        const p = f.parents[0];
        if (p !== "root" && folderMap.has(p)) {
          parentId = p;
        }
      }

      // Fallback matching using pathSegments if parentId was not explicitly mapped
      if (!parentId && f.pathSegments && f.pathSegments.length > 2) {
        const parentName = f.pathSegments[f.pathSegments.length - 2];
        const possibleParent = resolvedFolders.find(
          (cand) =>
            cand.id !== f.id &&
            cand.name === parentName &&
            cand.pathSegments?.length === f.pathSegments!.length - 1
        );
        if (possibleParent) {
          parentId = possibleParent.id;
        }
      }

      if (parentId) {
        parentMap.set(f.id, parentId);
        const list = childrenMap.get(parentId) || [];
        list.push(f);
        childrenMap.set(parentId, list);
      } else {
        rootList.push(f);
      }
    }

    // Sort alphabetically (Google Drive default)
    rootList.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    );

    for (const list of childrenMap.values()) {
      list.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      );
    }

    return {
      rootFolders: rootList,
      childrenByParentId: childrenMap,
      parentOfMap: parentMap,
      folderById: folderMap,
    };
  }, [resolvedFolders]);

  // Current folder item
  const currentFolder = useMemo(() => {
    if (currentFolderId === "root") return null;
    return folderById.get(currentFolderId) || null;
  }, [currentFolderId, folderById]);

  // Google Drive Breadcrumbs trail
  const breadcrumbs = useMemo(() => {
    if (currentFolderId === "root" || !currentFolder) {
      return [{ id: "root", name: "My Drive" }];
    }

    const trail: { id: string; name: string }[] = [];
    let curr: DriveFolderItem | undefined = currentFolder;
    const visited = new Set<string>();

    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      trail.unshift({ id: curr.id, name: curr.name });
      const pId = parentOfMap.get(curr.id);
      if (pId) {
        curr = folderById.get(pId);
      } else {
        break;
      }
    }

    trail.unshift({ id: "root", name: "My Drive" });
    return trail;
  }, [currentFolderId, currentFolder, parentOfMap, folderById]);

  // Direct parent for "Up" navigation
  const directParentId = useMemo(() => {
    if (currentFolderId === "root") return null;
    return parentOfMap.get(currentFolderId) || "root";
  }, [currentFolderId, parentOfMap]);

  const directParentName = useMemo(() => {
    if (!directParentId) return null;
    if (directParentId === "root") return "My Drive";
    return folderById.get(directParentId)?.name || "Parent Folder";
  }, [directParentId, folderById]);

  // Folders to display at the current level or search/starred tab
  const displayedFolders = useMemo(() => {
    // If searching, search across all folders in drive
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return resolvedFolders.filter((f) => {
        const nameMatch = f.name.toLowerCase().includes(q);
        const pathMatch = (f.path || "").toLowerCase().includes(q);
        return nameMatch || pathMatch;
      }).sort((a, b) => {
        const aImp = selectedIds.includes(a.id);
        const bImp = selectedIds.includes(b.id);
        if (aImp && !bImp) return -1;
        if (!aImp && bImp) return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      });
    }

    // If Starred tab
    if (activeTab === "starred") {
      return resolvedFolders.filter((f) => selectedIds.includes(f.id)).sort((a, b) =>
        (a.path || a.name).localeCompare(b.path || b.name)
      );
    }

    // Google Drive hierarchy navigation:
    // When at root ("My Drive"), display rootFolders
    if (currentFolderId === "root") {
      return rootFolders;
    }

    // When inside a folder, display its direct child folders
    return childrenByParentId.get(currentFolderId) || [];
  }, [searchQuery, activeTab, currentFolderId, resolvedFolders, selectedIds, rootFolders, childrenByParentId]);

  const toggleFolder = (folderId: string) => {
    setSelectedIds((prev) => {
      const next = prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId];
      onUpdateImportantFolders(next);
      return next;
    });
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
      const parentIdArg = newFolderParentId === "root" ? undefined : newFolderParentId;
      const created = await createDriveFolder(accessToken, newFolderName.trim(), parentIdArg);

      // Determine parent path
      const parentFolder = resolvedFolders.find((f) => f.id === newFolderParentId);
      const parentPath = parentFolder?.path || "My Drive";

      // Automatically mark newly created folder as important
      const next = [...selectedIds, created.id];
      setSelectedIds(next);
      onUpdateImportantFolders(next);
      setFolderCreateSuccess(`Created "${created.name}" in "${parentPath}" and marked as Important!`);
      setNewFolderName("");
      if (onRefreshFolders) {
        onRefreshFolders();
      }
    } catch (err: any) {
      setFolderCreateError(err.message || "Failed to create folder on Google Drive");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  if (!isOpen) return null;

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
                Browse your Google Drive hierarchy starting at <strong>My Drive</strong>. Tap any folder to go inside it, and star folders containing game assets for high-speed indexing.
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
                    Faster scans. Restricts indexing strictly to your starred folders.
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
                    Broad scan. Queries all accessible folders across your entire Drive account.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Duplicate Name Notification */}
          {duplicateNameSet.size > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block">
                  Identical folder names detected
                </span>
                <span className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed block">
                  {duplicateNameSet.size} folder name{duplicateNameSet.size === 1 ? "" : "s"} (such as {Array.from(duplicateNameSet).slice(0, 3).map((n) => `"${n}"`).join(", ")}) exist in multiple directories. Use the hierarchical breadcrumbs and full path below each item to select the exact project folder.
                </span>
              </div>
            </div>
          )}

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

              {onRefreshFolders && accessToken && (
                <button
                  type="button"
                  onClick={onRefreshFolders}
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer self-end sm:self-center"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh Drive</span>
                </button>
              )}
            </div>

            {/* Search Input across all folders */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search across all Drive folders by name or path..."
                className="w-full pl-9 pr-16 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100"
              />
              <div className="absolute right-2.5 top-2 flex items-center gap-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
                    title="Clear filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {searchQuery && (
                  <span className="text-[10px] text-zinc-400">
                    {displayedFolders.length} found
                  </span>
                )}
              </div>
            </div>

            {/* Folder Explorer Container */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
              {/* Google Drive Breadcrumb Navigation Bar (shown when browsing hierarchy) */}
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
                              onClick={() => setCurrentFolderId(crumb.id)}
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

                  {/* Top Actions: Go Up one level + Star active directory */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    {directParentId && (
                      <button
                        type="button"
                        onClick={() => setCurrentFolderId(directParentId)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 transition-colors cursor-pointer"
                        title={`Go up to ${directParentName}`}
                      >
                        <ChevronLeft className="w-3 h-3" />
                        <span>Up to {directParentName}</span>
                      </button>
                    )}

                    {currentFolder && (
                      <button
                        type="button"
                        onClick={() => toggleFolder(currentFolder.id)}
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
                            ? "Current Folder Starred"
                            : "Star Current Folder"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Starred Tab Header Info */}
              {!searchQuery && activeTab === "starred" && (
                <div className="px-3.5 py-2.5 bg-amber-500/5 dark:bg-amber-500/10 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span>Your {selectedIds.length} Starred Important Folder{selectedIds.length === 1 ? "" : "s"}</span>
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Click &ldquo;Browse Drive Hierarchy&rdquo; to explore other folders
                  </span>
                </div>
              )}

              {/* Search Header Info */}
              {searchQuery && (
                <div className="px-3.5 py-2.5 bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                    Search Results for &ldquo;{searchQuery}&rdquo;
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Clear Search
                  </button>
                </div>
              )}

              {/* Folder List Items */}
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-72 overflow-y-auto">
                {displayedFolders.length === 0 ? (
                  <div className="p-8 text-center space-y-2 text-zinc-500 dark:text-zinc-400">
                    <FolderOpen className="w-8 h-8 mx-auto text-zinc-400 opacity-60" />
                    {searchQuery ? (
                      <div>
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                          No matching folders found
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Try searching for a different folder name or clear the filter.
                        </p>
                      </div>
                    ) : activeTab === "starred" ? (
                      <div>
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                          No folders marked as Important yet
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Switch to &ldquo;Browse Drive Hierarchy&rdquo; and click the Star icon on any folder to designate it as Important.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                          No subfolders inside {currentFolder ? currentFolder.name : "My Drive"}
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          This folder has no nested subdirectories. You can star it directly or create a new subfolder below.
                        </p>
                        {directParentId && (
                          <button
                            type="button"
                            onClick={() => setCurrentFolderId(directParentId)}
                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>Go back to {directParentName}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  displayedFolders.map((f) => {
                    const isImp = selectedIds.includes(f.id);
                    const isDuplicate = duplicateNameSet.has(f.name);
                    const fullPath = f.path || `My Drive / ${f.name}`;
                    const subCount = (childrenByParentId.get(f.id) || []).length;

                    return (
                      <div
                        key={f.id}
                        className={`px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group ${
                          isImp ? "bg-amber-500/5 dark:bg-amber-500/10" : ""
                        }`}
                      >
                        {/* Folder Row Details - Tap to go inside */}
                        <div
                          onClick={() => {
                            // Tapping folder goes inside
                            setCurrentFolderId(f.id);
                            if (activeTab === "starred" || searchQuery) {
                              setActiveTab("browse");
                              setSearchQuery("");
                            }
                          }}
                          className="flex items-start gap-3 min-w-0 flex-1 text-left cursor-pointer"
                          title={`Tap to go inside folder: ${f.name}`}
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
                            {/* Folder Name & Badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-xs block font-semibold truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ${
                                  isImp
                                    ? "text-zinc-900 dark:text-zinc-100"
                                    : "text-zinc-800 dark:text-zinc-200"
                                }`}
                              >
                                {f.name}
                              </span>

                              {subCount > 0 ? (
                                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded-md">
                                  {subCount} subfolder{subCount === 1 ? "" : "s"}
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-400">
                                  0 subfolders
                                </span>
                              )}

                              {isDuplicate && (
                                <span
                                  className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.2 rounded-md shrink-0"
                                  title="Another folder with this exact name exists in a different location. Check the full path below."
                                >
                                  Same name in other location
                                </span>
                              )}
                            </div>

                            {/* Full Path starting from My Drive */}
                            <div
                              className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono flex-wrap"
                              title={`Google Drive full path: ${fullPath}`}
                            >
                              <span className="truncate max-w-[280px] sm:max-w-md">
                                {fullPath}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyPath(e, fullPath, f.id)}
                                className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded hover:bg-zinc-200/50 dark:hover:bg-zinc-800 shrink-0"
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

                        {/* Actions: Open chevron & Star toggle */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentFolderId(f.id);
                              if (activeTab === "starred" || searchQuery) {
                                setActiveTab("browse");
                                setSearchQuery("");
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            title={`Tap to go inside ${f.name}`}
                          >
                            <span>Open</span>
                            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFolder(f.id);
                            }}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isImp
                                ? "text-amber-500 bg-amber-500/20 hover:bg-amber-500/30"
                                : "text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            }`}
                            title={isImp ? "Remove from Important" : "Mark as Important folder"}
                          >
                            <Star className={`w-4 h-4 ${isImp ? "fill-amber-500" : ""}`} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Create New Game Asset Folder directly on Drive */}
          {accessToken && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                <FolderPlus className="w-3.5 h-3.5 text-indigo-500" />
                <span>Create New Game Folder on Google Drive</span>
              </label>

              {/* Destination folder selection (defaults to current folder view) */}
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
                  {resolvedFolders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.path || `My Drive / ${f.name}`}
                    </option>
                  ))}
                </select>
              </div>

              <form onSubmit={handleCreateFolder} className="flex gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Pixel Art Sprites, Foley SFX, Level Models"
                  className="flex-1 px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100"
                  disabled={isCreatingFolder}
                />
                <button
                  type="submit"
                  disabled={!newFolderName.trim() || isCreatingFolder}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
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
