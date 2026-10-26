import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, FolderKanban, Copy, Download, Edit2 } from 'lucide-react';
import { MathGraph } from '../../types';

interface TopBarProps {
  tabs: MathGraph[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string, e?: React.MouseEvent) => void;
  onCloseOtherTabs: (id: string) => void;
  onNewTab: () => void;
  onRenameTab: (id: string, newTitle: string) => void;
  onDuplicateTab: (id: string) => void;
  onExportTab: (id: string) => void;
  onToggleMenu: () => void;
  onOpenProjectManager: () => void;
  isMenuOpen: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onNewTab,
  onRenameTab,
  onDuplicateTab,
  onExportTab,
  onToggleMenu,
  onOpenProjectManager,
  isMenuOpen
}) => {
  // State for inline renaming
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // State for right-click tab context menu
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

  // Close context menu on global click
  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleStartRename = (tab: MathGraph, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTabId(tab.id);
    setEditValue(tab.title);
    setContextMenu(null);
  };

  const handleCommitRename = () => {
    if (editingTabId && editValue.trim()) {
      onRenameTab(editingTabId, editValue.trim());
    }
    setEditingTabId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommitRename();
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
    }
  };

  const handleTabContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      tabId,
      x: e.clientX,
      y: e.clientY
    });
  };

  return (
    <header className="h-[48px] bg-[#1E1E22] border-b border-[#2B2B32] flex items-center justify-between px-3 select-none z-30 shrink-0 relative">
      {/* Left: Launcher, Title, Tabs */}
      <div className="flex items-center gap-3 overflow-hidden flex-1 mr-4">
        {/* Blue Tactile "M" Root Launcher */}
        <button
          onClick={onToggleMenu}
          className={`btn-m-logo shrink-0 ${isMenuOpen ? 'ring-2 ring-[#4B78D8]' : ''}`}
          title="Math Node Menu"
        >
          M
        </button>

        {/* Brand Title */}
        <div className="text-[12px] font-semibold tracking-wider text-[#EDEDED] font-sans shrink-0 uppercase">
          MATH NODE
        </div>

        {/* Divider */}
        <div className="w-[1px] h-[20px] bg-[#2E2E36] shrink-0" />

        {/* Document Tabs Container */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isEditing = editingTabId === tab.id;

            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                onDoubleClick={(e) => handleStartRename(tab, e)}
                onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
                className={`doc-tab ${isActive ? 'active' : 'inactive'} group shrink-0 relative`}
                title={`${tab.title} (Double-click to rename, right-click for options)`}
              >
                {isEditing ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleCommitRename}
                    onKeyDown={handleKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    className="w-[120px] h-[22px] px-1 bg-[#141417] border border-[#4B78D8] rounded text-[12px] text-[#EDEDED] font-sans font-medium focus:outline-none"
                  />
                ) : (
                  <span className="truncate max-w-[140px] font-sans font-medium text-[12px]">
                    {tab.title}
                    {tab.isModified && <span className="ml-1 text-[#60A5FA] font-bold">•</span>}
                  </span>
                )}

                {/* Close tab button */}
                {!isEditing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id, e);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-white hover:bg-[#383842] p-0.5 rounded transition-all ml-1"
                    title="Close tab (Ctrl+W)"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            );
          })}

          {/* New Tab Button */}
          <button
            onClick={onNewTab}
            className="w-[30px] h-[30px] rounded-[6px] bg-[#222226] border border-[#2F2F37] flex items-center justify-center text-[#8E8E96] hover:text-[#EDEDED] hover:bg-[#2A2A30] active:scale-95 transition-all shrink-0"
            title="Create new blank graph (Ctrl+N)"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Right Area: Keep clean and open per design guide §6.1 & §9 */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenProjectManager}
          className="btn-plastic-secondary text-[11.5px] py-1 px-3 h-[28px] gap-1.5 text-[#A0A0A8]"
          title="Open Project & File Manager"
        >
          <FolderKanban size={13} className="text-[#8E8E96]" />
          <span>Projects</span>
        </button>
      </div>

      {/* Right-click Tab Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 w-[180px] bg-[#1E1E23] border border-[#33333D] rounded-[8px] py-1 shadow-[0_4px_16px_rgba(0,0,0,0.6)] text-[12px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const targetTab = tabs.find(t => t.id === contextMenu.tabId);
            if (!targetTab) return null;
            return (
              <>
                <button
                  onClick={() => handleStartRename(targetTab)}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-[#D1D1D8] hover:text-white hover:bg-[#282832] text-left transition-colors"
                >
                  <Edit2 size={12} className="text-[#8E8E96]" />
                  <span>Rename</span>
                </button>

                <button
                  onClick={() => {
                    onDuplicateTab(contextMenu.tabId);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-[#D1D1D8] hover:text-white hover:bg-[#282832] text-left transition-colors"
                >
                  <Copy size={12} className="text-[#8E8E96]" />
                  <span>Duplicate Graph</span>
                </button>

                <button
                  onClick={() => {
                    onExportTab(contextMenu.tabId);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-[#D1D1D8] hover:text-white hover:bg-[#282832] text-left transition-colors"
                >
                  <Download size={12} className="text-[#8E8E96]" />
                  <span>Export (.mathnode)</span>
                </button>

                <div className="my-1 border-t border-[#2A2A33]" />

                <button
                  onClick={() => {
                    onCloseTab(contextMenu.tabId);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-[#E08BA8] hover:bg-[#282832] text-left transition-colors"
                >
                  <X size={12} />
                  <span>Close Tab</span>
                </button>

                {tabs.length > 1 && (
                  <button
                    onClick={() => {
                      onCloseOtherTabs(contextMenu.tabId);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-[#8E8E96] hover:text-white hover:bg-[#282832] text-left transition-colors"
                  >
                    <span>Close Other Tabs</span>
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}
    </header>
  );
};
