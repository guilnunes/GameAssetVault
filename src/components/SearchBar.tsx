import React, { useState } from "react";
import { Search, Sparkles, X, SlidersHorizontal, Grid, List, ArrowDownAZ, ArrowUpAZ, Clock, HardDrive } from "lucide-react";
import { SearchFilterState, SmartSearchResponse } from "../types";

interface SearchBarProps {
  filters: SearchFilterState;
  onFilterChange: (filters: SearchFilterState) => void;
  onSmartSearchParsed?: (data: SmartSearchResponse) => void;
  totalCount: number;
  filteredCount: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  filters,
  onFilterChange,
  onSmartSearchParsed,
  totalCount,
  filteredCount,
}) => {
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<SmartSearchResponse | null>(null);

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = filters.searchQuery.trim();
    if (!query) {
      setAiAnalysis(null);
      return;
    }

    // Call server Gemini endpoint to parse smart game search intent
    setIsAiSearching(true);
    try {
      const res = await fetch("/api/smart-search-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (res.ok) {
        const data: SmartSearchResponse = await res.json();
        setAiAnalysis(data);
        if (onSmartSearchParsed) {
          onSmartSearchParsed(data);
        }
      }
    } catch (err) {
      console.warn("Smart search query error:", err);
    } finally {
      setIsAiSearching(false);
    }
  };

  const quickPrompts = [
    "tense boss battle music",
    "sword slash sound fx",
    "pixel knight character",
    "inventory gold frame",
    "low poly 3d chest",
  ];

  return (
    <div id="game-asset-search-section" className="w-full space-y-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search input with AI intelligence */}
        <form
          onSubmit={handleSearchSubmit}
          className="relative flex-1 flex items-center"
        >
          <div className="absolute left-3.5 text-zinc-400 pointer-events-none">
            <Search className="w-5 h-5" />
          </div>
          <input
            id="game-asset-search-input"
            type="text"
            value={filters.searchQuery}
            onChange={(e) =>
              onFilterChange({ ...filters, searchQuery: e.target.value })
            }
            placeholder="Search game assets by name, #tag, or natural prompt (e.g. 'retro battle music')..."
            className="w-full pl-11 pr-24 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-xs"
          />

          <div className="absolute right-2.5 flex items-center gap-1.5">
            {filters.searchQuery && (
              <button
                id="search-clear-button"
                type="button"
                onClick={() => {
                  onFilterChange({ ...filters, searchQuery: "" });
                  setAiAnalysis(null);
                }}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <button
              id="gemini-smart-search-trigger"
              type="submit"
              disabled={isAiSearching || !filters.searchQuery.trim()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-xs font-semibold border border-indigo-200 dark:border-indigo-800 transition-all disabled:opacity-40 cursor-pointer"
              title="Enhance search with Gemini AI"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAiSearching ? "animate-spin" : ""}`} />
              <span className="hidden md:inline">AI Filter</span>
            </button>
          </div>
        </form>

        {/* Sort & View toggles */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="relative">
            <select
              id="asset-sort-select"
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split("-") as [
                  SearchFilterState["sortBy"],
                  SearchFilterState["sortOrder"]
                ];
                onFilterChange({ ...filters, sortBy, sortOrder });
              }}
              className="px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-xs"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="modifiedTime-desc">Recently Modified</option>
              <option value="modifiedTime-asc">Oldest First</option>
              <option value="size-desc">Largest File</option>
              <option value="size-asc">Smallest File</option>
              <option value="category-asc">By Category</option>
            </select>
          </div>

          <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 shadow-xs">
            <button
              id="view-mode-grid"
              type="button"
              onClick={() => onFilterChange({ ...filters, viewMode: "grid" })}
              className={`p-1.5 rounded-md transition-colors ${
                filters.viewMode === "grid"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              id="view-mode-list"
              type="button"
              onClick={() => onFilterChange({ ...filters, viewMode: "list" })}
              className={`p-1.5 rounded-md transition-colors ${
                filters.viewMode === "list"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Prompts & AI feedback */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-zinc-400 dark:text-zinc-500">Quick queries:</span>
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => {
                onFilterChange({ ...filters, searchQuery: prompt });
                setTimeout(() => handleSearchSubmit(), 50);
              }}
              className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="tabular-nums">
          Showing <strong className="text-zinc-800 dark:text-zinc-200">{filteredCount}</strong> of {totalCount} assets
        </div>
      </div>

      {/* Smart AI Search breakdown strip */}
      {aiAnalysis && (
        <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 dark:text-indigo-300">
              <Sparkles className="w-3.5 h-3.5" /> AI Analysis:
            </span>
            <span className="text-zinc-600 dark:text-zinc-300">{aiAnalysis.explanation}</span>
            {aiAnalysis.categories.length > 0 && (
              <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 font-medium">
                Categories: {aiAnalysis.categories.join(", ")}
              </span>
            )}
            {aiAnalysis.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 font-mono"
              >
                #{tag}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAiAnalysis(null)}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
            title="Dismiss AI hint"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
