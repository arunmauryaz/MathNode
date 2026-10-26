import { build } from 'esbuild';
import { mkdtemp, rm, mkdir, open, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer } from '../mcp/server.mjs';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(
    'MathNode MCP server (stdio)\n--workspace <directory> (default: .mathnode-agent)\n--bridge-port <port> (default: 4319)\n--no-bridge (file projects only)',
  );
  process.exit(0);
}
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--'))
    throw Error(`Missing value for ${name}`);
  return args[index + 1];
};
const root = resolve(
    option(
      '--workspace',
      process.env.MATHNODE_WORKSPACE || join(repo, '.mathnode-agent'),
    ),
  ),
  port = args.includes('--no-bridge')
    ? false
    : Number(option('--bridge-port', '4319'));
if (port !== false && (!Number.isInteger(port) || port < 0 || port > 65535))
  throw Error('Invalid bridge port');
await mkdir(root, { recursive: true });
const lockPath = join(root, 'server.lock');
let lock;
try {
  lock = await open(lockPath, 'wx');
} catch (e) {
  if (e.code !== 'EEXIST') throw e;
  const pid = Number(await readFile(lockPath, 'utf8'));
  let alive = true;
  try {
    process.kill(pid, 0);
  } catch (error) {
    if (error.code === 'ESRCH') alive = false;
  }
  if (alive)
    throw Error(
      `Workspace already in use by process ${pid}. Share that MCP connection or use another --workspace.`,
    );
  await unlink(lockPath);
  lock = await open(lockPath, 'wx');
}
await lock.writeFile(String(process.pid));
const temp = await mkdtemp(join(tmpdir(), 'mathnode-mcp-'));
let instance,
  closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await instance?.server.close();
  await lock.close();
  await rm(lockPath, { force: true });
  await rm(temp, { recursive: true, force: true });
}
try {
  const file = join(temp, 'core.mjs');
  await build({
    entryPoints: [join(repo, 'sdk/index.ts')],
    outfile: file,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
  });
  const coreUrl = pathToFileURL(file).href;
  const core = await import(coreUrl);
  instance = await startServer({ core, coreUrl, root, bridgePort: port });
} catch (e) {
  console.error(e.message);
  await close();
  process.exitCode = 1;
}
process.once('SIGINT', () => {
  close().finally(() => process.exit(0));
});
process.once('SIGTERM', () => {
  close().finally(() => process.exit(0));
});
process.stdin.once('end', () => {
  close().finally(() => process.exit(0));
});
