import React from 'react'
import { LayoutGrid, List, BookOpen } from 'lucide-react'

type ViewMode = 'grid' | 'list' | 'detail'

interface ViewToggleProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onManageGames: () => void
}

export const ViewToggle: React.FC<ViewToggleProps> = ({
  viewMode,
  onViewModeChange,
  onManageGames
}) => {
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

      <div className="ml-auto">
        <button
          className="text-sm text-muted flex items-center hover:text-app-primary"
          onClick={onManageGames}
        >
          Manage Games
        </button>
      </div>
    </div>
  )
}

export default ViewToggle
