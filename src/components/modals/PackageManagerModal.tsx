import { downloadMNode } from '../../utils/compositeNodes';
import { mergeDefinitions, readNodePackage } from '../../utils/nodePackage';
import React, { useState, useRef } from 'react';
import {
  X,
  Search,
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Upload,
  Trash2,
  Layers,
  FileCode,
  ArrowLeft,
  Check,
  Edit2,
  Download,
  Boxes,
} from 'lucide-react';
import { MathNodeFolder, NodeDefinition } from '../../types';
import { parseMNode } from '../../utils/nodeParser';

// Global reference for bulletproof synchronous drag-and-drop tracking
let globalDraggedNodeId: string | null = null;
let globalDraggedFolderId: string | null = null;

interface PackageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: MathNodeFolder[];
  nodes: NodeDefinition[];
  onUpdateFolders: (folders: MathNodeFolder[]) => void;
  onUpdateNodes: (nodes: NodeDefinition[]) => void;
  onNotice: (msg: string) => void;
}

export const PackageManagerModal: React.FC<PackageManagerModalProps> = ({
  isOpen,
  onClose,
  folders,
  nodes,
  onUpdateFolders,
  onUpdateNodes,
  onNotice,
}) => {
  // Navigation: currentFolderId is null when at root / "All Nodes"
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Expandable dropdown tree state in left sidebar
  const [expandedFolders, setExpandedFolders] = useState<
    Record<string, boolean>
  >({});

  // Drag-and-drop state for moving nodes and folders into other folders or trash
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isDragOverTrash, setIsDragOverTrash] = useState(false);
  const [isDragOverModal, setIsDragOverModal] = useState(false);

  // Inline folder creation in left sidebar ("naming position")
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // Inline folder renaming
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const editFolderInputRef = useRef<HTMLInputElement>(null);

  const fileInputZipRef = useRef<HTMLInputElement>(null);
  const fileInputMNodeRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Active folder object if navigating inside one
  const activeFolder = currentFolderId
    ? folders.find((f) => f.id === currentFolderId)
    : null;

  // Toggle folder expansion in left tree dropdown
  const toggleFolderExpanded = (folderId: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  // Compute breadcrumb path from root to current folder
  const getBreadcrumbs = (): MathNodeFolder[] => {
    if (!currentFolderId) return [];
    const crumbs: MathNodeFolder[] = [];
    let cur: MathNodeFolder | undefined = folders.find(
      (f) => f.id === currentFolderId,
    );
    while (cur) {
      crumbs.unshift(cur);
      cur = cur.parentId
        ? folders.find((f) => f.id === cur?.parentId)
        : undefined;
    }
    return crumbs;
  };
  const breadcrumbs = getBreadcrumbs();

  // Folders to show in current view on the right side
  const currentViewFolders = searchQuery
    ? folders.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : folders.filter((f) => (f.parentId || null) === currentFolderId);

  // Nodes to show in current view on the right side:
  // Strictly only show nodes that belong directly to currentFolderId!
  // When a node is moved into a folder, it immediately disappears from its previous place!
  const currentViewNodes = searchQuery
    ? nodes.filter(
        (n) =>
          n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (n.description &&
            n.description.toLowerCase().includes(searchQuery.toLowerCase())),
      )
    : nodes.filter((n) => (n.folderId || null) === currentFolderId);

  // Filtered by search query
  const filteredFolders = currentViewFolders;
  const filteredNodes = currentViewNodes;

  // Navigate into folder on double click
  const handleOpenFolder = (folderId: string) => {
    setCurrentFolderId(folderId);
    setExpandedFolders((prev) => ({ ...prev, [folderId]: true }));
  };

  // Navigate back one level
  const handleGoBack = () => {
    if (activeFolder && activeFolder.parentId) {
      setCurrentFolderId(activeFolder.parentId);
    } else {
      setCurrentFolderId(null);
    }
  };

  // Start inline folder creation
  const handleStartCreateFolder = () => {
    setIsCreatingFolder(true);
    setNewFolderName('');
    setTimeout(() => {
      newFolderInputRef.current?.focus();
    }, 50);
  };

  // Commit folder creation
  const handleCommitCreateFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setIsCreatingFolder(false);
      return;
    }

    const newFolder: MathNodeFolder = {
      id: `folder-${Date.now()}`,
      name: trimmed,
      parentId: currentFolderId,
      isPackage: false,
    };

    onUpdateFolders([...folders, newFolder]);
    setExpandedFolders((prev) => ({ ...prev, [newFolder.id]: true }));
    setIsCreatingFolder(false);
    setNewFolderName('');
    onNotice(`Created folder "${trimmed}"`);
  };

  // Start inline rename
  const handleStartRename = (folder: MathNodeFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
    setTimeout(() => {
      editFolderInputRef.current?.focus();
      editFolderInputRef.current?.select();
    }, 50);
  };

  // Commit rename
  const handleCommitRename = () => {
    if (!editingFolderId) return;
    const trimmed = editingFolderName.trim();
    if (trimmed) {
      onUpdateFolders(
        folders.map((f) =>
          f.id === editingFolderId ? { ...f, name: trimmed } : f,
        ),
      );
      onNotice(`Renamed folder to "${trimmed}"`);
    }
    setEditingFolderId(null);
  };

  // Delete folder
  const handleDeleteFolder = (folderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const folder = folders.find((f) => f.id === folderId);

    // Remove folder and move its nodes to unassigned root
    onUpdateFolders(
      folders.filter((f) => f.id !== folderId && f.parentId !== folderId),
    );
    onUpdateNodes(
      nodes.map((n) =>
        n.folderId === folderId ? { ...n, folderId: null } : n,
      ),
    );

    if (currentFolderId === folderId) {
      setCurrentFolderId(null);
    }
    onNotice(`Deleted folder "${folder?.name || ''}"`);
  };

  // Delete node
  const handleDeleteNode = (nodeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    onUpdateNodes(nodes.filter((n) => n.id !== nodeId));
    onNotice(`Removed node "${node?.name || ''}"`);
  };

  // Move node to folder logic (node disappears from previous folder and appears in target)
  const moveNodeToFolder = (nodeId: string, targetFolderId: string | null) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    if (node.folderId === targetFolderId) {
      return; // Already in target folder
    }

    const updated = nodes.map((n) =>
      n.id === nodeId ? { ...n, folderId: targetFolderId } : n,
    );
    onUpdateNodes(updated);

    if (targetFolderId) {
      setExpandedFolders((prev) => ({ ...prev, [targetFolderId]: true }));
    }

    const targetFolder = folders.find((f) => f.id === targetFolderId);
    const targetName = targetFolder ? targetFolder.name : 'All Nodes (Root)';
    onNotice(`Moved node "${node.name}" into "${targetName}"`);
  };

  // Helper to count ALL nodes inside a folder (including nested child folders, counting strictly nodes)
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

  // Helper to test if candidateFolderId is a descendant of folderId (or folderId itself)
  const isDescendantOf = (
    candidateFolderId: string,
    folderId: string,
  ): boolean => {
    if (candidateFolderId === folderId) return true;
    let cur = folders.find((f) => f.id === candidateFolderId);
    while (cur && cur.parentId) {
      if (cur.parentId === folderId) return true;
      const pid: string = cur.parentId;
      cur = folders.find((f) => f.id === pid);
    }
    return false;
  };

  // Move folder into another folder (or to root if targetFolderId === null)
  const moveFolderToFolder = (
    folderId: string,
    targetFolderId: string | null,
  ) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;

    if (folder.parentId === targetFolderId) return; // Already in target folder

    if (targetFolderId && isDescendantOf(targetFolderId, folderId)) {
      onNotice('Cannot move a folder into itself or its own subfolder');
      return;
    }

    const updated = folders.map((f) =>
      f.id === folderId ? { ...f, parentId: targetFolderId } : f,
    );
    onUpdateFolders(updated);

    if (targetFolderId) {
      setExpandedFolders((prev) => ({ ...prev, [targetFolderId]: true }));
    }

    const targetFolder = folders.find((f) => f.id === targetFolderId);
    const targetName = targetFolder ? targetFolder.name : 'All Nodes (Root)';
    onNotice(`Moved folder "${folder.name}" into "${targetName}"`);
  };

  // Drag folder start
  const handleFolderDragStart = (e: React.DragEvent, folderId: string) => {
    e.stopPropagation();
    globalDraggedFolderId = folderId;
    setDraggedFolderId(folderId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', folderId);
    e.dataTransfer.setData('application/x-mathnode-folder-id', folderId);
  };

  // Drag folder end
  const handleFolderDragEnd = () => {
    globalDraggedFolderId = null;
    setDraggedFolderId(null);
    setDragOverFolderId(null);
    setIsDragOverTrash(false);
  };

  // Drag node start
  const handleNodeDragStart = (e: React.DragEvent, nodeId: string) => {
    e.stopPropagation();
    globalDraggedNodeId = nodeId;
    setDraggedNodeId(nodeId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', nodeId);
    e.dataTransfer.setData('application/x-mathnode-id', nodeId);
  };

  // Drag node end
  const handleNodeDragEnd = () => {
    globalDraggedNodeId = null;
    setDraggedNodeId(null);
    setDragOverFolderId(null);
    setIsDragOverTrash(false);
  };

  // Drop on a folder (left sidebar or right folder card)
  const handleFolderDrop = (
    e: React.DragEvent,
    targetFolderId: string | null,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    const folderId =
      e.dataTransfer.getData('application/x-mathnode-folder-id') ||
      globalDraggedFolderId ||
      draggedFolderId;

    if (folderId) {
      moveFolderToFolder(folderId, targetFolderId);
      globalDraggedFolderId = null;
      setDraggedFolderId(null);
      return;
    }

    const nodeId =
      e.dataTransfer.getData('application/x-mathnode-id') ||
      e.dataTransfer.getData('text/plain') ||
      globalDraggedNodeId ||
      draggedNodeId;

    if (nodeId) {
      moveNodeToFolder(nodeId, targetFolderId);
    }

    globalDraggedNodeId = null;
    setDraggedNodeId(null);
  };

  // Drop on the bin / trash to delete node or folder
  const handleTrashDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTrash(false);

    const folderId =
      e.dataTransfer.getData('application/x-mathnode-folder-id') ||
      globalDraggedFolderId ||
      draggedFolderId;

    if (folderId) {
      handleDeleteFolder(folderId);
      globalDraggedFolderId = null;
      setDraggedFolderId(null);
      return;
    }

    const nodeId =
      e.dataTransfer.getData('application/x-mathnode-id') ||
      e.dataTransfer.getData('text/plain') ||
      globalDraggedNodeId ||
      draggedNodeId;

    if (nodeId) {
      handleDeleteNode(nodeId);
    }

    globalDraggedNodeId = null;
    setDraggedNodeId(null);
  };

  // Direct .mnode installation
  const handleMNodeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const parsedList: NodeDefinition[] = [];
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const parsed = parseMNode(text, currentFolderId, file.name);
        if (parsed) {
          parsedList.push(parsed);
        }
      } catch {
        // Skip
      }
    }

    if (parsedList.length === 0) {
      onNotice('No valid .mnode definitions found in selected file(s)');
      return;
    }

    onUpdateNodes(mergeDefinitions(nodes, parsedList));
    onNotice(`Installed ${parsedList.length} node(s) directly (.mnode)`);
    if (fileInputMNodeRef.current) fileInputMNodeRef.current.value = '';
  };

  // ZIP package installation: creates a folder kind of thing inside
  const handleZipUpload = async (file: File) => {
    try {
      const data = await readNodePackage(file, file.name, currentFolderId);
      onUpdateFolders([...folders, ...data.folders]);
      onUpdateNodes(mergeDefinitions(nodes, data.nodes));
      setExpandedFolders((prev) => ({ ...prev, [data.rootId]: true }));
      onNotice(
        `Installed ${data.nodes.length} nodes${data.skipped ? `; skipped ${data.skipped} invalid files` : ''}`,
      );
    } catch (error) {
      onNotice(
        error instanceof Error ? error.message : 'Invalid package archive',
      );
    }

    if (fileInputZipRef.current) fileInputZipRef.current.value = '';
  };

  // Modal file drag & drop from computer
  const handleModalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (
      !globalDraggedNodeId &&
      !draggedNodeId &&
      !globalDraggedFolderId &&
      !draggedFolderId
    ) {
      setIsDragOverModal(true);
    }
  };

  const handleModalDragLeave = () => {
    setIsDragOverModal(false);
  };

  const handleModalDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverModal(false);
    if (
      globalDraggedNodeId ||
      draggedNodeId ||
      globalDraggedFolderId ||
      draggedFolderId
    )
      return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const zipFiles = files.filter((f) => f.name.toLowerCase().endsWith('.zip'));
    const mnodeFiles = files.filter(
      (f) =>
        f.name.toLowerCase().endsWith('.mnode') ||
        f.name.toLowerCase().endsWith('.json'),
    );

    for (const z of zipFiles) {
      await handleZipUpload(z);
    }

    if (mnodeFiles.length > 0) {
      const parsedList: NodeDefinition[] = [];
      for (const f of mnodeFiles) {
        try {
          const text = await f.text();
          const parsed = parseMNode(text, currentFolderId, f.name);
          if (parsed) parsedList.push(parsed);
        } catch {
          // Skip
        }
      }
      if (parsedList.length > 0) {
        onUpdateNodes(mergeDefinitions(nodes, parsedList));
        onNotice(`Installed ${parsedList.length} node(s) directly (.mnode)`);
      }
    }
  };

  // Recursive tree renderer for expandable folder dropdowns in left panel
  const renderFolderTreeItem = (folder: MathNodeFolder, depth: number = 0) => {
    const isExpanded = expandedFolders[folder.id] ?? false;
    const folderNodes = nodes.filter((n) => n.folderId === folder.id);
    const subfolders = folders.filter((f) => f.parentId === folder.id);
    const isSelected = currentFolderId === folder.id;
    const isDragTarget = dragOverFolderId === folder.id;
    const isEditing = editingFolderId === folder.id;

    return (
      <div key={folder.id} className="space-y-0.5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            if (dragOverFolderId !== folder.id) {
              setDragOverFolderId(folder.id);
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDragOverFolderId(null);
            }
          }}
          draggable={!isEditing}
          onDragStart={(e) => handleFolderDragStart(e, folder.id)}
          onDragEnd={handleFolderDragEnd}
          onDrop={(e) => handleFolderDrop(e, folder.id)}
          style={{ paddingLeft: `${depth * 10 + 4}px` }}
          className={`rounded-[5px] transition-colors border group select-none ${
            !isEditing ? 'cursor-grab active:cursor-grabbing' : ''
          } ${
            isDragTarget
              ? 'bg-[#22304C] border-[#3B82F6] text-white shadow-[0_0_0_1px_#3B82F6]'
              : isSelected
                ? 'bg-[#25252E] border-[#383844] text-white'
                : 'border-transparent text-[#8E8E96] hover:text-[#EDEDED] hover:bg-[#202026]'
          }`}
        >
          {isEditing ? (
            /* Inline Rename Input */
            <div className="flex items-center gap-1 p-1">
              <Folder size={13} className="text-[#E0B05C] shrink-0 ml-1" />
              <input
                ref={editFolderInputRef}
                type="text"
                value={editingFolderName}
                onChange={(e) => setEditingFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitRename();
                  if (e.key === 'Escape') setEditingFolderId(null);
                }}
                className="flex-1 h-[22px] px-1 bg-[#141416] border border-[#3B82F6] rounded text-[11px] text-white focus:outline-none"
              />
              <button
                onClick={handleCommitRename}
                className="p-1 rounded text-[#34D399] hover:bg-[#202026]"
              >
                <Check size={11} />
              </button>
              <button
                onClick={() => setEditingFolderId(null)}
                className="p-1 rounded text-[#8E8E96] hover:bg-[#202026]"
              >
                <X size={11} />
              </button>
            </div>
          ) : (
            /* Normal Folder Row with Expandable Arrow */
            <div
              onClick={() => setCurrentFolderId(folder.id)}
              className="py-1.5 pr-2 flex items-center justify-between cursor-pointer text-[11.5px] font-medium"
            >
              <div className="flex items-center gap-1 truncate">
                {/* Expandable Dropdown Arrow */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolderExpanded(folder.id);
                  }}
                  className="p-0.5 rounded hover:text-white hover:bg-[#2D2D38] text-[#8E8E96] shrink-0 pointer-events-auto"
                  title={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? (
                    <ChevronDown size={11} className="shrink-0" />
                  ) : (
                    <ChevronRight size={11} className="shrink-0" />
                  )}
                </button>

                <div className="flex items-center gap-1.5 truncate pointer-events-none">
                  {isSelected || isExpanded ? (
                    <FolderOpen size={13} className="text-[#E0B05C] shrink-0" />
                  ) : (
                    <Folder size={13} className="text-[#8E8E96] shrink-0" />
                  )}
                  <span className="truncate">{folder.name}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-1">
                {/* Folder nodes count (counting only nodes, including in child folders) */}
                <span className="font-mono text-[10px] text-[#686872] pointer-events-none">
                  {getNodeCountForFolder(folder.id)}
                </span>

                {/* Action icons on hover */}
                <div className="hidden group-hover:flex items-center gap-0.5 ml-1 pointer-events-auto">
                  <button
                    onClick={(e) => handleStartRename(folder, e)}
                    className="p-0.5 text-[#8E8E96] hover:text-white rounded"
                    title="Rename folder"
                  >
                    <Edit2 size={10} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteFolder(folder.id, e)}
                    className="p-0.5 text-[#8E8E96] hover:text-[#E08BA8] rounded"
                    title="Delete folder"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Expandable Dropdown Children (Subfolders & Nodes inside this folder) */}
        {isExpanded && (
          <div className="space-y-0.5 pl-2.5 border-l border-[#2B2B34] ml-3.5 my-0.5">
            {/* Subfolders */}
            {subfolders.map((sub) => renderFolderTreeItem(sub, depth + 1))}

            {/* Nodes inside this folder */}
            {folderNodes.map((node) => (
              <div
                key={node.id}
                draggable
                onDragStart={(e) => handleNodeDragStart(e, node.id)}
                onDragEnd={handleNodeDragEnd}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentFolderId(folder.id);
                }}
                className="px-2 py-1 rounded-[4px] bg-[#141417]/80 hover:bg-[#1E1E26] border border-transparent hover:border-[#33333F] text-[11px] text-[#A0A0B0] hover:text-white flex items-center justify-between cursor-grab active:cursor-grabbing group/item"
                title={`Node: ${node.name} (Hold and drag to move to any folder or bin)`}
              >
                <div className="flex items-center gap-1.5 truncate pointer-events-none">
                  <FileCode size={11} className="text-[#60A5FA] shrink-0" />
                  <span className="truncate">{node.name}</span>
                </div>
                <span className="text-[8px] font-mono text-[#686872] shrink-0 ml-1 pointer-events-none">
                  {node.badge || 'NODE'}
                </span>
              </div>
            ))}

            {subfolders.length === 0 && folderNodes.length === 0 && (
              <div className="text-[10px] text-[#555562] italic px-2 py-0.5">
                (Empty folder)
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Top-level folders for left panel (folders without a parent)
  const rootFolders = folders.filter((f) => !f.parentId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#121214]/80 backdrop-blur-[2px]">
      <div className="absolute inset-0" onClick={onClose} />

      <div
        onDragOver={handleModalDragOver}
        onDragLeave={handleModalDragLeave}
        onDrop={handleModalDrop}
        className="relative mathnode-modal w-[900px] max-w-[95vw] h-[590px] max-h-[92vh] flex flex-col overflow-hidden z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag-and-drop Overlay for OS files */}
        {isDragOverModal && (
          <div className="absolute inset-0 z-50 bg-[#16213E]/90 border-2 border-dashed border-[#4B78D8] flex flex-col items-center justify-center pointer-events-none">
            <Upload size={38} className="text-[#60A5FA] mb-2 animate-bounce" />
            <h3 className="text-[14px] font-semibold text-white">
              Drop .mnode or .zip Archive
            </h3>
            <p className="text-[11.5px] text-[#A0A0B0] mt-0.5">
              Installs directly into current directory
            </p>
          </div>
        )}

        {/* 1. Modal Titlebar (Only Main Name: Package Manager) */}
        <div className="mathnode-modal-header shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-[24px] h-[24px] rounded-[6px] bg-[#2563EB] border border-[#60A5FA] flex items-center justify-center text-white font-bold text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              M
            </div>
            <span className="text-[13px] font-semibold text-[#EDEDED] font-sans">
              Package Manager
            </span>
          </div>

          <button
            onClick={onClose}
            className="btn-plastic-square w-[28px] h-[28px] text-[#8E8E96]"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* 2. Sub-header Controls Bar (No Redundant Counters) */}
        <div className="h-[46px] px-6 border-b border-[#2B2B32] bg-[#1E1E22] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Hidden File Inputs */}
            <input
              type="file"
              ref={fileInputMNodeRef}
              accept=".mnode,.json"
              multiple
              className="hidden"
              onChange={handleMNodeUpload}
            />
            <input
              type="file"
              ref={fileInputZipRef}
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleZipUpload(f);
              }}
            />

            {/* Direct .mnode installer button */}
            <button
              onClick={() => fileInputMNodeRef.current?.click()}
              className="btn-plastic-primary text-[11.5px] h-[28px] px-3 gap-1.5"
              title="Install single or multiple .mnode definition files"
            >
              <FileCode size={13} />
              <span>Install .mnode</span>
            </button>

            {/* ZIP installer button */}
            <button
              onClick={() => fileInputZipRef.current?.click()}
              className="btn-plastic-secondary text-[11.5px] h-[28px] px-3 gap-1.5"
              title="Install node package from a .zip archive (creates package folder inside)"
            >
              <Upload size={13} />
              <span>Install from .ZIP</span>
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nodes & folders..."
              className="w-[210px] h-[26px] pl-6 pr-2 rounded-[5px] bg-[#141416] border border-[#2B2B32] text-[11px] text-[#EDEDED] placeholder-[#686872] focus:outline-none focus:border-[#4B78D8] transition-colors"
            />
            <Search
              size={11}
              className="absolute left-2 top-[7.5px] text-[#686872]"
            />
          </div>
        </div>

        {/* 3. Modal Body: Left Expandable Folder Tree & Right File Explorer View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: Expandable Folder Tree */}
          <div className="w-[240px] bg-[#1A1A1E] border-r border-[#2A2A30] flex flex-col p-3 shrink-0 select-none">
            {/* Sidebar Header with Add Folder Button */}
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[9.5px] font-semibold text-[#686872] uppercase tracking-wider">
                FOLDERS & CATEGORIES
              </span>
              <button
                onClick={handleStartCreateFolder}
                className="btn-plastic-square w-[24px] h-[24px] text-[#8E8E96] hover:text-[#EDEDED]"
                title="Create New Folder"
              >
                <FolderPlus size={13} />
              </button>
            </div>

            {/* Folder List with Expandable Dropdowns */}
            <div className="flex-1 overflow-y-auto space-y-1">
              {/* All Nodes Item: Fixed at the top */}
              <div
                onClick={() => setCurrentFolderId(null)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverFolderId('root');
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverFolderId(null);
                  }
                }}
                onDrop={(e) => handleFolderDrop(e, null)}
                className={`w-full px-2 py-1.5 rounded-[5px] text-[11.5px] font-medium cursor-pointer flex items-center justify-between transition-colors border ${
                  dragOverFolderId === 'root'
                    ? 'bg-[#22304C] border-[#3B82F6] text-white shadow-[0_0_0_1px_#3B82F6]'
                    : currentFolderId === null
                      ? 'bg-[#2A2A33] border-[#3A3A46] text-white'
                      : 'border-transparent text-[#8E8E96] hover:text-[#EDEDED] hover:bg-[#222227]'
                }`}
                title="All Nodes Root (Drop node here to move it to root)"
              >
                <div className="flex items-center gap-2 pointer-events-none">
                  <Layers size={13} className="text-[#60A5FA]" />
                  <span>All Nodes</span>
                </div>
                <span className="font-mono text-[10px] text-[#686872] pointer-events-none">
                  {nodes.length}
                </span>
              </div>

              {/* Inline Folder Creation Row ("Naming Position") */}
              {isCreatingFolder && (
                <div className="flex items-center gap-1.5 p-1 rounded-[5px] bg-[#141416] border border-[#3B82F6] shadow-sm">
                  <Folder size={13} className="text-[#E0B05C] shrink-0 ml-1" />
                  <input
                    ref={newFolderInputRef}
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCommitCreateFolder();
                      if (e.key === 'Escape') setIsCreatingFolder(false);
                    }}
                    placeholder="New Folder..."
                    className="flex-1 h-[22px] px-1 bg-transparent text-[11px] text-white focus:outline-none"
                  />
                  <button
                    onClick={handleCommitCreateFolder}
                    className="p-1 rounded text-[#34D399] hover:bg-[#202026]"
                    title="Confirm (Enter)"
                  >
                    <Check size={11} />
                  </button>
                  <button
                    onClick={() => setIsCreatingFolder(false)}
                    className="p-1 rounded text-[#8E8E96] hover:bg-[#202026]"
                    title="Cancel (Esc)"
                  >
                    <X size={11} />
                  </button>
                </div>
              )}

              {/* Expandable Dropdown Folders */}
              {rootFolders.map((folder) => renderFolderTreeItem(folder, 0))}

              {folders.length === 0 && !isCreatingFolder && (
                <div className="py-6 text-center text-[#686872] text-[11px]">
                  No custom folders yet.
                </div>
              )}
            </div>

            {/* Bottom Actions: Drag-to-delete Trash Bin drop target */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                setIsDragOverTrash(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setIsDragOverTrash(false);
                }
              }}
              onDrop={handleTrashDrop}
              className={`p-2 rounded-[6px] border flex items-center justify-center gap-2 transition-all cursor-default select-none mt-2 ${
                isDragOverTrash
                  ? 'border-[#EF4444] bg-[#3B1515] text-white shadow-[0_0_0_1px_#EF4444]'
                  : 'border-[#26262D] bg-[#141417] text-[#686872]'
              }`}
              title="Drag any node or folder card here to delete it"
            >
              <Trash2
                size={12}
                className={
                  isDragOverTrash
                    ? 'text-[#EF4444] animate-bounce'
                    : 'text-[#8E8E96]'
                }
              />
              <span className="text-[10px] font-medium pointer-events-none">
                {isDragOverTrash
                  ? 'Release to Delete Item'
                  : 'Drop node or folder here to delete'}
              </span>
            </div>
          </div>

          {/* Right Pane: File Explorer (Breadcrumbs, Separated Folders & Nodes) */}
          <div className="flex-1 flex flex-col bg-[#1E1E22] overflow-hidden">
            {/* Explorer Breadcrumb Bar */}
            <div className="p-3 px-4 border-b border-[#2B2B32]/60 flex items-center justify-between bg-[#19191D]">
              <div className="flex items-center gap-2">
                {/* Back button to go up one level */}
                {currentFolderId !== null && (
                  <button
                    onClick={handleGoBack}
                    className="btn-plastic-square w-[26px] h-[26px] text-[#8E8E96] hover:text-white"
                    title="Go Back"
                  >
                    <ArrowLeft size={13} />
                  </button>
                )}

                {/* Clickable & Drop-friendly Breadcrumbs */}
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#8E8E96]">
                  <span
                    onClick={() => setCurrentFolderId(null)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverFolderId !== 'crumb-root')
                        setDragOverFolderId('crumb-root');
                    }}
                    onDragLeave={() => setDragOverFolderId(null)}
                    onDrop={(e) => handleFolderDrop(e, null)}
                    className={`cursor-pointer px-1.5 py-0.5 rounded transition-colors ${
                      dragOverFolderId === 'crumb-root'
                        ? 'bg-[#22304C] text-[#60A5FA] shadow-[0_0_0_1px_#3B82F6]'
                        : 'hover:text-white hover:bg-[#25252E]'
                    }`}
                    title="All Nodes (Drop node or folder here to move to root)"
                  >
                    All Nodes
                  </span>

                  {breadcrumbs.map((crumb, idx) => (
                    <React.Fragment key={crumb.id}>
                      <span className="text-[#555562]">/</span>
                      <span
                        onClick={() => setCurrentFolderId(crumb.id)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverFolderId !== `crumb-${crumb.id}`)
                            setDragOverFolderId(`crumb-${crumb.id}`);
                        }}
                        onDragLeave={() => setDragOverFolderId(null)}
                        onDrop={(e) => handleFolderDrop(e, crumb.id)}
                        className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                          dragOverFolderId === `crumb-${crumb.id}`
                            ? 'bg-[#22304C] text-[#60A5FA] shadow-[0_0_0_1px_#3B82F6]'
                            : idx === breadcrumbs.length - 1
                              ? 'text-white font-semibold'
                              : 'hover:text-white hover:bg-[#25252E]'
                        }`}
                        title={`Folder: ${crumb.name} (Drop node or folder here to move inside)`}
                      >
                        {crumb.name}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            {/* Explorer Content: Clean Separation between Folders & Nodes */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredFolders.length > 0 || filteredNodes.length > 0 ? (
                <div className="space-y-4">
                  {/* Section 1: FOLDERS & PACKAGES */}
                  {filteredFolders.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-[#686872] tracking-wider uppercase mb-2 px-1">
                        FOLDERS & PACKAGES
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {filteredFolders.map((folder) => {
                          const totalNodeCount = getNodeCountForFolder(
                            folder.id,
                          );
                          const isDragTarget = dragOverFolderId === folder.id;

                          return (
                            <div
                              key={folder.id}
                              draggable={editingFolderId !== folder.id}
                              onDragStart={(e) =>
                                handleFolderDragStart(e, folder.id)
                              }
                              onDragEnd={handleFolderDragEnd}
                              onDoubleClick={() => handleOpenFolder(folder.id)}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = 'move';
                                if (dragOverFolderId !== folder.id) {
                                  setDragOverFolderId(folder.id);
                                }
                              }}
                              onDragLeave={(e) => {
                                e.preventDefault();
                                if (
                                  !e.currentTarget.contains(
                                    e.relatedTarget as Node,
                                  )
                                ) {
                                  setDragOverFolderId(null);
                                }
                              }}
                              onDrop={(e) => handleFolderDrop(e, folder.id)}
                              className={`p-3 rounded-[8px] bg-[#17171C] border select-none transition-all group ${
                                editingFolderId !== folder.id
                                  ? 'cursor-grab active:cursor-grabbing'
                                  : 'cursor-default'
                              } ${
                                isDragTarget
                                  ? 'border-[#3B82F6] bg-[#22304C] shadow-[0_0_0_1px_#3B82F6]'
                                  : 'border-[#2B2B34] hover:border-[#4B4B58] hover:bg-[#1D1D23]'
                              } shadow-[0_2px_6px_rgba(0,0,0,0.3)]`}
                              title="Double-click to open folder • Hold and drag to move inside another folder"
                            >
                              <div className="flex items-start justify-between">
                                <div className="pointer-events-none">
                                  <Folder
                                    size={22}
                                    className="text-[#E0B05C] shrink-0"
                                  />
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={(e) =>
                                      handleStartRename(folder, e)
                                    }
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-[#8E8E96] hover:text-white rounded transition-opacity pointer-events-auto"
                                    title="Rename folder"
                                  >
                                    <Edit2 size={11} />
                                  </button>
                                  <button
                                    onClick={(e) =>
                                      handleDeleteFolder(folder.id, e)
                                    }
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-[#8E8E96] hover:text-[#EF4444] rounded transition-opacity pointer-events-auto"
                                    title="Delete folder"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                  <span className="font-mono text-[11px] font-semibold text-[#8E8E96] bg-[#141418] border border-[#272730]/80 px-1.5 py-0.5 rounded-[4px] min-w-[20px] text-center pointer-events-none">
                                    {totalNodeCount}
                                  </span>
                                </div>
                              </div>

                              {editingFolderId === folder.id ? (
                                <div
                                  className="flex items-center gap-1 mt-2 pointer-events-auto"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    ref={editFolderInputRef}
                                    type="text"
                                    value={editingFolderName}
                                    onChange={(e) =>
                                      setEditingFolderName(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter')
                                        handleCommitRename();
                                      if (e.key === 'Escape')
                                        setEditingFolderId(null);
                                    }}
                                    className="flex-1 h-[24px] px-1.5 bg-[#141416] border border-[#3B82F6] rounded text-[11.5px] text-white focus:outline-none"
                                  />
                                  <button
                                    onClick={handleCommitRename}
                                    className="p-1 rounded text-[#34D399] hover:bg-[#25252E]"
                                    title="Save name"
                                  >
                                    <Check size={11} />
                                  </button>
                                  <button
                                    onClick={() => setEditingFolderId(null)}
                                    className="p-1 rounded text-[#8E8E96] hover:bg-[#25252E]"
                                    title="Cancel"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              ) : (
                                <div className="font-medium text-[12.5px] text-[#EDEDED] group-hover:text-white truncate mt-2.5 pointer-events-none">
                                  {folder.name}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Section 2: NODES (Clean separation from folders) */}
                  {filteredNodes.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-[#686872] tracking-wider uppercase mb-2 px-1">
                        NODES
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {filteredNodes.map((node) => (
                          <div
                            key={node.id}
                            draggable
                            onDragStart={(e) => handleNodeDragStart(e, node.id)}
                            onDragEnd={handleNodeDragEnd}
                            className="p-3 rounded-[8px] bg-[#17171C] border border-[#2B2B34] hover:border-[#3D3D4A] hover:bg-[#1D1D23] shadow-[0_2px_6px_rgba(0,0,0,0.3)] flex flex-col justify-between cursor-grab active:cursor-grabbing transition-all group select-none"
                            title="Hold and drag to move into any folder or bin"
                          >
                            <div>
                              {/* Header: Node Icon + Name, and Delete on hover */}
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2 truncate pr-2 pointer-events-none">
                                  {node.composite ? (
                                    <Boxes
                                      size={15}
                                      className="text-[#8E8E96] shrink-0"
                                    />
                                  ) : (
                                    <FileCode
                                      size={15}
                                      className="text-[#60A5FA] shrink-0"
                                    />
                                  )}
                                  <span className="font-medium text-[12.5px] text-[#EDEDED] group-hover:text-white truncate">
                                    {node.name}
                                  </span>
                                </div>

                                <button
                                  aria-label={`Download ${node.name}`}
                                  title="Download .mnode"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadMNode(node);
                                    onNotice(`Exported ${node.name}.mnode`);
                                  }}
                                  className="p-1 text-[#8E8E96] hover:text-white"
                                >
                                  <Download size={13} />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteNode(node.id, e)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-[#8E8E96] hover:text-[#EF4444] rounded transition-opacity"
                                  title="Remove node"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>

                              {/* Small description */}
                              <p className="text-[11px] text-[#8E8E96] leading-relaxed line-clamp-2 pointer-events-none">
                                {node.description || 'Mathematical operator'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Empty state */
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#686872]">
                  <Folder
                    size={36}
                    className="mb-2 opacity-30 stroke-[1.5] text-[#E0B05C]"
                  />
                  <p className="text-[13px] font-medium text-[#8E8E96]">
                    {searchQuery
                      ? `No items match "${searchQuery}"`
                      : 'This folder is empty'}
                  </p>
                  <p className="text-[11px] text-[#555560] mt-1 max-w-[320px]">
                    Install{' '}
                    <span className="font-mono text-[#A0A0B0]">.mnode</span>{' '}
                    files directly or extract{' '}
                    <span className="font-mono text-[#A0A0B0]">.zip</span>{' '}
                    archives into this folder.
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <button
                      onClick={() => fileInputMNodeRef.current?.click()}
                      className="btn-plastic-primary text-[11.5px] h-[28px] px-3 flex items-center gap-1.5"
                    >
                      <FileCode size={13} />
                      <span>Install .mnode</span>
                    </button>
                    <button
                      onClick={() => fileInputZipRef.current?.click()}
                      className="btn-plastic-secondary text-[11.5px] h-[28px] px-3 flex items-center gap-1.5"
                    >
                      <Upload size={13} />
                      <span>Install from .ZIP</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackageManagerModal;
