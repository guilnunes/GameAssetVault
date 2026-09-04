import React from "react";
import {
  Image,
  Music,
  Volume2,
  LayoutGrid,
  Box,
  Type,
  FileText,
  Layers,
  Tag,
  X,
  Filter,
} from "lucide-react";
import { AssetCategory, SearchFilterState, EnrichedAsset } from "../types";
import { CATEGORIES } from "../data/categories";

interface CategoryFilterProps {
  filters: SearchFilterState;
  onFilterChange: (filters: SearchFilterState) => void;
  assets: EnrichedAsset[];
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  filters,
  onFilterChange,
  assets,
}) => {
  const [showAllTags, setShowAllTags] = React.useState(false);

  // Compute counts per category
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: assets.length };
    CATEGORIES.forEach((cat) => {
      counts[cat.id] = 0;
    });
    assets.forEach((asset) => {
      if (counts[asset.category] !== undefined) {
        counts[asset.category]++;
      } else {
        counts.other = (counts.other || 0) + 1;
      }
    });
    return counts;
  }, [assets]);

  // Extract all smart tags & user tags with their frequencies
  const tagFrequencies = React.useMemo(() => {
    const map = new Map<string, number>();
    assets.forEach((asset) => {
      const allTags = [
        ...asset.userTags,
        ...(asset.smart?.smartTags || []),
      ];
      // Deduplicate tags for this asset
      new Set(allTags).forEach((tag) => {
        const clean = tag.replace(/^#/, "").toLowerCase().trim();
        if (clean.length > 1) {
          map.set(clean, (map.get(clean) || 0) + 1);
        }
      });
    });

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }, [assets]);

  // Extract common file extensions
  const extensions = React.useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => {
      if (a.extension) set.add(a.extension);
    });
    return Array.from(set).sort();
  }, [assets]);

  const getCategoryIcon = (id: string) => {
    switch (id) {
      case "imagery":
        return <Image className="w-4 h-4" />;
      case "music":
        return <Music className="w-4 h-4" />;
      case "sound":
        return <Volume2 className="w-4 h-4" />;
      case "ui":
        return <LayoutGrid className="w-4 h-4" />;
      case "3d":
        return <Box className="w-4 h-4" />;
      case "fonts":
        return <Type className="w-4 h-4" />;
      case "docs":
        return <FileText className="w-4 h-4" />;
      default:
        return <Layers className="w-4 h-4" />;
    }
  };

  const toggleTag = (tag: string) => {
    const exists = filters.selectedTags.includes(tag);
    const next = exists
      ? filters.selectedTags.filter((t) => t !== tag)
      : [...filters.selectedTags, tag];
    onFilterChange({ ...filters, selectedTags: next });
  };

  const clearAllFilters = () => {
    onFilterChange({
      ...filters,
      category: "all",
      selectedTags: [],
      extension: "all",
      searchQuery: "",
      onlyFavorites: false,
    });
  };

  const hasActiveFilters =
    filters.category !== "all" ||
    filters.selectedTags.length > 0 ||
    filters.extension !== "all" ||
    Boolean(filters.searchQuery) ||
    filters.onlyFavorites;

  const visibleTags = showAllTags ? tagFrequencies : tagFrequencies.slice(0, 8);

  return (
    <div id="game-asset-filter-bar" className="w-full space-y-3">
      {/* Category Pills Bar with Edge-to-Edge Mobile Scrolling */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar -mx-3 sm:mx-0 px-3 sm:px-0 touch-pan-x">
        <button
          id="category-pill-all"
          type="button"
          onClick={() => onFilterChange({ ...filters, category: "all" })}
          className={`flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
            filters.category === "all"
              ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs"
              : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>All Game Assets</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
              filters.category === "all"
                ? "bg-zinc-700 dark:bg-zinc-300 text-white dark:text-zinc-900"
                : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
            }`}
          >
            {categoryCounts.all || 0}
          </span>
        </button>

        {CATEGORIES.map((cat) => {
          const isSelected = filters.category === cat.id;
          const count = categoryCounts[cat.id] || 0;
          return (
            <button
              key={cat.id}
              id={`category-pill-${cat.id}`}
              type="button"
              onClick={() =>
                onFilterChange({
                  ...filters,
                  category: isSelected ? "all" : cat.id,
                })
              }
              className={`flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {getCategoryIcon(cat.id)}
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  isSelected
                    ? "bg-indigo-500 text-white"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Smart Tags & Extension Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-zinc-200/70 dark:border-zinc-800/80">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 text-xs font-semibold text-zinc-400 dark:text-zinc-500 mr-1">
            <Tag className="w-3.5 h-3.5" />
            <span>Tags:</span>
          </div>

          {visibleTags.map(([tag, count]) => {
            const isSelected = filters.selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`inline-flex items-center gap-1 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800/70 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <span>#{tag}</span>
                <span
                  className={`text-[10px] opacity-75 ${
                    isSelected ? "text-indigo-200" : "text-zinc-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {tagFrequencies.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAllTags(!showAllTags)}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 cursor-pointer"
            >
              {showAllTags ? "Show less" : `+${tagFrequencies.length - 8} more`}
            </button>
          )}
        </div>

        {/* Extension Filter & Reset Button */}
        <div className="flex items-center justify-between sm:justify-end gap-2 self-stretch sm:self-auto pt-1 sm:pt-0">
          {extensions.length > 0 && (
            <select
              id="file-extension-filter"
              value={filters.extension}
              onChange={(e) =>
                onFilterChange({ ...filters, extension: e.target.value })
              }
              className="min-h-[36px] px-2.5 py-1 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All File Formats</option>
              {extensions.map((ext) => (
                <option key={ext} value={ext}>
                  .{ext.toUpperCase()}
                </option>
              ))}
            </select>
          )}

          {hasActiveFilters && (
            <button
              id="clear-all-filters-button"
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 min-h-[36px] px-2.5 py-1 rounded-lg text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
