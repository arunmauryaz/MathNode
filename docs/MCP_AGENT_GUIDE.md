# MathNode MCP server and agent workflow

The server lets an MCP client create mathematical graphs, edit connections and values, execute every step, build reusable prefabs, install code kernels, and share projects and nodes. It uses the official TypeScript MCP SDK over **stdio**. It also provides an optional authenticated loopback bridge to a MathNode browser canvas. File-based projects work without a browser.

## Start and connect

Use Node.js 22.3+ and npm 10.5+. Install dependencies once with `npm install`. An MCP host launches the server directly:

```json
{
  "mcpServers": {
    "mathnode": {
      "command": "node",
      "args": ["D:/MATHNODE/scripts/mcp-server.mjs", "--workspace", "D:/MATHNODE/.mathnode-agent"]
    }
  }
}
```

Use the absolute location of your checkout. This example is a common host configuration shape; use the equivalent stdio configuration in your MCP client. `npm run mcp -- --help` lists command-line options. Launching `node scripts/mcp-server.mjs` listens for MCP JSON-RPC on stdin, so it will appear to wait when run directly in a terminal. Logs go to stderr.

Options: `--workspace <directory>` (or `MATHNODE_WORKSPACE`), `--bridge-port <port>` (default 4319; 0 chooses a free port), `--no-bridge`. The workspace stores projects, custom library definitions, exported artifacts, and a process lock. One server owns each workspace. Separate hosts should share one server through their host facilities or use different workspaces. Graph history lasts for a server session; saved projects and library survive restarts.

For live editing, start the app (`npm run dev`), open **Settings → General**, enable **MCP connection**, and apply. The app connects to `127.0.0.1:4319`; change the port in Settings when needed. Check `live_status` or the Settings connection message. This works for local HTTP development/preview origins; hosted HTTPS sites cannot use this local bridge.

## Read this before editing

1. Call `server_status` and read `mathnode://agent-guide`.
2. Search with `library_search`, then inspect exact port names with `library_get`.
3. Choose an existing project from `project_list`, create one, or use `live_pull` to adopt the current browser canvas.
4. Use `graph_edit` to add several nodes and wires **atomically**. Supply stable IDs for nodes referenced later in the same transaction. Each input has at most one incoming wire. Set `replace:true` to reconnect it.
5. Call `graph_validate`, then `graph_execute`. Inspect `success`, per-node `errors`, `errorKind`, `errorSourceNodeId`, `errorConnectionIds`, `computedOutputs`, `display.text`, and `display.latex`. Do not claim success when execution reports errors or an unbound formula remains numerical-undefined.
6. Use `graph_layout` and optional `group_create` for clarity. Use `prefab_create` only after testing a complete selection.
7. Export with `library_export` or `project_export`. Use `live_push` to show a file project in the browser, then poll `live_status` for `appliedRevision`.

Every graph mutation returns its new revision. Include `expectedRevision` on subsequent edits to reject stale operations. A failed `graph_edit` leaves the graph and revision unchanged. Undo/redo are graph-level transactions, not individual wire steps inside a batch.

## Tools

| Area | Tools |
|---|---|
| Status | `server_status`, `live_status` |
| Projects | `project_list`, `project_create`, `project_get`, `project_import`, `project_export` |
| Library and SDK | `library_search`, `library_get`, `library_install`, `library_export`, `library_folder_create`, `library_move` |
| Graph editing | `graph_edit`, `graph_add_node`, `graph_update_node`, `graph_delete_node`, `graph_connect`, `graph_disconnect` |
| Mathematics | `graph_from_formula`, `graph_validate`, `graph_execute` |
| Organization | `graph_layout`, `group_create`, `group_remove`, `graph_history` |
| Reuse | `prefab_create`, `prefab_inspect`, `prefab_unpack` |
| Browser | `live_pull`, `live_push` |

Resources: `mathnode://agent-guide`, `mathnode://node-authoring`, `mathnode://library`. Prompts: `solve-math`, `create-prefab`, `author-node`, each taking a `request` string.

## Example: step-by-step (A+B)²

Call `graph_from_formula` with:

```json
{"name":"Whole Square", "latex":"(A+B)^2", "bindings":{"A":2,"B":3}}
```

The result supplies a project ID, steps, unknown symbol names, and a graph. It contains Value A, Value B, Add, Value 2, Power, and Output. Repeated symbols reuse their source. Execute it to verify intermediate 5 and final 25. Without bindings it produces a symbolic formula instead.

