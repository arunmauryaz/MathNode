import { useNodePreview } from '../../hooks/useNodePreview';
import { NodePreview } from '../nodes/NodePreview';
import { matchesNode } from '../../utils/graphRules';
import React, { useState } from 'react';
import {
  Search,
  X,
  Box,
  Folder,
  ChevronDown,
  ChevronRight,
  Package,
  Plus,
  Boxes,
} from 'lucide-react';
import { MathNodeFolder, NodeDefinition } from '../../types';
import { MathIcon } from '../nodes/MathIcon';

interface NodeLibraryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  folders: MathNodeFolder[];
  nodes: NodeDefinition[];
  onOpenPackageManager: () => void;
  onSpawnNode?: (definitionId: string) => void;
}

export const NodeLibraryDrawer: React.FC<NodeLibraryDrawerProps> = ({
  isOpen,
  onClose,
  folders,
  nodes,
  onOpenPackageManager,
  onSpawnNode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const preview = useNodePreview(isOpen);
  const [expandedFolders, setExpandedFolders] = useState<
    Record<string, boolean>
  >({});

  if (!isOpen) return null;

  const toggleFolder = (folderId: string) => {
    preview.hide();
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: prev[folderId] !== undefined ? !prev[folderId] : false,
    }));
  };

  // Filtered nodes
  const matchesSearch = (node: NodeDefinition) => {
    return matchesNode(node, searchQuery);
  };

  // Helper to count ALL nodes inside a folder
  const getNodeCountForFolder = (folderId: string): number => {
    const descendantFolderIds = new Set<string>([folderId]);
    let added = true;
    while (added) {
      added = false;
      for (const f of folders) {
        if (
          f.parentId &&
          descendantFolderIds.has(f.parentId) &&
          !descendantFolderIds.has(f.id)
        ) {
          descendantFolderIds.add(f.id);
          added = true;
        }
      }
    }
    return nodes.filter(
      (n) => n.folderId && descendantFolderIds.has(n.folderId),
    ).length;
  };

  // Group nodes by folderId
  const rootNodes = nodes
    .filter((n) => !n.folderId || !folders.some((f) => f.id === n.folderId))
    .filter(matchesSearch);

  return (
    <div
      data-node-preview-surface
      className="w-[240px] bg-[#1B1B1E] border-r border-[#26262B] flex flex-col h-full z-10 shrink-0 select-none"
    >
      {/* Drawer Header */}
      <div className="p-3 border-b border-[#26262B]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-[#686872] tracking-wider uppercase">
            NODE LIBRARY
          </span>
          <button
            onClick={onClose}
            className="text-[#8E8E96] hover:text-[#EDEDED] p-0.5 rounded transition-colors"
            title="Close drawer"
          >
            <X size={12} />
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              preview.hide();
              setSearchQuery(e.target.value);
            }}
            placeholder="Search math nodes..."
            className="w-full h-[28px] pl-7 pr-2.5 rounded-[5px] bg-[#141416] border border-[#28282E] text-[11.5px] text-[#EDEDED] placeholder-[#686872] focus:outline-none focus:border-[#4B78D8] transition-colors"
          />
          <Search
            size={12}
            className="absolute left-2.5 top-[8px] text-[#686872]"
          />
        </div>
      </div>

      {/* Library Body */}
      <div
        data-node-preview-list
        className="flex-1 overflow-y-auto p-2"
        onScroll={() => {
          if (preview.target?.anchor !== document.activeElement) preview.hide();
        }}
      >
        {nodes.length > 0 ? (
          <div className="space-y-1.5">
            {/* User & Package Folders */}
            {folders.map((folder) => {
              const nodesInFolder = nodes
                .filter((n) => n.folderId === folder.id)
                .filter(matchesSearch);
              const isExpanded = searchQuery
                ? true
                : (expandedFolders[folder.id] ?? true);

              return (
                <div key={folder.id} className="rounded-[5px] overflow-hidden">
                  <div
                    onClick={() => toggleFolder(folder.id)}
                    className="flex items-center justify-between px-2 py-1.5 rounded-[4px] cursor-pointer text-[#8E8E96] hover:text-[#EDEDED] hover:bg-[#222228] transition-colors text-[11px] font-medium"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {isExpanded ? (
                        <ChevronDown size={11} />
                      ) : (
                        <ChevronRight size={11} />
                      )}
                      <Folder size={12} className="text-[#E0B05C] shrink-0" />
                      <span className="truncate">{folder.name}</span>
                    </div>
                    <span className="font-mono text-[9.5px] text-[#555560]">
                      {getNodeCountForFolder(folder.id)}
                    </span>
                  </div>

                  {isExpanded && nodesInFolder.length > 0 && (
                    <div className="pl-4 pr-1 py-1 space-y-1">
                      {nodesInFolder.map((node) => (
                        <div
                          key={node.id}
                          data-library-node={node.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Add ${node.name}`}
                          aria-describedby={
                            preview.target?.definition.id === node.id
                              ? preview.id
                              : undefined
                          }
                          onMouseEnter={(e) =>
                            preview.show(node, e.currentTarget)
                          }
                          onMouseLeave={preview.hideSoon}
                          onFocus={(e) =>
                            preview.show(node, e.currentTarget, true)
                          }
                          onBlur={preview.hideSoon}
                          onKeyDown={(e) => {
                            if (e.key === 'Tab') e.stopPropagation();
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              preview.hide();
                              onSpawnNode?.(node.id);
                            }
                          }}
                          draggable
                          onDragStart={(e) => {
                            preview.hide();
                            e.dataTransfer.setData(
                              'application/mathnode-def',
                              node.id,
                            );
                          }}
                          onClick={() => {
                            preview.hide();
                            onSpawnNode?.(node.id);
                          }}
                          className="px-2 py-1.5 rounded-[5px] bg-[#141417] border border-[#24242A] hover:border-[#3D3D4A] hover:bg-[#1A1A20] flex items-center justify-between gap-1.5 cursor-grab active:cursor-grabbing transition-all group"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <MathIcon
                              name={node.icon || 'function'}
                              size={12}
                              className="text-[#60A5FA] shrink-0"
                            />
                            {node.composite && (
                              <Boxes
                                size={11}
                                className="text-[#8E8E96] shrink-0"
                              />
                            )}
                            <span className="text-[11.5px] font-medium text-[#D1D1D8] group-hover:text-white truncate">
                              {node.name}
                            </span>
                          </div>
                          <Plus
                            size={11}
                            className="text-[#8E8E96] opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unassigned / Root Nodes */}
            {rootNodes.length > 0 && (
              <div className="rounded-[5px] overflow-hidden pt-1">
                {folders.length > 0 && (
                  <div className="px-2 py-1 text-[9.5px] font-semibold text-[#686872] uppercase tracking-wider">
                    Unassigned Nodes
                  </div>
                )}
                <div className="space-y-1">
                  {rootNodes.map((node) => (
                    <div
                      key={node.id}
                      data-library-node={node.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Add ${node.name}`}
                      aria-describedby={
                        preview.target?.definition.id === node.id
                          ? preview.id
                          : undefined
                      }
                      onMouseEnter={(e) => preview.show(node, e.currentTarget)}
                      onMouseLeave={preview.hideSoon}
                      onFocus={(e) => preview.show(node, e.currentTarget, true)}
                      onBlur={preview.hideSoon}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab') e.stopPropagation();
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          preview.hide();
                          onSpawnNode?.(node.id);
                        }
                      }}
                      draggable
                      onDragStart={(e) => {
                        preview.hide();
                        e.dataTransfer.setData(
                          'application/mathnode-def',
                          node.id,
                        );
                      }}
                      onClick={() => {
                        preview.hide();
                        onSpawnNode?.(node.id);
                      }}
                      className="px-2 py-1.5 rounded-[5px] bg-[#141417] border border-[#24242A] hover:border-[#3D3D4A] hover:bg-[#1A1A20] flex items-center justify-between gap-1.5 cursor-grab active:cursor-grabbing transition-all group"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <MathIcon
                          name={node.icon || 'function'}
                          size={12}
                          className="text-[#60A5FA] shrink-0"
                        />
                        {node.composite && (
                          <Boxes
                            size={11}
                            className="text-[#8E8E96] shrink-0"
                          />
                        )}
                        <span className="text-[11.5px] font-medium text-[#D1D1D8] group-hover:text-white truncate">
                          {node.name}
                        </span>
                      </div>
                      <Plus
                        size={11}
                        className="text-[#8E8E96] opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty state */
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-[#686872]">
            <Box size={24} className="mb-2 opacity-30 stroke-[1.5]" />
            <p className="text-[11.5px] font-medium text-[#8E8E96]">
              No nodes installed
            </p>
            <p className="text-[10px] text-[#555560] mt-1 leading-normal max-w-[170px]">
              Use the Package Manager to install custom .mnode operators or .zip
              packages.
            </p>
            <button
              onClick={onOpenPackageManager}
              className="btn-plastic-secondary text-[11px] h-[26px] px-2.5 mt-3 flex items-center gap-1.5"
            >
              <Package size={12} />
              <span>Package Manager</span>
            </button>
          </div>
        )}
      </div>
      {preview.target && (
        <NodePreview
          {...preview.target}
          id={preview.id}
          onDismiss={preview.hide}
          onEnter={preview.cancelClose}
          onLeave={preview.hideSoon}
        />
      )}
    </div>
  );
};
