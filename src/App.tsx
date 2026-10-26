import { useAgentBridge } from './hooks/useAgentBridge';

import {
  MY_NODES_FOLDER,
  createCompositeDefinition,
  replaceSelectionWithComposite,
  cleanInstance,
} from './utils/compositeNodes';

import { CompositeInspector } from './components/modals/CompositeInspector';

import React, { useState, useEffect, useCallback, useRef } from 'react';

import { TopBar } from './components/layout/TopBar';

import { LeftRail } from './components/layout/LeftRail';

import { NodeLibraryDrawer } from './components/layout/NodeLibraryDrawer';

import { WorkspaceCanvas } from './components/layout/WorkspaceCanvas';

import { AppMenu } from './components/menu/AppMenu';

import { ProjectManagerModal } from './components/modals/ProjectManagerModal';

import { SettingsModal } from './components/modals/SettingsModal';

import { PackageManagerModal } from './components/modals/PackageManagerModal';

import {
  MathGraph,
  AppSettings,
  MathNodeFolder,
  NodeDefinition,
  MathNodeInstance,
  NodeConnection,
  GraphSnapshot,
} from './types';

import { parseMNode } from './utils/nodeParser';

import { mergeDefinitions, readNodePackage } from './utils/nodePackage';

import { FolderKanban, Plus } from 'lucide-react';

import {
  DEFAULT_FOLDERS,
  DEFAULT_NODE_DEFINITIONS,
  INITIAL_DEMO_NODES,
  INITIAL_DEMO_CONNECTIONS,
} from './utils/defaultNodes';

import { GraphExecutor } from './utils/graphExecutor';

import { parseGraph, exportGraph } from './utils/graphFile';

import { connectionError } from './utils/graphRules';

import { getNodeMinDimensions } from './utils/socketGeometry';

const INITIAL_DEFAULT_TABS: MathGraph[] = [
  {
    id: 'tab-ode',

    title: 'Arithmetic_Demo',

    lastEdited: 'Just now',

    isModified: false,

    pan: { x: 0, y: 0 },

    zoom: 1.0,

    nodes: INITIAL_DEMO_NODES,

    connections: INITIAL_DEMO_CONNECTIONS,

    frames: [],

    history: [],
  },

  {
    id: 'tab-matrix',

    title: 'Matrix_Workspace',

    lastEdited: 'Just now',

    isModified: false,

    pan: { x: 0, y: 0 },

    zoom: 1.0,

    nodes: [],

    connections: [],

    frames: [],

    history: [],
  },
];

const DEFAULT_SETTINGS: AppSettings = {
  showMinimap: true,

  snapToGrid: true,

  gridDotSpacing: 24,

  wireThickness: 'bold',

  showStartupModal: true,

  autoSave: true,

  precision: 6,
};

const DEFINITIONS_VERSION = 'v4';

const BUILTIN_REVISION = '2026-10-26-formula-library-mcp-1';