Common arithmetic, roots, powers and functions are decomposed. Unsupported decomposition forms remain explicit atomic LaTeX Value nodes; the server does not invent intermediate mathematical steps. A graph generated from a formula is not a proof or a general equation-solving algorithm. An agent can build additional derivation steps using Expand, Factor, Substitute, Derivative and Integral nodes, explain transformations, and verify numerical examples.

To create a reusable whole-square node with **exactly A and B as exposed inputs**, leave the exponent as a local default on a Power node instead of selecting a Value 2 source. Every selected Value source becomes an input by design. Build this graph with `graph_edit`:

```json
{
  "projectId":"PROJECT_ID", "expectedRevision":0,
  "operations":[
    {"op":"add_node","node":{"id":"a","definitionId":"math.value","title":"A","x":0,"y":0,"values":{"value":"A"}}},
    {"op":"add_node","node":{"id":"b","definitionId":"math.value","title":"B","x":0,"y":300,"values":{"value":"B"}}},
    {"op":"add_node","node":{"id":"sum","definitionId":"standard.add","x":360,"y":0}},
    {"op":"add_node","node":{"id":"square","definitionId":"standard.square","x":720,"y":0}},
    {"op":"add_node","node":{"id":"out","definitionId":"math.output","x":1080,"y":0}},
    {"op":"connect","connection":{"fromNodeId":"a","fromSocket":"value","toNodeId":"sum","toSocket":"a"}},
    {"op":"connect","connection":{"fromNodeId":"b","fromSocket":"value","toNodeId":"sum","toSocket":"b"}},
    {"op":"connect","connection":{"fromNodeId":"sum","fromSocket":"result","toNodeId":"square","toSocket":"x"}},
    {"op":"connect","connection":{"fromNodeId":"square","fromSocket":"result","toNodeId":"out","toSocket":"input"}}
  ]
}
```

After executing, call `prefab_create` with these five node IDs. It replaces them with one instance and returns its definition and input socket names. Use `graph_update_node` to set those exposed inputs to 2 and 3; executing now yields 25. Export the definition to share it. `prefab_inspect` shows embedded definitions and bindings. `prefab_unpack` restores editable internal nodes, rewires external connections, and preserves input overrides.

## Custom kernels

Read `mathnode://node-authoring`. A `library_install` call accepts a definition object or a prefab definition. Installation validates structure but does not execute code. Reserved bundled IDs cannot be overwritten. Place custom nodes under a folder created with `library_folder_create`; `library_move` reorganizes them. A new custom definition is immediately available to graph tools and is delivered to the canvas when that project is pushed.

Prefer composing built-in nodes. When new code is necessary, use symbolic-aware `math.operate`, `math.call`, and `math.value`, not JavaScript arithmetic on expression objects. Test known results and invalid domains through a small graph before using the node in a larger project.

## Live synchronization and conflicts

`live_pull` takes the visible canvas snapshot and creates/binds an MCP project. Passing that project ID pulls fresh manual changes into the same project. Mutations to the bound project queue a new snapshot automatically. `live_push` explicitly shows any MCP project; existing matching tabs are updated, other projects open a new tab. Browser changes are undoable in the browser; MCP mutations are undoable with `graph_history`.

The bridge permits one browser at a time. It requires a random per-process token, binds only to loopback, and accepts local development origins. Pending updates are acknowledged with a revision. If the canvas changes before an update arrives, it reports a conflict instead of replacing the manual edit. If manual edits arrive after acknowledgement, graph tools require `live_pull` before further automatic mutations. Use `live_status` to observe the queued/applied revision and errors. The browser must remain open and MCP connection enabled for updates to apply.

File export is confined to the configured workspace, including checks against escaping symlinks. Project bundles use `.mathnode-project.json` and include graph plus directly used definitions; nested prefab dependencies are embedded in each definition. `project_import` accepts these bundles and ordinary `.mathnode` graph JSON. `.mnode` node definitions use `library_install`. GUI graph import accepts ordinary `.mathnode`; use MCP import/push for project bundles with dependencies.

Limits: 2000 nodes, 10000 wires, 500 edits per batch, three seconds and a 256 MB V8 old-generation heap budget per execution worker, bounded LaTeX parsing/transforms, and 50 graph undo steps. Cancellation stops execution workers. User code can still access Node.js APIs: deadline-limited workers are **not security sandboxes**. Only execute trusted kernels. Live bridge clients are trusted local apps. This is a mathematical DAG editor, not an imperative control-flow runtime: cycles are rejected, boolean/Select nodes operate on data, and it does not execute arbitrary cyclic flowcharts.

MCP implementation reference: [official TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) and [server guide](https://modelcontextprotocol.io/docs/develop/build-server).
