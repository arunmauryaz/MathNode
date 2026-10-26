import { parseGraph } from '../../utils/graphFile';
import React, { useState, useRef } from 'react';
import {
  X,
  Search,
  FileCode2,
  ExternalLink,
  Plus,
  Trash2,
  Copy,
} from 'lucide-react';
import { MathGraph } from '../../types';

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  recentProjects: MathGraph[];
  onOpenGraph: (graph: MathGraph) => void;
  onNewGraph: (customTitle?: string) => void;
  onDeleteRecent: (id: string) => void;
  onDuplicateRecent: (proj: MathGraph) => void;
  onImportGraph: (graph: MathGraph) => void;
  onOpenDocumentation: () => void;
  onNotice: (msg: string) => void;
  showOnStartup?: boolean;
  onToggleStartup?: (checked: boolean) => void;
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  isOpen,
  onClose,
  recentProjects,
  onOpenGraph,
  onNewGraph,
  onDeleteRecent,
  onDuplicateRecent,
  onImportGraph,
  onOpenDocumentation,
  onNotice,
  showOnStartup: showOnStartupProp,
  onToggleStartup,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [localShowStartup, setLocalShowStartup] = useState<boolean>(() => {
    return localStorage.getItem('mn_show_startup') !== 'false';
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const showOnStartup =
    showOnStartupProp !== undefined ? showOnStartupProp : localShowStartup;

  const handleToggleStartup = (checked: boolean) => {
    setLocalShowStartup(checked);
    localStorage.setItem('mn_show_startup', checked ? 'true' : 'false');
    if (onToggleStartup) {
      onToggleStartup(checked);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const importedGraph = parseGraph(content, file.name);
          onImportGraph(importedGraph);
          onNotice(`Imported "${importedGraph.title}"`);
          onClose();
        } catch (error) {
          onNotice(
            error instanceof Error ? error.message : 'Invalid graph file',
          );
        }
      };
      reader.readAsText(file);
    }
  };

  const filteredList = recentProjects.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#121214]/80 backdrop-blur-[2px]">
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative mathnode-modal w-[840px] max-w-[95vw] h-[540px] max-h-[92vh] flex flex-col overflow-hidden z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Titlebar (Height: 48px) */}
        <div className="mathnode-modal-header shrink-0">
          <div className="flex items-center gap-2.5">
            <img
              src="/favicon.png"
              alt="MathNode"
              className="w-[30px] h-[32px] shrink-0"
            />
            <span className="text-[13px] font-semibold text-[#EDEDED] font-sans">
              Projects
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".mathnode,.json"
              onChange={handleImportFile}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-plastic-secondary text-[12px] h-[30px] px-3.5"
              title="Import .mathnode workflow graph from disk"
            >
              Open .mathnode
            </button>
            <button
              onClick={() => {
                onNewGraph();
                onClose();
              }}
              className="btn-plastic-primary text-[12px] h-[30px] px-3.5"
              title="Create new blank mathematical graph"
            >
              <Plus size={13} className="mr-0.5" />
              New file
            </button>
            <button
              onClick={onClose}
              className="btn-plastic-square w-[28px] h-[28px] ml-1 text-[#8E8E96]"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Sub-header navigation: Only Recent files (Templates removed) */}
        <div className="h-[44px] px-6 border-b border-[#2B2B32] bg-[#1E1E22] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold text-[#EDEDED] relative py-2">
              Recent files
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#2563EB] rounded-full" />
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-[200px] h-[26px] pl-6 pr-2 rounded-[5px] bg-[#141417] border border-[#2B2B32] text-[11px] text-[#EDEDED] placeholder-[#686872] focus:outline-none focus:border-[#4B78D8] transition-colors"
            />
            <Search
              size={11}
              className="absolute left-2 top-[7.5px] text-[#686872]"
            />
          </div>
        </div>

        {/* Cards Grid / Empty State */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredList.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {filteredList.map((project) => (
                <div
                  key={project.id}
                  onClick={() => {
                    onOpenGraph(project);
                    onClose();
                  }}
                  className="group bg-[#19191D] border border-[#2B2B32] hover:border-[#3E3E48] rounded-[10px] p-2.5 cursor-pointer transition-all shadow-[0_2px_4px_rgba(0,0,0,0.25)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 relative"
                >
                  {/* Schematic graph thumbnail */}
                  <div className="h-[96px] bg-[#131316] border border-[#222226] rounded-[6px] relative overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#505060_1px,transparent_1px)] [background-size:8px_8px]" />

                    {/* Quick actions on hover */}
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateRecent(project);
                        }}
                        className="p-1 rounded bg-[#1E1E24] hover:bg-[#2A2A33] text-[#8E8E96] hover:text-white transition-colors border border-[#33333D]"
                        title="Duplicate workflow"
                      >
                        <Copy size={11} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRecent(project.id);
                        }}
                        className="p-1 rounded bg-[#1E1E24] hover:bg-[#2A2A33] text-[#8E8E96] hover:text-[#E08BA8] transition-colors border border-[#33333D]"
                        title="Remove from recents"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Project details */}
                  <div className="mt-2.5 px-0.5">
                    <div className="text-[12.5px] font-semibold text-[#EDEDED] group-hover:text-white transition-colors truncate">
                      {project.title}
                    </div>
                    <div className="text-[11px] text-[#8E8E96] mt-0.5 font-sans">
                      {project.lastEdited || 'Recent'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#686872]">
              <FileCode2 size={36} className="mb-3 opacity-30 stroke-[1.5]" />
              <p className="text-[13px] font-medium text-[#8E8E96]">
                {searchQuery
                  ? `No files matching "${searchQuery}"`
                  : 'No recent workflows'}
              </p>
              <p className="text-[11px] text-[#555560] mt-1 max-w-[280px]">
                Workflows you save with{' '}
                <kbd className="bg-[#141416] px-1 py-0.5 rounded text-[#EDEDED] font-mono text-[10px]">
                  Ctrl+S
                </kbd>{' '}
                will be saved and listed here.
              </p>
              {!searchQuery && (
                <button
                  onClick={() => {
                    onNewGraph();
                    onClose();
                  }}
                  className="btn-plastic-primary text-[12px] h-[30px] px-3.5 mt-4"
                >
                  <Plus size={13} className="mr-0.5" />
                  Create New Workflow
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="h-[44px] px-6 border-t border-[#2B2B32] bg-[#1A1A1E] flex items-center justify-between shrink-0 text-[11.5px] text-[#8E8E96]">
          <label className="flex items-center gap-2 cursor-pointer select-none hover:text-[#EDEDED] transition-colors">
            <input
              type="checkbox"
              checked={showOnStartup}
              onChange={(e) => handleToggleStartup(e.target.checked)}
              className="rounded bg-[#141416] border-[#2C2C34] text-[#2563EB] focus:ring-0 cursor-pointer w-3.5 h-3.5"
            />
            <span>Show on startup when no project is open</span>
          </label>

          <button
            onClick={() => {
              onClose();
              onOpenDocumentation();
            }}
            className="flex items-center gap-1 hover:text-[#EDEDED] transition-colors"
          >
            <span>Documentation</span>
            <ExternalLink size={11} />
          </button>
        </div>
      </div>
    </div>
  );
};
