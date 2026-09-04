import React, { useState } from "react";
import {
  Gamepad2,
  Sparkles,
  FolderPlus,
  RefreshCw,
  LogOut,
  CheckCircle2,
  Database,
  Menu,
  X,
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header
      id="app-header-navbar"
      className="sticky top-0 z-30 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md transition-colors"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand Left Section */}
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-xs shrink-0">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight whitespace-nowrap">
              Game Asset Vault
            </h1>

            {/* Connection Status Badge */}
            {isConnectedToDrive ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden sm:inline">Drive Live</span>
                <span className="sm:hidden">Live</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap shrink-0">
                Demo
              </span>
            )}

            {/* Cloud Persistence Badge */}
            {user && (
              <span
                className="hidden xl:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 whitespace-nowrap shrink-0"
                title="Firestore Cloud Persistence Active"
              >
                <Database className="w-3 h-3" /> Cloud Synced
              </span>
            )}
          </div>
        </div>

        {/* Desktop & Tablet Action Controls (md and up) */}
        <div className="hidden md:flex items-center gap-2 lg:gap-2.5 shrink-0">
          {/* Batch Auto-Tag button */}
          <button
            id="batch-auto-tag-button"
            type="button"
            onClick={onBatchAutoTag}
            disabled={isBatchTagging}
            className="inline-flex items-center gap-1.5 h-9 px-3 lg:px-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold whitespace-nowrap shrink-0 transition-all disabled:opacity-50 cursor-pointer"
            title="Analyze untagged assets with Gemini AI"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isBatchTagging ? "animate-spin" : ""}`} />
            <span className="hidden lg:inline">
              {isBatchTagging ? "Tagging Assets..." : "Auto-Tag with AI"}
            </span>
            <span className="lg:hidden">
              {isBatchTagging ? "Tagging..." : "AI Auto-Tag"}
            </span>
          </button>

          {/* Organize Folders Button */}
          <button
            id="open-organize-modal-button"
            type="button"
            onClick={onOpenOrganize}
            className="inline-flex items-center gap-1.5 h-9 px-3 lg:px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer"
            title="Create standard folders and organize files on Google Drive"
          >
            <FolderPlus className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden lg:inline">Organize on Drive</span>
            <span className="lg:hidden">Organize</span>
          </button>

          {/* Refresh / Scan Drive Button */}
          {isConnectedToDrive && (
            <button
              id="refresh-drive-scan-button"
              type="button"
              onClick={onScanDrive}
              disabled={isScanning}
              className="h-9 w-9 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
              title="Rescan Google Drive"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin text-indigo-600" : ""}`} />
            </button>
          )}

          {/* Divider */}
          <div className="h-5 w-px bg-zinc-200 dark:border-zinc-800 mx-0.5 shrink-0" />

          {/* Auth State & Google Sign In */}
          {user ? (
            <div className="flex items-center gap-2 pl-1 shrink-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {(user.displayName || user.email || "U")[0].toUpperCase()}
                </div>
              )}

              <div className="hidden xl:flex flex-col text-left text-xs leading-tight min-w-0 max-w-28">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {user.displayName || user.email}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Connected
                </span>
              </div>

              <button
                id="sign-out-button"
                type="button"
                onClick={onSignOut}
                className="h-9 w-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                title="Disconnect Google Drive"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="shrink-0">
              <GoogleSignInButton
                onClick={onSignIn}
                text="Connect Drive"
                compact
              />
            </div>
          )}
        </div>

        {/* Mobile Action Controls (screens < md) */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          {isConnectedToDrive && (
            <button
              type="button"
              onClick={onScanDrive}
              disabled={isScanning}
              className="h-9 w-9 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
              title="Rescan Drive"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin text-indigo-500" : ""}`} />
            </button>
          )}

          <button
            type="button"
            onClick={onBatchAutoTag}
            disabled={isBatchTagging}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0"
            title="Auto-Tag with AI"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isBatchTagging ? "animate-spin" : ""}`} />
          </button>

          {!user ? (
            <GoogleSignInButton
              onClick={onSignIn}
              text="Connect"
              compact
              className="py-1 px-2 text-xs"
            />
          ) : null}

          {/* Mobile Menu / Drawer Toggle (Available for ALL users) */}
          <button
            id="mobile-nav-toggle-button"
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 transition-colors shrink-0 cursor-pointer"
            title="Toggle Menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-4 h-4" />
            ) : user && user.photoURL ? (
              <img
                src={user.photoURL}
                alt="User"
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu (< md) */}
      {isMobileMenuOpen && (
        <div
          id="mobile-drawer-menu"
          className="md:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3 backdrop-blur-xl shadow-xl animate-in slide-in-from-top-2 duration-150"
        >
          {/* User profile strip OR Demo Status Strip */}
          {user ? (
            <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Profile"
                  className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-700 object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center">
                  {(user.displayName || user.email || "U")[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {user.displayName || user.email}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Drive Connected
                  </span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                    <Database className="w-3 h-3" /> Cloud Synced
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/60">
              <div>
                <div className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                  Interactive Demo Mode
                </div>
                <div className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                  Connect your Google Drive to scan & organize your game assets
                </div>
              </div>
            </div>
          )}

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenOrganize();
              }}
              className="flex items-center justify-center gap-2 min-h-[44px] py-2.5 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 text-indigo-500" />
              <span>Organize on Drive</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onBatchAutoTag();
              }}
              disabled={isBatchTagging}
              className="flex items-center justify-center gap-2 min-h-[44px] py-2.5 px-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-xs font-semibold text-indigo-700 dark:text-indigo-300 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Auto-Tag</span>
            </button>
          </div>

          {/* Auth Button */}
          {user ? (
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onSignOut();
              }}
              className="w-full flex items-center justify-center gap-2 min-h-[44px] py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-semibold cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out & Disconnect</span>
            </button>
          ) : (
            <div className="pt-1">
              <GoogleSignInButton
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onSignIn();
                }}
                text="Connect My Google Drive"
                className="w-full min-h-[44px] py-2.5 text-xs font-semibold"
              />
            </div>
          )}
        </div>
      )}
    </header>
  );
};

