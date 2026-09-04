import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import { createDriveFolder } from "../services/driveService";

interface ManageFoldersModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Array<{ id: string; name: string }>;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folderCreateError, setFolderCreateError] = useState<string | null>(null);
  const [folderCreateSuccess, setFolderCreateSuccess] = useState<string | null>(null);

  // Local state copy for instant responsive editing
  const [selectedIds, setSelectedIds] = useState<string[]>(importantFolderIds);
  const [selectedScope, setSelectedScope] = useState<"important" | "all">(scanScope);

  // Sync state when modal opens or props update
  React.useEffect(() => {
    setSelectedIds(importantFolderIds);
    setSelectedScope(scanScope);
  }, [importantFolderIds, scanScope, isOpen]);

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

  const filteredFolders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, searchQuery]);

  // Sort folders: Important ones first, then alphabetical
  const sortedFolders = useMemo(() => {
    return [...filteredFolders].sort((a, b) => {
      const aImp = selectedIds.includes(a.id);
      const bImp = selectedIds.includes(b.id);
      if (aImp && !bImp) return -1;
      if (!aImp && bImp) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredFolders, selectedIds]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !accessToken) return;

    setIsCreatingFolder(true);
    setFolderCreateError(null);
    setFolderCreateSuccess(null);

    try {
      const created = await createDriveFolder(accessToken, newFolderName.trim());
      // Automatically mark newly created folder as important
      const next = [...selectedIds, created.id];
      setSelectedIds(next);
      onUpdateImportantFolders(next);
      setFolderCreateSuccess(`Created "${created.name}" and marked as Important!`);
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
        className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
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
                Prioritize the folders where your game assets live. Searching and scanning
                will focus on these folders rather than traversing your entire Google Drive.
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
        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto flex-1">
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
                    Faster scans. Restricts asset indexing strictly to your starred folders.
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

          {/* Folder Search & Quick Actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <span>Detected Folders</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  {selectedIds.length} marked important
                </span>
              </label>

              {onRefreshFolders && accessToken && (
                <button
                  type="button"
                  onClick={onRefreshFolders}
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh Folders</span>
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter folders by name..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Folder List */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-56 overflow-y-auto bg-white dark:bg-zinc-900">
              {sortedFolders.length === 0 ? (
                <div className="p-6 text-center space-y-1 text-zinc-500 dark:text-zinc-400">
                  <FolderOpen className="w-6 h-6 mx-auto text-zinc-400" />
                  <p className="text-xs font-medium">No folders found</p>
                  <p className="text-[11px] text-zinc-400">
                    {searchQuery
                      ? "No folders matched your search."
                      : "Connect to Google Drive or create a new folder below."}
                  </p>
                </div>
              ) : (
                sortedFolders.map((f) => {
                  const isImp = selectedIds.includes(f.id);
                  return (
                    <div
                      key={f.id}
                      onClick={() => toggleFolder(f.id)}
                      className={`px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors ${
                        isImp ? "bg-amber-500/5 dark:bg-amber-500/10" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Folder
                          className={`w-4 h-4 shrink-0 ${
                            isImp ? "text-amber-500" : "text-zinc-400"
                          }`}
                        />
                        <div className="min-w-0">
                          <span
                            className={`text-xs block truncate ${
                              isImp
                                ? "font-semibold text-zinc-900 dark:text-zinc-100"
                                : "text-zinc-700 dark:text-zinc-300"
                            }`}
                          >
                            {f.name}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isImp && (
                          <span className="hidden sm:inline-block text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full">
                            Important
                          </span>
                        )}
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
                          title={isImp ? "Remove from Important" : "Mark as Important"}
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

          {/* Create New Game Asset Folder directly on Drive */}
          {accessToken && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                <FolderPlus className="w-3.5 h-3.5 text-indigo-500" />
                <span>Create New Game Folder on Google Drive</span>
              </label>

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
