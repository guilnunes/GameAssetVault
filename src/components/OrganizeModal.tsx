import React, { useState } from "react";
import {
  X,
  FolderPlus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Folder,
  Layers,
  Sparkles,
} from "lucide-react";
import { EnrichedAsset } from "../types";
import { createDriveFolder, moveDriveFile } from "../services/driveService";

interface OrganizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: EnrichedAsset[];
  accessToken: string | null;
  onOrganizeComplete: () => void;
}

export const OrganizeModal: React.FC<OrganizeModalProps> = ({
  isOpen,
  onClose,
  assets,
  accessToken,
  onOrganizeComplete,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  if (!isOpen) return null;

  // Group assets by recommended target folders
  const folderPlan = React.useMemo(() => {
    const map: Record<string, EnrichedAsset[]> = {
      "Audio/Music": [],
      "Audio/SFX": [],
      "Sprites": [],
      "UI": [],
      "3D_Models": [],
      "Fonts": [],
      "Docs": [],
    };

    assets.forEach((asset) => {
      switch (asset.category) {
        case "music":
          map["Audio/Music"].push(asset);
          break;
        case "sound":
          map["Audio/SFX"].push(asset);
          break;
        case "imagery":
          map["Sprites"].push(asset);
          break;
        case "ui":
          map["UI"].push(asset);
          break;
        case "3d":
          map["3D_Models"].push(asset);
          break;
        case "fonts":
          map["Fonts"].push(asset);
          break;
        case "docs":
          map["Docs"].push(asset);
          break;
      }
    });

    return Object.entries(map).filter(([_, list]) => list.length > 0);
  }, [assets]);

  const totalFilesToOrganize = folderPlan.reduce((acc, [_, list]) => acc + list.length, 0);

  const handleStartOrganize = () => {
    // Open confirmation step
    setShowConfirmation(true);
  };

  const handleConfirmAndExecute = async () => {
    if (!accessToken) {
      alert("Please connect your Google Drive account first to create and organize folders.");
      return;
    }

    setIsProcessing(true);
    setStatusLog(["Starting Game Asset organization on Google Drive..."]);
    setProgress({ current: 0, total: totalFilesToOrganize });

    try {
      // 1. Create root 'GameAssets' folder on Drive
      setStatusLog((prev) => [...prev, "Creating root 'GameAssets' folder..."]);
      const rootFolder = await createDriveFolder(accessToken, "GameAssets");

      // 2. Create subfolders
      const subFolderIds: Record<string, string> = {};
      const subfolderNames = ["Audio", "Sprites", "UI", "3D_Models", "Fonts", "Docs"];
      for (const name of subfolderNames) {
        setStatusLog((prev) => [...prev, `Creating 'GameAssets/${name}'...`]);
        const created = await createDriveFolder(accessToken, name, rootFolder.id);
        subFolderIds[name] = created.id;
      }

      // Create nested audio subfolders
      const musicFolder = await createDriveFolder(accessToken, "Music", subFolderIds["Audio"]);
      const sfxFolder = await createDriveFolder(accessToken, "SFX", subFolderIds["Audio"]);
      subFolderIds["Audio/Music"] = musicFolder.id;
      subFolderIds["Audio/SFX"] = sfxFolder.id;

      // 3. Move files to appropriate folders
      let count = 0;
      for (const [folderName, files] of folderPlan) {
        const targetFolderId = subFolderIds[folderName];
        if (!targetFolderId) continue;

        for (const file of files) {
          if (file.id.startsWith("sample-")) continue;
          count++;
          setProgress({ current: count, total: totalFilesToOrganize });
          setStatusLog((prev) => [
            ...prev,
            `Moving ${file.name} -> GameAssets/${folderName}/`,
          ]);

          const currentParent = file.parents?.[0];
          await moveDriveFile(accessToken, file.id, targetFolderId, currentParent);
        }
      }

      setStatusLog((prev) => [
        ...prev,
        "Organization complete! All game assets categorized into GameAssets folder structure.",
      ]);
      onOrganizeComplete();
    } catch (err: any) {
      setStatusLog((prev) => [...prev, `Error: ${err.message}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="organize-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={() => !isProcessing && onClose()}
    >
      <div
        id="organize-modal-dialog"
        className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Organize Game Assets on Google Drive
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Auto-sort your loose drive files into clean game development folder structures
              </p>
            </div>
          </div>

          {!isProcessing && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Confirmation Screen */}
        {showConfirmation ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block text-sm mb-1">
                  Confirm Organization on Google Drive
                </strong>
                <p className="leading-relaxed">
                  This action will create a new folder hierarchy named{" "}
                  <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">
                    GameAssets/
                  </code>{" "}
                  on your Google Drive and move{" "}
                  <strong>{totalFilesToOrganize} game asset file(s)</strong> into their
                  designated category subfolders.
                </p>
              </div>
            </div>

            {/* Progress / Status log during execution */}
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Progress</span>
                  <span className="tabular-nums">
                    {progress.current} / {progress.total}
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{
                      width: `${
                        progress.total > 0
                          ? (progress.current / progress.total) * 100
                          : 10
                      }%`,
                    }}
                  />
                </div>
                <div className="max-h-36 overflow-y-auto p-2.5 rounded-xl bg-zinc-950 font-mono text-[11px] text-zinc-300 space-y-1">
                  {statusLog.map((log, idx) => (
                    <div key={idx} className="truncate">
                      › {log}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirmation Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 disabled:opacity-50"
              >
                Back
              </button>

              <button
                id="confirm-organize-execute-button"
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmAndExecute}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Organizing Drive Files...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Yes, Create Folders & Move Files</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Proposed Organization Plan */
          <div className="space-y-4">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              The organizer will construct standard game engine directory folders in your
              Drive and sort your assets according to their smart category:
            </p>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {folderPlan.map(([folderName, files]) => (
                <div
                  key={folderName}
                  className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Folder className="w-4 h-4 text-indigo-500" />
                    <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                      GameAssets/{folderName}/
                    </span>
                  </div>
                  <span className="text-zinc-500">
                    <strong>{files.length}</strong> asset(s)
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
              <span className="text-xs text-zinc-500">
                Total to organize: <strong>{totalFilesToOrganize} files</strong>
              </span>

              <button
                id="start-organize-review-button"
                type="button"
                onClick={handleStartOrganize}
                disabled={totalFilesToOrganize === 0}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-40"
              >
                <span>Continue to Organize</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
