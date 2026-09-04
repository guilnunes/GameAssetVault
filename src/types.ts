export type AssetCategory =
  | "imagery"
  | "music"
  | "sound"
  | "ui"
  | "3d"
  | "fonts"
  | "docs"
  | "other";

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string; // in bytes
  modifiedTime?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  iconLink?: string;
  parents?: string[];
  description?: string;
  properties?: Record<string, string>;
  appProperties?: Record<string, string>;
}

export interface SmartMetadata {
  category: AssetCategory;
  subCategory: string;
  smartTags: string[];
  moodStyle: string;
  suggestedFolder: string;
  summary: string;
  analyzedAt?: string;
}

export interface EnrichedAsset extends DriveFileItem {
  category: AssetCategory;
  extension: string;
  isFolder: boolean;
  smart?: SmartMetadata;
  userTags: string[];
  isFavorite?: boolean;
  notes?: string;
  updatedAt?: string;
  userId?: string;
}

export interface AssetCollection {
  id: string;
  name: string;
  description?: string;
  color?: string;
  assetIds: string[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  userId: string;
  defaultViewMode: "grid" | "list";
  defaultSortBy: "name" | "modifiedTime" | "size" | "category";
  selectedDriveFolder?: string;
  updatedAt?: string;
}

export interface CategoryInfo {
  id: AssetCategory;
  label: string;
  iconName: string;
  color: string;
  bgLight: string;
  badgeBg: string;
  badgeText: string;
  description: string;
}

export interface SearchFilterState {
  searchQuery: string;
  category: AssetCategory | "all";
  selectedTags: string[];
  extension: string | "all";
  folderId: string | "all";
  sortBy: "name" | "modifiedTime" | "size" | "category";
  sortOrder: "asc" | "desc";
  viewMode: "grid" | "list";
  onlyFavorites?: boolean;
}

export interface SmartSearchResponse {
  categories: string[];
  keywords: string[];
  tags: string[];
  mood?: string;
  driveQueryHints?: string[];
  explanation: string;
}

export interface OrganizationSuggestion {
  targetFolder: string;
  files: EnrichedAsset[];
}
