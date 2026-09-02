import React from "react";
import {
  Gamepad2,
  Sparkles,
  FolderPlus,
  RefreshCw,
  LogOut,
  CheckCircle2,
  HardDrive,
  FolderSync,
} from "lucide-react";
import { User } from "firebase/auth";
import { GoogleSignInButton } from "./GoogleSignInButton";

interface NavbarProps {
  user: User | null;
  isConnectedToDrive: boolean;
  isScanning: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onScanDrive: () => void;
  onOpenOrganize: () => void;
  onBatchAutoTag: () => void;
  isBatchTagging: boolean;
  isSampleMode: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  isConnectedToDrive,
  isScanning,
  onSignIn,
  onSignOut,
  onScanDrive,
  onOpenOrganize,
  onBatchAutoTag,
  isBatchTagging,
  isSampleMode,
}) => {
  return (
    <header
      id="app-header-navbar"
      className="sticky top-0 z-30 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md flex-shrink-0">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Game Asset Vault
              </h1>
              {isConnectedToDrive ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" /> Drive Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Sample Sandbox
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
              Smart tags & file categorization for Google Drive game assets
            </p>
          </div>
        </div>

        {/* Action Controls & Auth */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Batch Auto-Tag button */}
          <button
            id="batch-auto-tag-button"
            type="button"
            onClick={onBatchAutoTag}
            disabled={isBatchTagging}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            title="Analyze untagged assets with Gemini AI"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isBatchTagging ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">
              {isBatchTagging ? "Tagging Assets..." : "Auto-Tag with AI"}
            </span>
          </button>

          {/* Organize Folders Button */}
          <button
            id="open-organize-modal-button"
            type="button"
            onClick={onOpenOrganize}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition-all cursor-pointer"
            title="Create standard folders and organize files"
          >
            <FolderPlus className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">Organize on Drive</span>
          </button>

          {/* Refresh / Scan Drive Button */}
          {isConnectedToDrive && (
            <button
              id="refresh-drive-scan-button"
              type="button"
              onClick={onScanDrive}
              disabled={isScanning}
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Rescan Google Drive"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
            </button>
          )}

          {/* Auth State & Google Sign In */}
          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-zinc-200 dark:border-zinc-800">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                  {(user.displayName || user.email || "U")[0].toUpperCase()}
                </div>
              )}

              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-28">
                  {user.displayName || user.email}
                </span>
                <span className="text-[10px] text-zinc-400">Connected</span>
              </div>

              <button
                id="sign-out-button"
                type="button"
                onClick={onSignOut}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                title="Disconnect Google Drive"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="pl-1">
              <GoogleSignInButton
                onClick={onSignIn}
                text="Connect Drive"
                className="py-1.5 px-3 text-xs"
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
