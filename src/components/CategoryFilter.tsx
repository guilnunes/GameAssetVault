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
      .slice(0, 16);
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
    });
  };

  const hasActiveFilters =
    filters.category !== "all" ||
    filters.selectedTags.length > 0 ||
    filters.extension !== "all" ||
    Boolean(filters.searchQuery);

  return (
    <div id="game-asset-filter-bar" className="w-full space-y-3.5">
      {/* Category Pills Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none no-scrollbar">
        <button
          id="category-pill-all"
          type="button"
          onClick={() => onFilterChange({ ...filters, category: "all" })}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            filters.category === "all"
              ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs"
              : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Game Assets</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full ${
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
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {getCategoryIcon(cat.id)}
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
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
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 text-xs font-semibold text-zinc-400 dark:text-zinc-500 mr-1">
            <Tag className="w-3.5 h-3.5" />
            <span>Smart Tags:</span>
          </div>

          {tagFrequencies.map(([tag, count]) => {
            const isSelected = filters.selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800/60 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <span>#{tag}</span>
                <span
                  className={`text-[10px] opacity-70 ${
                    isSelected ? "text-indigo-200" : "text-zinc-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Extension Filter & Reset */}
        <div className="flex items-center gap-2">
          {extensions.length > 0 && (
            <select
              id="file-extension-filter"
              value={filters.extension}
              onChange={(e) =>
                onFilterChange({ ...filters, extension: e.target.value })
              }
              className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Formats</option>
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
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
