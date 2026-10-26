# Canvas Micro-Features & Node Interaction Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a unified suite of professional node-graph micro-features (robust atomic deletion, Delete/Backspace keyboard support, multi-selection & marquee box select, clipboard Copy/Cut/Paste, Duplicate, Undo/Redo, quick-spawn double-click, and viewport shortcuts) for MathNode.

**Architecture:** Introduce an atomic graph mutation handler in `App.tsx` that evaluates and commits nodes and connections in a single immutable transition, eliminating asynchronous state-race clobbering. Layer a dedicated keyboard/clipboard manager, multi-node selection state (`selectedNodeIds: Set<string>`), marquee drag-box geometry, and a clean history stack (`undo`/`redo`) into `WorkspaceCanvas.tsx`.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS, Lucide Icons, Vite.

---

## Global Constraints

- **Single Atomic State Commit**: Never update nodes and connections in separate asynchronous turns (`onUpdateNodes` then `onUpdateConnections`); all deletions, duplicates, and pastes must pass through an atomic graph mutator to prevent closure state resurrection.
- **Input Immunity**: Never capture keyboard shortcuts (`Delete`, `Backspace`, `Ctrl+C`, `Ctrl+V`, `Ctrl+Z`, `Ctrl+A`, etc.) when `document.activeElement` is an `HTMLInputElement`, `HTMLTextAreaElement`, or `HTMLSelectElement`.
- **World Coordinate Transform**: All mouse-driven actions (paste at cursor, double-click spawn, marquee selection box) must accurately map screen client coordinates into canvas world space via `(clientX - containerLeft - panX) / zoom`.
- **Zero Sockets Disconnection Orphanage**: Whenever a node is deleted or cut, all inbound and outbound wire connections to that node must be purged atomically.

---

## File Structure & Responsibilities

- **Modify `src/types/index.ts`**:
  - Add `ClipboardData` interface (serialized nodes, internal connections, bounding center).
  - Add `GraphHistorySnapshot` interface (`nodes: MathNodeInstance[]`, `connections: NodeConnection[]`).
  - Update `MathGraph` with `history` and `historyIndex`.
- **Modify `src/App.tsx`**:
  - Implement `handleAtomicGraphMutation(updater: (current: { nodes: MathNodeInstance[], connections: NodeConnection[] }) => { nodes: MathNodeInstance[], connections: NodeConnection[] })`.
  - Wire up atomic graph deletion, copy, paste, duplicate, and undo/redo dispatchers.
  - Expose clean history undo/redo actions.
- **Modify `src/components/layout/WorkspaceCanvas.tsx`**:
  - Replace single `selectedNodeId: string | null` with multi-selection `selectedNodeIds: string[]`.
  - Implement marquee rubber-band drag selection (`marqueeBox: { startX, startY, curX, curY } | null`).
  - Implement keyboard shortcuts hub (`Del`, `Backspace`, `Ctrl+C`, `Ctrl+X`, `Ctrl+V`, `Ctrl+D`, `Ctrl+A`, `Ctrl+Z`, `Ctrl+Y`, `Escape`, `F`).
  - Implement multi-node synchronized dragging (moving all selected nodes together).
  - Implement double-click on empty canvas to open quick-add node search popup.
- **Modify `src/components/nodes/MathNodeCard.tsx`**:
  - Accept `isSelected: boolean` based on `selectedNodeIds.includes(node.id)`.
  - Support Shift+Click to toggle node in selection set without deselecting others.
  - Add inline title double-click editing.
  - Ensure floating pill actions (Delete, Duplicate) trigger atomic canvas handlers.

---

## Task 1: Atomic Graph Mutator & Bug Fix for Node Deletion (`Del` / `Backspace` / Trash Icon)

**Files:**
- Modify: `src/App.tsx:415-445`
- Modify: `src/components/layout/WorkspaceCanvas.tsx:195-220, 330-355, 575-605`

**Interfaces:**
- Consumes: `nodes: MathNodeInstance[]`, `connections: NodeConnection[]`
- Produces: `onMutateGraph: (updater: (prev: { nodes: MathNodeInstance[]; connections: NodeConnection[] }) => { nodes: MathNodeInstance[]; connections: NodeConnection[] }) => void`

