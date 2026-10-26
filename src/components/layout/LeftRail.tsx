import React from 'react';
import { LayoutGrid, Package, Settings } from 'lucide-react';

interface LeftRailProps {
  isNodeLibraryOpen: boolean;
  onToggleNodeLibrary: () => void;
  onOpenPackageManager: () => void;
  onOpenSettings: () => void;
}

export const LeftRail: React.FC<LeftRailProps> = ({
  isNodeLibraryOpen,
  onToggleNodeLibrary,
  onOpenPackageManager,
  onOpenSettings
}) => {
  return (
    <aside className="w-[44px] bg-[#18181B] border-r border-[#2B2B32] flex flex-col justify-between items-center py-2 z-20 shrink-0 select-none">
      {/* Top: Node Library toggle */}
      <div className="flex flex-col items-center w-full">
        <button
          onClick={onToggleNodeLibrary}
          className={`w-[32px] h-[32px] rounded-[6px] flex items-center justify-center transition-colors ${
            isNodeLibraryOpen
              ? 'bg-[#2A2A33] border border-[#3A3A46] text-[#FFFFFF]'
              : 'text-[#8E8E96] hover:text-[#EDEDED] hover:bg-[#222226]'
          }`}
          title="Node Library"
        >
          <LayoutGrid size={16} />
        </button>
      </div>

      {/* Bottom utilities: Package Manager [📦] and Settings [⚙] */}
      <div className="flex flex-col items-center gap-1.5 pb-1">
        <button
          onClick={onOpenPackageManager}
          className="btn-plastic-square w-[32px] h-[32px]"
          title="Package Manager (Install & Organize Nodes)"
        >
          <Package size={15} />
        </button>

        <button
          onClick={onOpenSettings}
          className="btn-plastic-square w-[32px] h-[32px]"
          title="Settings & Preferences"
        >
          <Settings size={15} />
        </button>
      </div>
    </aside>
  );
};
