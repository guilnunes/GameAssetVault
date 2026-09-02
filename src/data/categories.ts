import { AssetCategory, CategoryInfo } from "../types";

export const CATEGORIES: CategoryInfo[] = [
  {
    id: "imagery",
    label: "2D Sprites & Textures",
    iconName: "Image",
    color: "#10b981", // Emerald
    bgLight: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    badgeBg: "bg-emerald-100 dark:bg-emerald-950/60",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    description: "Spritesheets, tilesets, textures, concept art, backgrounds",
  },
  {
    id: "music",
    label: "Music & Ambience",
    iconName: "Music",
    color: "#8b5cf6", // Violet
    bgLight: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    badgeBg: "bg-violet-100 dark:bg-violet-950/60",
    badgeText: "text-violet-700 dark:text-violet-300",
    description: "Looping BGM, battle themes, ambient tracks, taverns, cutscenes",
  },
  {
    id: "sound",
    label: "Sound FX (SFX)",
    iconName: "Volume2",
    color: "#f59e0b", // Amber
    bgLight: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    badgeBg: "bg-amber-100 dark:bg-amber-950/60",
    badgeText: "text-amber-700 dark:text-amber-300",
    description: "Weapons, spells, footsteps, foley, UI feedback clicks, impacts",
  },
  {
    id: "ui",
    label: "UI & HUD",
    iconName: "LayoutGrid",
    color: "#3b82f6", // Blue
    bgLight: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    badgeBg: "bg-blue-100 dark:bg-blue-950/60",
    badgeText: "text-blue-700 dark:text-blue-300",
    description: "Icons, inventory grids, health gauges, buttons, cursors, frames",
  },
  {
    id: "3d",
    label: "3D Models & Rigs",
    iconName: "Box",
    color: "#ec4899", // Pink
    bgLight: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
    badgeBg: "bg-pink-100 dark:bg-pink-950/60",
    badgeText: "text-pink-700 dark:text-pink-300",
    description: "FBX, OBJ, GLTF/GLB, Blender files, animations, props, characters",
  },
  {
    id: "fonts",
    label: "Fonts & Typography",
    iconName: "Type",
    color: "#06b6d4", // Cyan
    bgLight: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    badgeBg: "bg-cyan-100 dark:bg-cyan-950/60",
    badgeText: "text-cyan-700 dark:text-cyan-300",
    description: "Bitmap fonts, pixel fonts, fantasy serif, arcade TTF/OTF",
  },
  {
    id: "docs",
    label: "Game Docs & Data",
    iconName: "FileText",
    color: "#64748b", // Slate
    bgLight: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    badgeBg: "bg-slate-100 dark:bg-slate-900/60",
    badgeText: "text-slate-700 dark:text-slate-300",
    description: "Game design docs, balance sheets, JSON dialogue, configs",
  },
];

export function getCategoryInfo(category: AssetCategory): CategoryInfo {
  const found = CATEGORIES.find((c) => c.id === category);
  if (found) return found;
  return {
    id: "other",
    label: "Other Assets",
    iconName: "File",
    color: "#71717a",
    bgLight: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
    badgeBg: "bg-zinc-100 dark:bg-zinc-800",
    badgeText: "text-zinc-700 dark:text-zinc-300",
    description: "Uncategorized game files",
  };
}

export function formatFileSize(bytesStr?: string): string {
  if (!bytesStr) return "Unknown";
  const bytes = parseInt(bytesStr, 10);
  if (isNaN(bytes)) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