- [x] **Step 1: Implement `handleMutateGraph` in `src/App.tsx`**
  Create a single callback that accepts an updater function receiving `{ nodes, connections }` and returning the new `{ nodes, connections }`. Inside `setTabs`, it computes the next state, executes `executeMathGraph`, and updates both `nodes` and `connections` simultaneously in one atomic step.

- [x] **Step 2: Replace split updates in `WorkspaceCanvas.tsx`**
  Replace `handleDeleteNode` in `WorkspaceCanvas.tsx`:
  ```ts
  const handleDeleteNode = (nodeId: string) => {
    onMutateGraph?.(prev => ({
      nodes: prev.nodes.filter(n => n.id !== nodeId),
      connections: prev.connections.filter(c => c.fromNodeId !== nodeId && c.toNodeId !== nodeId)
    }));
    setSelectedNodeIds(prev => prev.filter(id => id !== nodeId));
    onCopyNotice('Deleted node');
  };
  ```

- [x] **Step 3: Unify Keyboard Event Listeners for `Delete` and `Backspace`**
  Consolidate the two separate `keydown` listeners in `WorkspaceCanvas.tsx` into a single, clean listener. Check:
  ```ts
  const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
  if (isInput) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeIds.length > 0) {
    e.preventDefault();
    handleDeleteSelectedNodes();
  }
  ```

- [x] **Step 4: Verify Delete Functionality**
  Run build check with `npm run build`. Test clicking the trash icon on the node header pill, clicking a node and pressing `Delete`, and pressing `Backspace`. Confirm that the node and all connected wires disappear immediately and stay deleted.

---

## Task 2: Multi-Selection & Marquee Box Selection

**Files:**
- Modify: `src/components/layout/WorkspaceCanvas.tsx:90-130, 260-310, 680-740`
- Modify: `src/components/nodes/MathNodeCard.tsx:40-60`

**Interfaces:**
- Consumes: Node world coordinates `(node.x, node.y, width, height)`
- Produces: `selectedNodeIds: string[]`, `marqueeBox: { x1: number, y1: number, x2: number, y2: number } | null`

- [x] **Step 1: Upgrade selection state from single ID to array/Set**
  Change `selectedNodeId: string | null` to `selectedNodeIds: string[]`. Update `onSelect`:
  - Normal click: selects only clicked node (`setSelectedNodeIds([nodeId])`).
  - Shift+Click or Ctrl+Click: toggles node in selection (`prev.includes(nodeId) ? prev.filter(...) : [...prev, nodeId]`).
  - Clicking empty canvas: clears selection (`setSelectedNodeIds([])`).

- [x] **Step 2: Implement Marquee Drag Selection**
  When mouse is pressed on canvas background (without Spacebar held):
  - `marqueeStartRef.current = { clientX, clientY }`.
  - On mouse move, calculate world rect: `minX, maxX, minY, maxY`.
  - Render an SVG/HTML dashed selection box `<div className="border border-[#3B82F6] bg-[#3B82F6]/10 ..."/>`.
  - On mouse up, select all nodes whose bounding box intersects the marquee rectangle.

- [x] **Step 3: Multi-Node Synchronized Dragging**
  When dragging a selected node, compute `(dx, dy)`. If multiple nodes are selected, apply `(dx, dy)` to every node in `selectedNodeIds`, preserving relative distances.

- [x] **Step 4: Select All (`Ctrl+A`) & Deselect (`Escape`)**
  In the unified keyboard handler:
  - `(e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')` -> `setSelectedNodeIds(nodes.map(n => n.id))`.
  - `e.key === 'Escape'` -> clear selection `setSelectedNodeIds([])`.

- [x] **Step 5: Verify Multi-Selection**
  Run `npm run build`. Verify: Shift+Click selects multiple nodes, dragging moves all selected nodes together, Del deletes all selected nodes at once.

---

## Task 3: Clipboard Architecture (Copy, Cut, Paste & Duplicate)

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/components/layout/WorkspaceCanvas.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `clipboardRef.current: { nodes: MathNodeInstance[]; connections: NodeConnection[]; center: { x: number; y: number } } | null`

- [x] **Step 1: Implement Copy (`Ctrl+C`)**
  When `Ctrl+C` is pressed:
  - Extract all nodes where `selectedNodeIds.includes(node.id)`.
  - Extract all connections whose `fromNodeId` AND `toNodeId` are BOTH inside `selectedNodeIds` (internal sub-graph connections).
  - Compute center point of selected nodes.
  - Store deep-cloned nodes and connections in `clipboardRef.current` and serialize to `navigator.clipboard.writeText(...)`.
  - Show toast: `Copied N node(s)`.

