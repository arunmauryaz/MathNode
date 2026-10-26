import { createServer } from 'node:http';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
export const hash = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function createBridge(port = 4319) {
  const token = randomBytes(32).toString('hex');
  const state = {
    clientId: null,
    lastSeen: 0,
    snapshot: null,
    hash: null,
    pending: null,
    appliedRevision: null,
    error: null,
    boundProjectId: null,
  };
  const issued = new Map();
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    const allowed =
      origin && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
    if (
      !allowed ||
      !/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host || '')
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, X-MathNode-Token',
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/bridge/session' && req.method === 'GET') {
      res.end(JSON.stringify({ token, protocol: 1 }));
      return;
    }
    if (
      req.url !== '/bridge/sync' ||
      req.method !== 'POST' ||
      req.headers['x-mathnode-token'] !== token
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      let data = '';
      for await (const part of req) {
        data += part;
        if (data.length > 8_000_000) throw Error('Snapshot is too large');
      }
      const body = JSON.parse(data);
      if (
        typeof body.clientId !== 'string' ||
        !body.snapshot?.graph ||
        !Array.isArray(body.snapshot.definitions) ||
        !Array.isArray(body.snapshot.folders)
      )
        throw Error('Invalid live snapshot');
      if (
        state.clientId &&
        state.clientId !== body.clientId &&
        Date.now() - state.lastSeen < 10000
      ) {
        res.writeHead(409);
        res.end(
          JSON.stringify({
            error: 'Another MathNode browser is already connected',
          }),
        );
        return;
      }
      state.clientId = body.clientId;
      state.lastSeen = Date.now();
      state.snapshot = body.snapshot;
      state.hash = hash(body.snapshot);
      if (body.applyError) {
        state.error = body.applyError;
        state.conflicted = true;
        state.pending = null;
      }
      if (
        body.ackId &&
        body.ackId !== state.lastAckId &&
        issued.has(body.ackId)
      ) {
        state.lastAckId = body.ackId;
        if (body.ackHash !== state.hash) {
          state.error =
            'Canvas changed after applying the agent update. Pull the latest canvas before continuing.';
          state.conflicted = true;
          state.pending = null;
        } else {
          state.appliedRevision = issued.get(body.ackId).revision;
          state.synchronizedHash = state.hash;
          state.conflicted = false;
          state.error = null;
          if (state.pending?.commandId === body.ackId) state.pending = null;
          else if (state.pending) state.pending.baseHash = state.hash;
        }
      }
      if (state.pending && state.pending.baseHash !== state.hash) {
        state.error =
          'Canvas changed before the agent edit arrived. Pull the latest canvas and retry.';
        state.conflicted = true;
        state.pending = null;
      }
      res.end(
        JSON.stringify({
          pending: state.pending,
          error: state.error,
          connected: true,
        }),
      );
    } catch (e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
  });
  return {
    state,
    async start() {
      await new Promise((yes, no) => {
        server.once('error', no);
        server.listen(port, '127.0.0.1', yes);
      });
      return server.address().port;
    },
    connected() {
      return !!state.snapshot && Date.now() - state.lastSeen < 10000;
    },
    status() {
      return {
        connected: this.connected(),
        clientId: state.clientId,
        boundProjectId: state.boundProjectId,
        liveHash: state.hash,
        synchronizedHash: state.synchronizedHash,
        pendingRevision: state.pending?.revision,
        appliedRevision: state.appliedRevision,
        error: state.error,
      };
    },
    push(project, definitions, folders) {
      if (!this.connected())
        throw Error(
          'No live MathNode app. Enable MCP connection in Settings > General.',
        );
      state.boundProjectId = project.id;
      state.pending = {
        commandId: randomUUID(),
        revision: project.revision,
        baseHash: state.hash,
        snapshot: { graph: project.graph, definitions, folders },
      };
      issued.set(state.pending.commandId, state.pending);
      if (issued.size > 32) issued.delete(issued.keys().next().value);
      state.error = null;
      state.conflicted = false;
      return this.status();
    },
    close() {
      server.closeAllConnections();
      return new Promise((yes) => server.close(yes));
    },
  };
}
