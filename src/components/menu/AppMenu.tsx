import React from 'react';
import { FilePlus, FolderOpen, Save } from 'lucide-react';

interface AppMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNewGraph: () => void;
  onOpenProjectManager: () => void;
  onSaveGraph: () => void;
}

export const AppMenu: React.FC<AppMenuProps> = ({
  isOpen,
  onClose,
  onNewGraph,
  onOpenProjectManager,
  onSaveGraph
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop to dismiss menu */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose} 
      />

      {/* Main Root Dropdown Menu - Minimal: New, Open, Save */}
      <div 
        className="absolute top-[44px] left-[10px] z-50 w-[210px] bg-[#1E1E23] border border-[#33333D] rounded-[10px] py-1 shadow-[0_2px_0_#141417,0_14px_36px_rgba(0,0,0,0.65)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* New Graph */}
        <button
          onClick={() => { onNewGraph(); onClose(); }}
          className="w-full h-[32px] px-3 flex items-center justify-between text-[12px] font-medium text-[#EDEDED] hover:bg-[#282832] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <FilePlus size={14} className="text-[#8E8E96]" />
            <span>New Graph</span>
          </div>
          <span className="shortcut-pill">Ctrl+N</span>
        </button>

        {/* Open */}
        <button
          onClick={() => { onOpenProjectManager(); onClose(); }}
          className="w-full h-[32px] px-3 flex items-center justify-between text-[12px] font-medium text-[#EDEDED] hover:bg-[#282832] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <FolderOpen size={14} className="text-[#8E8E96]" />
            <span>Open...</span>
          </div>
          <span className="shortcut-pill">Ctrl+O</span>
        </button>

        {/* Save */}
        <button
          onClick={() => { onSaveGraph(); onClose(); }}
          className="w-full h-[32px] px-3 flex items-center justify-between text-[12px] font-medium text-[#EDEDED] hover:bg-[#282832] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Save size={14} className="text-[#8E8E96]" />
            <span>Save</span>
          </div>
          <span className="shortcut-pill">Ctrl+S</span>
        </button>
      </div>
    </>
  );
};
