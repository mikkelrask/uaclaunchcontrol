import React from 'react';
import { LayoutGrid, List, BookOpen } from 'lucide-react';

type ViewMode = 'grid' | 'list' | 'detail';

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onManageGames: () => void;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({ 
  viewMode, 
  onViewModeChange,
  onManageGames
}) => {
  return (
    <div className="px-4 py-2 bg-[#162b3d] flex items-center border-b border-[#262626]">
      <div className="flex space-x-2">
        <button 
          className={`w-8 h-8 rounded flex items-center justify-center hover:bg-[#162b3d] ${viewMode === 'grid' ? 'bg-[#0c1c2a]' : 'bg-[#0c1c2a]/70'}`}
          onClick={() => onViewModeChange('grid')}
        >
          <LayoutGrid className="h-5 w-5" />
        </button>
        <button 
          className={`w-8 h-8 rounded flex items-center justify-center hover:bg-[#162b3d] ${viewMode === 'list' ? 'bg-[#0c1c2a]' : 'bg-[#0c1c2a]/70'}`}
          onClick={() => onViewModeChange('list')}
        >
          <List className="h-5 w-5" />
        </button>
        <button 
          className={`w-8 h-8 rounded flex items-center justify-center hover:bg-[#162b3d] ${viewMode === 'detail' ? 'bg-[#0c1c2a]' : 'bg-[#0c1c2a]/70'}`}
          onClick={() => onViewModeChange('detail')}
        >
          <BookOpen className="h-5 w-5" />
        </button>
      </div>
      
      <div className="ml-auto">
        <button 
          className="text-sm font-mono flex items-center hover:text-white"
          onClick={onManageGames}
        >
          Manage Games
        </button>
      </div>
    </div>
  );
};

export default ViewToggle;