export const App: React.FC = () => {
  // Tabs & Project State (persisted in localStorage)

  const [tabs, setTabs] = useState<MathGraph[]>(() => {
    try {
      const saved = localStorage.getItem('mn_saved_tabs');

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed))
          return parsed.map((t) => ({
            ...parseGraph(
              JSON.stringify({
                ...t,

                nodes: t.nodes || [],

                connections: t.connections || [],
              }),
            ),

            isModified: t.isModified,
          }));
      }
    } catch {
      // Fallback
    }

    // Initialize with fresh working demo circuit

    const initialTabs = INITIAL_DEFAULT_TABS;

    return initialTabs;
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const savedId = localStorage.getItem('mn_active_tab_id');

    if (savedId && tabs.some((t) => t.id === savedId)) return savedId;

    return tabs[0]?.id || INITIAL_DEFAULT_TABS[0].id;
  });

  // Real saved workflows in Recent Files

  const [recentProjects, setRecentProjects] = useState<MathGraph[]>(() => {
    try {
      const saved = localStorage.getItem('mn_recent_workflows');

      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }

    return [];
  });

  // Side panel state: Node Library toggle

  const [isNodeLibraryOpen, setIsNodeLibraryOpen] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState<boolean>(
    () => {
      try {
        // 1. Check user preference from settings / localStorage

        const showPref = localStorage.getItem('mn_show_startup');

        if (showPref === 'false') return false;

        const savedSettings = localStorage.getItem('mn_user_settings');

        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);

          if (parsed.showStartupModal === false) return false;
        }

        // 2. Check saved tabs:

        // If a project is already going on (open tabs exist), DO NOT pop up on refresh

        const savedTabsRaw = localStorage.getItem('mn_saved_tabs');

        if (savedTabsRaw) {
          const parsedTabs = JSON.parse(savedTabsRaw);

          if (Array.isArray(parsedTabs) && parsedTabs.length > 0) {
            return false;
          }

          // If user closed/quit all tabs last time (0 tabs open), DO pop up

          return true;
        }

        // 3. Very first time opening Math Node (no saved tabs yet): DO pop up

        return true;
      } catch {
        return false;
      }
    },
  );

  const [isPackageManagerOpen, setIsPackageManagerOpen] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [inspecting, setInspecting] = useState<{
    node: MathNodeInstance;

    definition: NodeDefinition;
  } | null>(null);

  const inspectNode = (node: MathNodeInstance) => {
    const definition = installedNodes.find(
      (d) => d.id === (node.definitionId || node.type),
    );

    if (definition?.composite) setInspecting({ node, definition });
  };

  // Installed Folders & Nodes (Full File Manager System)

  const [installedFolders, setInstalledFolders] = useState<MathNodeFolder[]>(
    () => {
      try {
        const saved = localStorage.getItem('mn_folders');

        if (saved) {
          const parsed = JSON.parse(saved);

          if (Array.isArray(parsed))
            return [
              ...parsed,
              ...DEFAULT_FOLDERS.filter(
                (f) => !parsed.some((p) => p.id === f.id),
              ),
            ];
        }
      } catch {
        // Fallback
      }

      return DEFAULT_FOLDERS;
    },
  );

  const [installedNodes, setInstalledNodes] = useState<NodeDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('mn_nodes');

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          const validated = [
            ...new Map(
              parsed

                .map((d: NodeDefinition) =>
                  parseMNode(JSON.stringify(d), d.folderId || null),
                )

                .filter((d): d is NodeDefinition => !!d)
                .map((d) => [d.id, d]),
            ).values(),
          ] as NodeDefinition[];

          if (localStorage.getItem('mn_builtin_revision') === BUILTIN_REVISION)
            return validated.filter((d) => d.id !== 'math.variable');

          const missing = DEFAULT_NODE_DEFINITIONS.filter(
            (d) => !validated.some((saved) => saved.id === d.id),
          );

          return [
            ...missing,

            ...validated
              .filter((d) => d.id !== 'math.variable')
              .map((d) => {
                const builtin = DEFAULT_NODE_DEFINITIONS.find(
                  (b) => b.id === d.id,
                );

                return builtin ? { ...builtin, folderId: d.folderId } : d;
              }),
          ];
        }
      }
    } catch {
      /* Fall back to the bundled library */
    }

    return DEFAULT_NODE_DEFINITIONS;
  });

  useEffect(() => {
    setTabs((previous) => {
      let changed = false;

      const next = previous.map((tab) => {
        const connections = (tab.connections || []).filter((c) => {
          const node = tab.nodes?.find((n) => n.id === c.toNodeId);

          const input = installedNodes

            .find((d) => d.id === (node?.definitionId || node?.type))

            ?.inputs.find((s) => s.name === c.toSocket);

          return input?.connectable !== false;
        });

        if (connections.length === (tab.connections || []).length) return tab;

        changed = true;

        return {
          ...tab,

          connections,

          undoStack: [],

          redoStack: [],

          isModified: true,
        };
      });

      return changed ? next : previous;
    });
  }, [installedNodes]);

  // Settings state (persisted in localStorage)

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('mn_user_settings');

      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // Fallback
    }

    return DEFAULT_SETTINGS;
  });

  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);

    setTimeout(() => setToast(null), 2400);
  }, []);

  const [saveStatus, setSaveStatus] = useState('');

  const executorRef = useRef<GraphExecutor | null>(null);

  const getExecutor = () =>
    executorRef.current || (executorRef.current = new GraphExecutor());

  useEffect(
    () => () => {
      executorRef.current?.dispose();

      executorRef.current = null;
    },

    [],
  );

  const agentStatus = useAgentBridge(
    !!settings.mcpEnabled,
    settings.mcpPort || 4319,

    () => {
      const graph = tabs.find((t) => t.id === activeTabId);

      return graph
        ? {
            graph: JSON.parse(exportGraph(parseGraph(exportGraph(graph)))),
            definitions: installedNodes,
            folders: installedFolders,
          }
        : null;
    },
    (snapshot) => {
      const graph = parseGraph(JSON.stringify(snapshot.graph));

      const definitions = snapshot.definitions.map((d) =>
        parseMNode(JSON.stringify(d), d.folderId || null),
      );

      if (definitions.some((d) => !d))
        throw new Error('Agent supplied an invalid node definition');

      const valid = definitions.filter((d): d is NodeDefinition => !!d);

      if (
        graph.nodes?.some(
          (n) => !valid.some((d) => d.id === (n.definitionId || n.type)),
        )
      )
        throw new Error('Agent graph is missing a node definition');

      for (const c of graph.connections || []) {
        const error = connectionError(
          c,
          graph.nodes || [],
          graph.connections || [],
          valid,
        );
        if (error) throw new Error(error);
      }

      setInstalledNodes((previous) => [
        ...new Map([...previous, ...valid].map((d) => [d.id, d])).values(),
      ]);

      setInstalledFolders((previous) => [
        ...new Map(
          [...previous, ...snapshot.folders].map((f) => [f.id, f]),
        ).values(),
      ]);

      setTabs((previous) => {
        const existing = previous.find((t) => t.id === graph.id);

        const updated = {
          ...graph,
          isModified: true,
          undoStack: existing
            ? [
                ...(existing.undoStack || []),
                {
                  nodes: (existing.nodes || []).map(cleanInstance),
                  connections: existing.connections || [],
                  frames: existing.frames || [],
                },
              ].slice(-30)
            : [],
          redoStack: [],
        };

        return existing
          ? previous.map((t) => (t.id === graph.id ? updated : t))
          : [...previous, updated];
      });

      setActiveTabId(graph.id);
      showToast(`Agent updated "${graph.title}"`);
      return {
        graph: JSON.parse(exportGraph(graph)),
        definitions: [
          ...new Map(
            [...installedNodes, ...valid].map((d) => [d.id, d]),
          ).values(),
        ],
        folders: [
          ...new Map(
            [...installedFolders, ...snapshot.folders].map((f) => [f.id, f]),
          ).values(),
        ],
      };
    },
  );

  // Computed worker results must not postpone persistence of actual edits.

  const persistentTabs = JSON.stringify(
    tabs.map((t) => ({
      ...JSON.parse(exportGraph(t)),
      isModified: t.isModified,
    })),
  );

  useEffect(() => {
    if (!settings.autoSave) {
      setSaveStatus('Auto-save off');
      return;
    }

    const timer = setTimeout(() => {
      try {
        localStorage.setItem('mn_saved_tabs', persistentTabs);

        localStorage.setItem('mn_active_tab_id', activeTabId);

        setSaveStatus('Local changes saved');
      } catch {
        setSaveStatus('Save failed — export your graph');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [persistentTabs, activeTabId, settings.autoSave]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'mn_recent_workflows',

        JSON.stringify(recentProjects),
      );
    } catch {
      // Ignore
    }
  }, [recentProjects]);

  useEffect(() => {
    try {
      localStorage.setItem('mn_folders', JSON.stringify(installedFolders));
    } catch {
      // Ignore
    }
  }, [installedFolders]);

  useEffect(() => {
    try {
      localStorage.setItem('mn_nodes', JSON.stringify(installedNodes));

      localStorage.setItem('mn_nodes_version', DEFINITIONS_VERSION);

      localStorage.setItem('mn_builtin_revision', BUILTIN_REVISION);
    } catch {
      setSaveStatus('Library save failed: export your definitions');
    }
  }, [installedNodes]);

  useEffect(() => {
    try {
      localStorage.setItem('mn_user_settings', JSON.stringify(settings));
    } catch {
      // Ignore
    }
  }, [settings]);

  // Current active tab object

  const activeTab =
    tabs.find((t) => t.id === activeTabId) ||
    tabs[0] ||
    INITIAL_DEFAULT_TABS[0];

  // Update canvas pan & zoom for active tab

  const handleUpdateView = useCallback(
    (pan: { x: number; y: number }, zoom: number) => {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id === activeTabId) {
            return { ...t, pan, zoom };
          }

          return t;
        }),
      );
    },

    [activeTabId],
  );

  // Double-click rename tab handler

  const handleRenameTab = (id: string, newTitle: string) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          return { ...t, title: newTitle, isModified: true };
        }

        return t;
      }),
    );

    setRecentProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, title: newTitle } : p)),
    );

    showToast(`Renamed project to "${newTitle}"`);
  };

  // Add new blank tab

  const handleNewTab = (customTitle?: string) => {
    const newId = `graph-${Date.now()}`;

    const newTitle = customTitle || `Untitled_Graph_${tabs.length + 1}`;

    const newGraph: MathGraph = {
      id: newId,

      title: newTitle,

      lastEdited: 'Just now',

      isModified: false,

      pan: { x: 0, y: 0 },

      zoom: 1.0,

      nodes: [],

      connections: [],

      frames: [],

      history: [],
    };

    setTabs((prev) => [...prev, newGraph]);

    setActiveTabId(newId);

    setIsProjectManagerOpen(false);

    showToast(`Created new graph "${newTitle}"`);
  };

  // Close tab (when all tabs are closed, Project Manager opens)

  const handleCloseTab = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const closed = tabs.find((t) => t.id === id);

    if (closed?.isModified)
      setRecentProjects((prev) => [
        {
          ...closed,

          undoStack: [],

          redoStack: [],

          lastEdited: 'Recovered from closed tab',
        },

        ...prev.filter((p) => p.id !== id),
      ]);

    const idx = tabs.findIndex((t) => t.id === id);

    const newTabs = tabs.filter((t) => t.id !== id);

    setTabs(newTabs);

    if (newTabs.length === 0) {
      setActiveTabId('');

      setIsProjectManagerOpen(true);

      showToast('All project tabs closed');
    } else if (activeTabId === id) {
      const nextIdx = Math.max(0, idx - 1);

      setActiveTabId(newTabs[nextIdx].id);
    }
  };

  // Close other tabs

  const handleCloseOtherTabs = (id: string) => {
    const closed = tabs

      .filter((t) => t.id !== id && t.isModified)

      .map((t) => ({
        ...t,

        undoStack: [],

        redoStack: [],

        lastEdited: 'Recovered from closed tab',
      }));

    if (closed.length)
      setRecentProjects((prev) => [
        ...closed,

        ...prev.filter((p) => !closed.some((t) => t.id === p.id)),
      ]);

    const remaining = tabs.filter((t) => t.id === id);

    setTabs(remaining);

    setActiveTabId(id);

    showToast('Closed other tabs');
  };

  // Duplicate tab

  const handleDuplicateTab = (id: string) => {
    const original = tabs.find((t) => t.id === id);

    if (!original) return;

    const dupId = `graph-${Date.now()}`;

    const duplicated: MathGraph = {
      ...original,

      id: dupId,

      title: `${original.title}_Copy`,

      isModified: true,

      nodes: original.nodes ? JSON.parse(JSON.stringify(original.nodes)) : [],

      connections: original.connections
        ? JSON.parse(JSON.stringify(original.connections))
        : [],

      frames: structuredClone(original.frames || []),

      history: [],

      undoStack: [],

      redoStack: [],
    };

    setTabs((prev) => [...prev, duplicated]);

    setActiveTabId(dupId);

    showToast(`Duplicated to "${duplicated.title}"`);
  };

  // Open graph from Project Manager

  const handleOpenGraph = (graph: MathGraph) => {
    const cleanGraph = {
      ...graph,

      undoStack: [],

      redoStack: [],

      nodes: graph.nodes || [],

      connections: (graph.connections || []).filter((c) => {
        const source = graph.nodes?.find((n) => n.id === c.fromNodeId);

        const target = graph.nodes?.find((n) => n.id === c.toNodeId);

        const output = installedNodes

          .find((d) => d.id === (source?.definitionId || source?.type))

          ?.outputs.find((s) => s.name === c.fromSocket);

        const input = installedNodes

          .find((d) => d.id === (target?.definitionId || target?.type))

          ?.inputs.find((s) => s.name === c.toSocket);

        return output?.connectable !== false && input?.connectable !== false;
      }),

      frames: graph.frames || [],
    };

    const existing = tabs.find((t) => t.id === graph.id);

    if (existing) {
      setActiveTabId(existing.id);
    } else {
      setTabs((prev) => [...prev, cleanGraph]);

      setActiveTabId(cleanGraph.id);
    }

    setIsProjectManagerOpen(false);

    showToast(`Loaded "${cleanGraph.title}"`);
  };

  // Atomic Graph Mutator with History Tracking

  const handleMutateGraph = useCallback(
    (
      updater: (current: GraphSnapshot) => GraphSnapshot,

      pushHistory: boolean = true,
    ) => {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== activeTabId) return t;

          const currentGraph = {
            nodes: t.nodes || [],

            connections: t.connections || [],

            frames: t.frames || [],
          };

          const result = updater(currentGraph);

          if (
            result.nodes === currentGraph.nodes &&
            result.connections === currentGraph.connections &&
            (result.frames === undefined ||
              result.frames === currentGraph.frames)
          )
            return t;

          const updatedNodes = result.nodes;

          const surviving = new Set(updatedNodes.map((n) => n.id));

          const updatedFrames = (result.frames ?? t.frames ?? [])

            .map((f) =>
              f.nodeIds?.some((id) => !surviving.has(id))
                ? { ...f, nodeIds: f.nodeIds.filter((id) => surviving.has(id)) }
                : f,
            )

            .filter((f) => !f.nodeIds || f.nodeIds.length);

          let newUndoStack = t.undoStack || [];

          if (pushHistory) {
            newUndoStack = [...newUndoStack, currentGraph].slice(-30);
          }

          return {
            ...t,

            nodes: updatedNodes,

            connections: result.connections,

            frames: updatedFrames,

            undoStack: newUndoStack,

            redoStack: pushHistory ? [] : t.redoStack,

            isModified: true,
          };
        }),
      );
    },

    [activeTabId, installedNodes],
  );

  const handleCommitHistory = useCallback(
    (snapshot: GraphSnapshot) => {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== activeTabId) return t;

          const clean = (nodes: MathNodeInstance[]) => nodes.map(cleanInstance);

          if (
            JSON.stringify([
              clean(t.nodes || []),

              t.connections,

              t.frames || [],
            ]) ===
            JSON.stringify([
              clean(snapshot.nodes),

              snapshot.connections,

              snapshot.frames || [],
            ])
          )
            return t;

          return {
            ...t,

            undoStack: [...(t.undoStack || []), snapshot].slice(-30),

            redoStack: [],

            isModified: true,
          };
        }),
      );
    },

    [activeTabId],
  );

  const handleSpawnNode = useCallback(
    (
      defId: string,

      worldX?: number,

      worldY?: number,

      attachment?: {
        nodeId: string;

        socketName: string;

        isOutput: boolean;

        wireId?: string;
      },
    ) => {
      const def = installedNodes.find((d) => d.id === defId);

      if (!def) {
        showToast('Node definition is not installed');

        return undefined;
      }

      if (!tabs.some((t) => t.id === activeTabId)) {
        showToast('Create a graph first');

        return undefined;
      }

      const id = crypto.randomUUID();

      handleMutateGraph((current) => {
        const spacing = settings.gridDotSpacing;

        const snap = (v: number) =>
          settings.snapToGrid ? Math.round(v / spacing) * spacing : v;

        const values = Object.fromEntries(
          def.inputs.map((i) => [
            i.name,

            structuredClone(
              i.default ??
                (i.type === 'bool'
                  ? false
                  : i.type === 'string' || i.type === 'calculus'
                    ? ''
                    : i.type === 'vector'
                      ? [0, 0]
                      : i.type === 'matrix'
                        ? Array.from(
                            { length: i.widget === 'matrix4x4' ? 4 : 2 },

                            () =>
                              Array(i.widget === 'matrix4x4' ? 4 : 2).fill(0),
                          )
                        : 0),
            ),
          ]),
        );

        if (def.id === 'math.value') values.value = 10;

        const node: MathNodeInstance = {
          id,

          type: def.id,

          definitionId: def.id,

          title: def.name,

          x: snap(worldX ?? -activeTab.pan.x / activeTab.zoom - 130),

          y: snap(worldY ?? -activeTab.pan.y / activeTab.zoom - 60),

          values,
        };

        const dims = getNodeMinDimensions(node, def);

        node.width = dims.minWidth;

        node.height = dims.minHeight;

        const next = {
          nodes: [...current.nodes, node],

          connections: current.connections,
        };

        if (attachment) {
          const sockets = (
            attachment.isOutput ? def.inputs : def.outputs
          ).filter((s) => s.connectable !== false);

          for (const socket of sockets) {
            const connection = {
              id: crypto.randomUUID(),

              fromNodeId: attachment.isOutput ? attachment.nodeId : id,

              fromSocket: attachment.isOutput
                ? attachment.socketName
                : socket.name,

              toNodeId: attachment.isOutput ? id : attachment.nodeId,

              toSocket: attachment.isOutput
                ? socket.name
                : attachment.socketName,
            };

            if (
              !connectionError(
                connection,

                next.nodes,

                next.connections,

                installedNodes,
              )
            ) {
              const oldWire = attachment.wireId
                ? current.connections.find((c) => c.id === attachment.wireId)
                : undefined;

              if (oldWire) {
                const output = def.outputs.find(
                  (s) =>
                    !connectionError(
                      {
                        fromNodeId: id,

                        fromSocket: s.name,

                        toNodeId: oldWire.toNodeId,

                        toSocket: oldWire.toSocket,
                      },

                      next.nodes,

                      next.connections.filter((c) => c.id !== oldWire.id),

                      installedNodes,
                    ),
                );

                if (!output) continue;

                next.connections = [
                  ...next.connections.filter((c) => c.id !== oldWire.id),

                  connection,

                  {
                    id: crypto.randomUUID(),

                    fromNodeId: id,

                    fromSocket: output.name,

                    toNodeId: oldWire.toNodeId,

                    toSocket: oldWire.toSocket,
                  },
                ];
              } else
                next.connections = [
                  ...next.connections.filter(
                    (c) =>
                      !(
                        c.toNodeId === connection.toNodeId &&
                        c.toSocket === connection.toSocket
                      ),
                  ),

                  connection,
                ];

              break;
            }
          }
        }

        return next;
      });

      showToast(`Added "${def.name}"`);

      return id;
    },

    [
      installedNodes,

      tabs,

      activeTabId,

      activeTab.pan,

      activeTab.zoom,

      settings,

      handleMutateGraph,

      showToast,
    ],
  );

  const handleCreateComposite = (definition: NodeDefinition, ids: string[]) => {
    const graph = {
      nodes: activeTab.nodes || [],

      connections: activeTab.connections || [],

      frames: activeTab.frames || [],
    };

    const id = crypto.randomUUID();

    try {
      createCompositeDefinition(graph, ids, installedNodes, definition.name);

      replaceSelectionWithComposite(graph, ids, definition, id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Cannot create node');

      return undefined;
    }

    setInstalledFolders((previous) =>
      previous.some((f) => f.id === MY_NODES_FOLDER.id)
        ? previous
        : [...previous, MY_NODES_FOLDER],
    );

    setInstalledNodes((previous) => mergeDefinitions(previous, [definition]));

    handleMutateGraph((current) =>
      replaceSelectionWithComposite(current, ids, definition, id),
    );

    showToast(`Created "${definition.name}" in My Nodes`);

    return id;
  };

  // Undo Handler

  const handleUndo = useCallback(() => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabId) return t;

        const undoStack = t.undoStack || [];

        if (undoStack.length === 0) {
          showToast('Nothing to undo');

          return t;
        }

        const prevSnapshot = undoStack[undoStack.length - 1];

        const nextUndo = undoStack.slice(0, -1);

        const currentSnapshot = {
          nodes: t.nodes || [],

          connections: t.connections || [],

          frames: t.frames || [],
        };

        const updatedNodes = prevSnapshot.nodes;

        showToast('Undo performed');

        return {
          ...t,

          nodes: updatedNodes,

          connections: prevSnapshot.connections,

          frames: prevSnapshot.frames ?? t.frames,

          undoStack: nextUndo,

          redoStack: [...(t.redoStack || []), currentSnapshot].slice(-30),

          isModified: true,
        };
      }),
    );
  }, [activeTabId, installedNodes, showToast]);

  // Redo Handler

  const handleRedo = useCallback(() => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabId) return t;

        const redoStack = t.redoStack || [];

        if (redoStack.length === 0) {
          showToast('Nothing to redo');

          return t;
        }

        const nextSnapshot = redoStack[redoStack.length - 1];

        const nextRedo = redoStack.slice(0, -1);

        const currentSnapshot = {
          nodes: t.nodes || [],

          connections: t.connections || [],

          frames: t.frames || [],
        };

        const updatedNodes = nextSnapshot.nodes;

        showToast('Redo performed');

        return {
          ...t,

          nodes: updatedNodes,

          connections: nextSnapshot.connections,

          frames: nextSnapshot.frames ?? t.frames,

          undoStack: [...(t.undoStack || []), currentSnapshot].slice(-30),

          redoStack: nextRedo,

          isModified: true,
        };
      }),
    );
  }, [activeTabId, installedNodes, showToast]);

  // Update nodes and re-evaluate DAG (optimized fast path for node dragging/sliding)

  const handleUpdateNodes = useCallback(
    (newNodes: MathNodeInstance[], pushHistory: boolean = false) => {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== activeTabId) return t;

          const oldNodes = t.nodes || [];

          // Fast path check: if only coordinates or dimensions changed (not values, types, count), preserve computedOutputs

          const isPositionOrSizeOnly =
            oldNodes.length === newNodes.length &&
            oldNodes.every((old, i) => {
              const n = newNodes[i];

              return (
                old.id === n.id &&
                old.values === n.values &&
                old.type === n.type &&
                old.definitionId === n.definitionId
              );
            });

          const currentGraph = {
            nodes: oldNodes,

            connections: t.connections || [],

            frames: t.frames || [],
          };

          let newUndoStack = t.undoStack || [];

          if (pushHistory) {
            newUndoStack = [...newUndoStack, currentGraph].slice(-30);
          }

          if (isPositionOrSizeOnly) {
            // Fast path: reuse existing computed outputs without running DAG topological sort

            const nodesWithOutputs = newNodes.map((n, i) => ({
              ...n,

              computedOutputs: oldNodes[i].computedOutputs,

              error: oldNodes[i].error,

              errorKind: oldNodes[i].errorKind,

              errorSourceNodeId: oldNodes[i].errorSourceNodeId,

              errorConnectionIds: oldNodes[i].errorConnectionIds,

              computedGraph: oldNodes[i].computedGraph,
            }));

            return {
              ...t,

              nodes: nodesWithOutputs,

              undoStack: newUndoStack,

              redoStack: pushHistory ? [] : t.redoStack,

              isModified: true,
            };
          }

          // Full evaluation path for value/structure changes

          const updatedNodes = newNodes;

          return {
            ...t,

            nodes: updatedNodes,

            undoStack: newUndoStack,

            redoStack: pushHistory ? [] : t.redoStack,

            isModified: true,
          };
        }),
      );
    },

    [activeTabId, installedNodes],
  );

  // Update connections and re-evaluate DAG

  const handleUpdateConnections = useCallback(
    (newConnections: NodeConnection[], pushHistory: boolean = true) => {
      handleMutateGraph(
        (current) => ({ ...current, connections: newConnections }),

        pushHistory,
      );
    },

    [handleMutateGraph],
  );

  // Only changes to computation inputs schedule work. Layout and selection never run kernels.

  const evaluationKey = JSON.stringify([
    activeTabId,

    (activeTab.nodes || []).map((n) => [
      n.id,

      n.type,

      n.definitionId,

      n.values,
    ]),

    activeTab.connections || [],

    installedNodes,
  ]);

  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTabId)) return;

    let live = true;

    const id = activeTabId;

    getExecutor()
      .run(activeTab.nodes || [], activeTab.connections || [], installedNodes)

      .then((result) => {
        if (!live) return;

        const computed = new Map(result.updatedNodes.map((n) => [n.id, n]));

        setTabs((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,

                  nodes: t.nodes?.map((n) => ({
                    ...n,

                    computedOutputs: computed.get(n.id)?.computedOutputs,

                    error: computed.get(n.id)?.error,

                    errorKind: computed.get(n.id)?.errorKind,

                    errorSourceNodeId: computed.get(n.id)?.errorSourceNodeId,

                    errorConnectionIds: computed.get(n.id)?.errorConnectionIds,

                    computedGraph: computed.get(n.id)?.computedGraph,
                  })),
                }
              : t,
          ),
        );
      })

      .catch((error) => {
        if (!live || error.message === 'Cancelled') return;

        setTabs((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,

                  nodes: t.nodes?.map((n) => ({
                    ...n,

                    computedOutputs: {},

                    error: error.message,

                    errorKind: 'calculation',

                    errorSourceNodeId: n.id,

                    errorConnectionIds: [],

                    computedGraph: undefined,
                  })),
                }
              : t,
          ),
        );
      });

    return () => {
      live = false;
    };
  }, [evaluationKey]);

  // Save active graph: registers in Recent files

  const handleSaveGraph = useCallback(() => {
    if (tabs.length === 0 || !activeTab) return;

    const now = new Date();

    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const dateLabel = `Saved today at ${timeStr}`;

    const updatedTab = {
      ...activeTab,

      isModified: false,

      lastEdited: dateLabel,
    };

    setTabs((prev) => prev.map((t) => (t.id === activeTabId ? updatedTab : t)));

    // Save into Recent Workflows

    setRecentProjects((prev) => {
      const filtered = prev.filter(
        (p) => p.id !== activeTabId && p.title !== activeTab.title,
      );

      return [updatedTab, ...filtered];
    });

    try {
      localStorage.setItem(
        'mn_saved_tabs',

        JSON.stringify(
          tabs.map((t) => ({
            ...JSON.parse(exportGraph(t.id === activeTabId ? updatedTab : t)),

            isModified: t.id === activeTabId ? false : t.isModified,
          })),
        ),
      );

      localStorage.setItem('mn_active_tab_id', activeTabId);

      localStorage.setItem(
        'mn_recent_workflows',

        JSON.stringify([
          updatedTab,

          ...recentProjects.filter((p) => p.id !== activeTabId),
        ]),
      );

      setSaveStatus('Saved locally');

      showToast(`Saved workflow "${activeTab.title}"`);
    } catch {
      setSaveStatus('Save failed — export your graph');

      showToast('Local storage is full or unavailable. Export your graph.');
    }
  }, [activeTabId, activeTab, showToast, tabs, recentProjects]);

  // Export graph to .mathnode JSON file

  const handleExportTab = (id: string) => {
    const target = tabs.find((t) => t.id === id) || activeTab;

    const fileName = `${target.title}.mathnode`;

    const blob = new Blob([exportGraph(target)], { type: 'application/json' });

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;

    link.download = fileName;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    showToast(`Exported "${fileName}"`);
  };

  // Import graph from disk

  const handleImportGraph = (imported: MathGraph) => {
    if (tabs.some((t) => t.id === imported.id))
      imported = { ...imported, id: crypto.randomUUID() };

    handleOpenGraph(imported);

    setRecentProjects((prev) => {
      const filtered = prev.filter((p) => p.id !== imported.id);

      return [imported, ...filtered];
    });
  };

  // Delete recent project

  const handleDeleteRecent = (id: string) => {
    setRecentProjects((prev) => prev.filter((p) => p.id !== id));

    showToast('Removed workflow from recent files');
  };

  // Duplicate recent project

  const handleDuplicateRecent = (proj: MathGraph) => {
    const duplicated: MathGraph = {
      ...proj,

      id: `proj-${Date.now()}`,

      title: `${proj.title} (Copy)`,

      lastEdited: 'Just now',

      isModified: true,
    };

    setRecentProjects((prev) => [duplicated, ...prev]);

    showToast(`Duplicated "${proj.title}"`);
  };

  // Handle dropped file

  // Handle dropped file (.mathnode workflow, .mnode operator, or .zip package)

  const handleFileDrop = async (file: File) => {
    const fileName = file.name.toLowerCase();

    // 1. Dropped ZIP Package

    if (fileName.endsWith('.zip')) {
      try {
        const packageData = await readNodePackage(file, file.name);

        setInstalledFolders((prev) => [...prev, ...packageData.folders]);

        setInstalledNodes((prev) => mergeDefinitions(prev, packageData.nodes));

        setIsNodeLibraryOpen(true);

        showToast(
          `Installed ${packageData.nodes.length} nodes${packageData.skipped ? `; skipped ${packageData.skipped} invalid files` : ''}`,
        );
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Invalid package archive',
        );
      }

      return;
    }

    // 2. Text-based files (.mnode or .mathnode)

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;

        const parsed = JSON.parse(text);

        // Check if this is a .mnode operator definition

        if (fileName.endsWith('.mnode') || (parsed.inputs && parsed.outputs)) {
          const node = parseMNode(text, null, file.name);

          if (node) {
            setInstalledNodes((prev) => mergeDefinitions(prev, [node]));

            setIsNodeLibraryOpen(true);

            showToast(
              `Installed custom node "${node.name}" (.mnode) into library`,
            );

            return;
          }

          throw new Error(
            'Invalid node definition: check socket types, widgets and kernel code',
          );
        }

        // 3. Otherwise treat as a .mathnode workspace graph

        const importedGraph = parseGraph(text, file.name);

        handleImportGraph(importedGraph);

        showToast(`Loaded workflow "${importedGraph.title}" (.mathnode)`);
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Invalid file format',
        );
      }
    };

    reader.readAsText(file);
  };

  // Keyboard Shortcuts Listener

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (inspecting) {
        if (e.key === 'Escape') setInspecting(null);

        return;
      }

      const target = e.target as HTMLElement;

      if (target.closest('input, textarea, select, [contenteditable="true"]'))
        return;

      if (isProjectManagerOpen || isPackageManagerOpen || isSettingsOpen) {
        if (e.key === 'Escape') {
          setIsProjectManagerOpen(false);

          setIsPackageManagerOpen(false);

          setIsSettingsOpen(false);
        }

        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();

          handleNewTab();
        } else if (e.key === 'o' || e.key === 'O') {
          e.preventDefault();

          setIsProjectManagerOpen(true);
        } else if (e.key === 's' || e.key === 'S') {
          e.preventDefault();

          handleSaveGraph();
        } else if (e.key === 'w' || e.key === 'W') {
          e.preventDefault();

          if (activeTabId) {
            handleCloseTab(activeTabId);
          }
        } else if (e.key === ',') {
          e.preventDefault();

          setIsSettingsOpen(true);
        }
      } else if (e.key === 'Escape') {
        setIsMenuOpen(false);

        setIsProjectManagerOpen(false);

        setIsPackageManagerOpen(false);

        setIsSettingsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleSaveGraph,

    activeTabId,

    tabs,

    isProjectManagerOpen,

    isPackageManagerOpen,

    isSettingsOpen,

    inspecting,
  ]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#161616] text-[#EDEDED] select-none font-sans">
      {/* 1. Top Header Bar */}

      <TopBar
        tabs={tabs}

        activeTabId={activeTabId}

        onSelectTab={setActiveTabId}

        onCloseTab={handleCloseTab}

        onCloseOtherTabs={handleCloseOtherTabs}

        onNewTab={() => handleNewTab()}

        onRenameTab={handleRenameTab}

        onDuplicateTab={handleDuplicateTab}

        onExportTab={handleExportTab}

        onToggleMenu={() => {
          setIsMenuOpen((prev) => !prev);

          setIsNodeLibraryOpen(false);
        }}

        onOpenProjectManager={() => setIsProjectManagerOpen(true)}

        isMenuOpen={isMenuOpen}
      />

      {/* Root "M" Dropdown Menu: Only New Graph, Open, Save */}

      <AppMenu
        isOpen={isMenuOpen}

        onClose={() => setIsMenuOpen(false)}

        onNewGraph={() => handleNewTab()}

        onOpenProjectManager={() => setIsProjectManagerOpen(true)}

        onSaveGraph={handleSaveGraph}
      />

      {/* 2. Workspace Body: Left Rail + Node Library Drawer + Infinite Canvas */}

      <div className="flex flex-1 h-[calc(100vh-48px)] overflow-hidden relative">
        {/* Left 44px Icon Utility Rail with Settings at bottom */}

        <LeftRail
          isNodeLibraryOpen={isNodeLibraryOpen}

          onToggleNodeLibrary={() => setIsNodeLibraryOpen((prev) => !prev)}

          onOpenPackageManager={() => setIsPackageManagerOpen(true)}

          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Sliding Node Library Drawer */}

        <NodeLibraryDrawer
          isOpen={isNodeLibraryOpen}

          onClose={() => setIsNodeLibraryOpen(false)}

          folders={installedFolders}

          nodes={installedNodes}

          onOpenPackageManager={() => setIsPackageManagerOpen(true)}

          onSpawnNode={handleSpawnNode}
        />

        {/* Infinite Mathematical Workspace Canvas */}

        {tabs.length > 0 ? (
          <WorkspaceCanvas
            key={activeTab.id}

            disabled={
              isProjectManagerOpen ||
              isPackageManagerOpen ||
              isSettingsOpen ||
              isMenuOpen ||
              !!inspecting
            }

            saveStatus={saveStatus}

            onCommitHistory={handleCommitHistory}

            graphTitle={activeTab.title}

            pan={activeTab.pan || { x: 0, y: 0 }}

            zoom={activeTab.zoom || 1.0}

            nodes={activeTab.nodes || []}

            connections={activeTab.connections || []}

            frames={activeTab.frames}

            definitions={installedNodes}

            settings={settings}

            onUpdateView={handleUpdateView}

            onUpdateNodes={handleUpdateNodes}

            onUpdateConnections={handleUpdateConnections}

            onMutateGraph={handleMutateGraph}

            onUndo={handleUndo}

            onRedo={handleRedo}

            onSpawnNode={handleSpawnNode}

            onCreateComposite={handleCreateComposite}

            onInspectNode={inspectNode}

            onOpenNodeLibrary={() => setIsNodeLibraryOpen(true)}

            onFileDrop={handleFileDrop}

            onCopyNotice={showToast}
          />
        ) : (
          <div className="flex-1 h-full bg-[#141416] flex flex-col items-center justify-center relative select-none">
            {/* Grid background */}

            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#4B4B5C_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center max-w-[400px] text-center p-8 bg-[#1B1B20] border border-[#2B2B34] rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.6)]">
              <div className="w-12 h-12 rounded-[10px] bg-[#141418] border border-[#2B2B38] flex items-center justify-center text-[#60A5FA] mb-4 shadow-inner">
                <FolderKanban size={24} />
              </div>

              <h2 className="text-[15px] font-semibold text-white mb-1.5">
                No Active Projects
              </h2>

              <p className="text-[12px] text-[#8E8E96] mb-6 leading-relaxed">
                All project tabs are currently closed. Open an existing graph
                from your library or create a new workspace to begin.
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsProjectManagerOpen(true)}

                  className="btn-plastic-primary h-[32px] px-4 text-[12px] flex items-center gap-2"
                >
                  <FolderKanban size={13} />

                  <span>Open Projects</span>
                </button>

                <button
                  onClick={() => handleNewTab()}

                  className="btn-plastic-secondary h-[32px] px-4 text-[12px] flex items-center gap-2"
                >
                  <Plus size={13} />

                  <span>New Graph</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Project & File Manager Modal */}

      <ProjectManagerModal
        isOpen={isProjectManagerOpen}

        onClose={() => setIsProjectManagerOpen(false)}

        recentProjects={recentProjects}

        onOpenGraph={handleOpenGraph}

        onNewGraph={handleNewTab}

        onDeleteRecent={handleDeleteRecent}

        onDuplicateRecent={handleDuplicateRecent}

        onImportGraph={handleImportGraph}

        onOpenDocumentation={() =>
          showToast(
            'Double-click or press Tab to add nodes. Drag sockets to connect. F fits selection. Ctrl+S saves locally.',
          )
        }

        onNotice={showToast}

        showOnStartup={settings.showStartupModal}

        onToggleStartup={(checked) => {
          setSettings((prev) => ({ ...prev, showStartupModal: checked }));
        }}
      />

      {/* 4. Settings Modal: Clean Real Application Settings */}

      <SettingsModal
        agentStatus={agentStatus}

        isOpen={isSettingsOpen}

        onClose={() => setIsSettingsOpen(false)}

        settings={settings}

        onSaveSettings={(newSettings) => {
          setSettings(newSettings);

          showToast('Settings saved successfully');
        }}

        onOpenPackageManager={() => {
          setIsSettingsOpen(false);

          setIsPackageManagerOpen(true);
        }}
      />

      {/* 5. Package Manager Modal: Install and Organize Math Nodes */}

      <PackageManagerModal
        isOpen={isPackageManagerOpen}

        onClose={() => setIsPackageManagerOpen(false)}

        folders={installedFolders}

        nodes={installedNodes}

        onUpdateFolders={setInstalledFolders}

        onUpdateNodes={setInstalledNodes}

        onNotice={showToast}
      />

      {inspecting && (
        <CompositeInspector
          definition={inspecting.definition}

          node={
            activeTab.nodes?.find((n) => n.id === inspecting.node.id) ||
            inspecting.node
          }

          settings={settings}

          onClose={() => setInspecting(null)}

          onNotice={showToast}
        />
      )}

      {/* Tactile Instrument Toast Notification */}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-[6px] bg-[#1E1E24] border border-[#3A3A46] text-[#EDEDED] text-[12px] font-medium shadow-[0_4px_16px_rgba(0,0,0,0.6)] flex items-center gap-2 pointer-events-none transition-all">
          <div className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />

          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};

export default App;