- [x] **Step 2: Implement Cut (`Ctrl+X`)**
  Trigger Copy logic, then immediately execute `handleDeleteSelectedNodes()`.
  Show toast: `Cut N node(s)`.

- [x] **Step 3: Implement Paste (`Ctrl+V`)**
  When `Ctrl+V` is pressed:
  - Read from `clipboardRef.current` (or parse JSON from clipboard).
  - Determine target position: cursor position if mouse is over canvas, or offset `(+40, +40)` from original position.
  - Generate an ID translation map: `const idMap = new Map<string, string>()` (`oldId -> newId`).
  - Create new nodes with new IDs, updated titles, and offset coordinates.
  - Re-map internal connections using `idMap.get(fromNodeId)` and `idMap.get(toNodeId)`.
  - Mutate graph atomically with new nodes and connections.
  - Set `selectedNodeIds` to the newly pasted node IDs so user can immediately move them.
  - Show toast: `Pasted N node(s)`.

- [x] **Step 4: Implement Duplicate (`Ctrl+D` and Header Duplicate Button)**
  Duplicate selected nodes: clones selection, creates new IDs, shifts coordinates by `(+36, +36)`, preserves internal wires, and selects cloned nodes.

- [x] **Step 5: Verify Clipboard Workflows**
  Run `npm run build`. Test: Select 2 connected nodes, `Ctrl+C`, move mouse, `Ctrl+V`. Verify pasted nodes appear at cursor with intact wires between them.

---

## Task 4: Undo & Redo History System (`Ctrl+Z` / `Ctrl+Y`)

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `history: { nodes: MathNodeInstance[]; connections: NodeConnection[] }[]`, `historyIndex: number`

- [x] **Step 1: Add History Stack to Active Tab**
  On significant mutations (add node, delete node, paste, connect wire, disconnect wire, drag end), push snapshot `{ nodes, connections }` to tab's `history` array (max depth 30).

- [x] **Step 2: Implement Undo (`Ctrl+Z`) and Redo (`Ctrl+Y` / `Ctrl+Shift+Z`)**
  - Undo: If `historyIndex > 0`, decrement index and restore `{ nodes, connections }`.
  - Redo: If `historyIndex < history.length - 1`, increment index and restore.
  - Show brief toast (`Undo: restored N nodes`).

- [x] **Step 3: Verify History**
  Verify that deleting a node, pressing `Ctrl+Z` brings it and its wires back, and `Ctrl+Y` re-deletes it.

---

## Task 5: Double-Click Quick-Add Popup & Inline Node Title Renaming

**Files:**
- Modify: `src/components/layout/WorkspaceCanvas.tsx`
- Modify: `src/components/nodes/MathNodeCard.tsx`

- [x] **Step 1: Implement Double-Click on Canvas (Quick Search)**
  - Double clicking canvas background opens a compact, floating search popup right under the cursor (`x, y` world coords).
  - Quick filter list of available node types.
  - Pressing Enter or clicking adds node at exact clicked coordinate.

- [x] **Step 2: Implement Inline Title Editing on Node Card**
  - Double clicking node title text turns it into an `<input>` field.
  - On Enter or Blur, saves new title to node.
  - On Escape, cancels edit.

- [x] **Step 3: Socket Alt+Click / Quick Detach**
  - Clicking on an already-connected input socket detaches existing wire into user's cursor so they can immediately reconnect it elsewhere.

---

## Task 6: Viewport Framing Shortcuts & Verification

**Files:**
- Modify: `src/components/layout/WorkspaceCanvas.tsx`

- [x] **Step 1: Frame Selected Nodes (`F` Key)**
  - When node(s) are selected, pressing `F` smoothly pans and zooms the viewport to center and frame the selected nodes.
  - If no node is selected, `F` frames the entire graph.

- [x] **Step 2: Escape Key Handler**
  - If dragging a wire, `Escape` cancels the wire drag cleanly.
  - If context menu or quick-add popup is open, `Escape` closes it.
  - Otherwise, `Escape` deselects all nodes.

- [x] **Step 3: Verification & Test Suite**
  - Build with `npm run build`.
  - Verify every shortcut and micro-feature in browser.
