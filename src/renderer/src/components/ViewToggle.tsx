import React from 'react'
import { LayoutGrid, List, BookOpen, ArrowUp, ArrowDown } from 'lucide-react'

type ViewMode = 'grid' | 'list' | 'detail'

export type SortField = 'lastPlayed' | 'playtime' | 'alphabetical' | 'created'

interface ViewToggleProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onManageGames: () => void
  sortField: SortField
  sortDesc: boolean
  onSortChange: (field: SortField, desc: boolean) => void
}

const SORT_LABELS: Record<SortField, string> = {
  lastPlayed: 'Last Played',
  playtime: 'Playtime',
  alphabetical: 'A–Z',
  created: 'Created'
}

export const ViewToggle: React.FC<ViewToggleProps> = ({
  viewMode,
  onViewModeChange,
  onManageGames,
  sortField,
  sortDesc,
  onSortChange
}) => {
  const [showSortDropdown, setShowSortDropdown] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  React.useEffect(() => {
    if (!showSortDropdown) return
    const handleClick = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showSortDropdown])

  const cycleSort = (field: SortField): void => {
    if (field === sortField) {
      // Toggle direction
      onSortChange(field, !sortDesc)
    } else {
      // New field — default to descending for time-based, ascending for alphabetical
      const desc = field !== 'alphabetical'
      onSortChange(field, desc)
    }
    setShowSortDropdown(false)
  }

  return (
    <div className="px-4 py-2 bg-app-secondary flex items-center border-b border-app shrink-0">
      <div className="flex space-x-1">
        {[
          { mode: 'grid' as ViewMode, icon: LayoutGrid, label: 'Grid' },
          { mode: 'list' as ViewMode, icon: List, label: 'List' },
          { mode: 'detail' as ViewMode, icon: BookOpen, label: 'Detail' }
        ].map(({ mode, icon: Icon, label }) => {
          const active = viewMode === mode
          return (
            <button
              key={mode}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                active
                  ? 'text-accent-highlight bg-app-primary shadow-sm'
                  : 'text-app-muted hover:text-app-primary hover:bg-app-hover'
              }`}
              onClick={() => onViewModeChange(mode)}
              title={label}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-accent-highlight' : ''}`} />
              {active && <span className="text-[10px] uppercase tracking-wider">{label}</span>}
            </button>
          )
        })}
      </div>

      {/* Sort control */}
      <div className="relative ml-4" ref={dropdownRef}>
        <button
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
            showSortDropdown
              ? 'text-accent-highlight bg-app-primary shadow-sm'
              : 'text-app-muted hover:text-app-primary hover:bg-app-hover'
          }`}
          onClick={() => setShowSortDropdown(!showSortDropdown)}
          title="Sort protocols"
        >
          {sortDesc ? (
            <ArrowDown className="h-3.5 w-3.5" />
          ) : (
            <ArrowUp className="h-3.5 w-3.5" />
          )}
          <span>{SORT_LABELS[sortField]}</span>
        </button>

        {showSortDropdown && (
          <div className="absolute left-0 top-full mt-1 bg-app-secondary border border-app rounded-lg shadow-xl z-50 py-1 min-w-40">
            {(Object.keys(SORT_LABELS) as SortField[]).map((field) => {
              const active = field === sortField
              return (
                <button
                  key={field}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                    active
                      ? 'text-accent-highlight bg-app-primary'
                      : 'text-app-muted hover:text-app-primary hover:bg-app-hover'
                  }`}
                  onClick={() => cycleSort(field)}
                >
                  <span className="flex-1 text-left">{SORT_LABELS[field]}</span>
                  {active && (
                    sortDesc ? (
                      <ArrowDown className="h-3 w-3 shrink-0" />
                    ) : (
                      <ArrowUp className="h-3 w-3 shrink-0" />
                    )
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="ml-auto">
        <button
          className="text-sm text-muted flex items-center hover:text-app-primary"
          onClick={onManageGames}
        >
          Manage Protocols
        </button>
      </div>
    </div>
  )
}

export default ViewToggle
