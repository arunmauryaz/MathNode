export type DataType =
  | 'scalar'
  | 'vector'
  | 'matrix'
  | 'calculus'
  | 'bool'
  | 'int'
  | 'string'
  | 'any'
  | 'equation';

export interface NodeSocketDef {
  name: string;
  type: DataType;
  default?: number | string | boolean | number[] | number[][];
  defaultBinding?: number;
  min?: number;
  max?: number;
  step?: number;
  widget?:
    | 'number'
    | 'slider'
    | 'matrix2x2'
    | 'matrix4x4'
    | 'dropdown'
    | 'text'
    | 'toggle';
  options?: string[];
  description?: string;
  advanced?: boolean;
  connectable?: boolean;
  label?: string;
  enabledWhen?: string;
}

export interface MathNodeFolder {
  id: string;
  name: string;
  parentId: string | null;
  isPackage?: boolean;
}

export interface NodeDefinition {
  id: string;
  name: string;
  folderId?: string | null;
  category?: string;
  folder?: string;
  badge?: string;
  icon?: string;
  description?: string;
  inputs: NodeSocketDef[];
  outputs: NodeSocketDef[];
  code?: string;
  composite?: CompositeNodeDefinition;
}

export interface NodePackage {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  enabled: boolean;
  folder: string;
  nodes: NodeDefinition[];
}

export interface NodeConnection {
  id: string;
  fromNodeId: string;
  fromSocket: string;
  toNodeId: string;
  toSocket: string;
  color?: string;
}

export interface MathFrame {
  id: string;
  title: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  nodeIds?: string[];
}

export interface HistoryStep {
  id: string;
  action: string;
  timestamp: string;
}

export interface MathNodeInstance {
  id: string;
  definitionId?: string;
  type: string;
  title: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  collapsed?: boolean;
  showAdvanced?: boolean;
  values?: Record<string, unknown>;
  computedOutputs?: Record<string, unknown>;
  error?: string | null;
  errorKind?: 'calculation' | 'upstream' | 'connection' | 'cycle';
  errorSourceNodeId?: string;
  errorConnectionIds?: string[];
  computedGraph?: GraphSnapshot;
}

export type MathNode = MathNodeInstance;

export interface MathGraph {
  id: string;
  title: string;
  lastEdited: string;
  isModified?: boolean;
  category?: string;
  description?: string;
  pan: { x: number; y: number };
  zoom: number;
  nodes?: MathNodeInstance[];
  connections?: NodeConnection[];
  frames?: MathFrame[];
  history?: HistoryStep[];
  undoStack?: GraphSnapshot[];
  redoStack?: GraphSnapshot[];
}

export interface GraphSnapshot {
  nodes: MathNodeInstance[];
  connections: NodeConnection[];
  frames?: MathFrame[];
}

export interface CompositeBinding {
  name: string;
  nodeId: string;
  socket: string;
  mode: 'input' | 'output';
}

export interface CompositeNodeDefinition {
  version: 1;
  nodes: MathNodeInstance[];
  connections: NodeConnection[];
  frames?: MathFrame[];
  definitions: NodeDefinition[];
  inputs: CompositeBinding[];
  outputs: CompositeBinding[];
}

export interface ClipboardData {
  nodes: MathNodeInstance[];
  connections: NodeConnection[];
  center: { x: number; y: number };
}

export interface AppSettings {
  mcpEnabled?: boolean;
  mcpPort?: number;
  // Workspace
  showMinimap: boolean;
  snapToGrid: boolean;
  gridDotSpacing: number;
  wireThickness?: 'normal' | 'bold' | 'thick';

  precision?: number;

  // General
  showStartupModal: boolean;
  autoSave: boolean;
}
