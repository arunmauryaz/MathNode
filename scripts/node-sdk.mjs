import { build } from 'esbuild';
import {
  mkdtemp,
  writeFile,
  readFile,
  readdir,
  mkdir,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { isDeepStrictEqual } from 'node:util';
import JSZip from 'jszip';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(join(tmpdir(), 'mathnode-sdk-'));
try {
  const bundle = join(temp, 'sdk.mjs');
  await build({
    entryPoints: [join(root, 'sdk/index.ts')],
    outfile: bundle,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
  });
  const sdk = await import(pathToFileURL(bundle).href);
  const [command = 'help', target, ...rest] = process.argv.slice(2);
  async function files(path) {
    const entry = await readdir(path, { withFileTypes: true }).catch(
      () => null,
    );
    if (!entry) return [path];
    const all = [];
    for (const d of entry)
      all.push(
        ...(d.isDirectory()
          ? await files(join(path, d.name))
          : [join(path, d.name)]),
      );
    return all.filter((p) => p.endsWith('.mnode'));
  }
  async function run(definition, values) {
    const workerPath = join(temp, 'runner.mjs');
    await writeFile(
      workerPath,
      `import {parentPort,workerData} from 'node:worker_threads';import {runExample} from ${JSON.stringify(pathToFileURL(bundle).href)};try{parentPort.postMessage({ok:true,result:runExample(workerData.definition,workerData.values)});}catch(e){parentPort.postMessage({ok:false,error:e.message});}`,
    );
    return await new Promise((yes, no) => {
      const worker = new Worker(pathToFileURL(workerPath), {
        workerData: { definition, values },
        resourceLimits: { maxOldGenerationSizeMb: 256 },
      });
      const timer = setTimeout(() => {
        worker.terminate();
        no(new Error('Kernel exceeded the 3 second execution deadline'));
      }, 3000);
      worker.once('message', (m) => {
        clearTimeout(timer);
        worker.terminate();
        m.ok ? yes(m.result) : no(new Error(m.error));
      });
      worker.once('error', (e) => {
        clearTimeout(timer);
        no(e);
      });
      worker.once('exit', (code) => {
        if (code !== 0) {
          clearTimeout(timer);
          no(new Error('Kernel worker exited unexpectedly'));
        }
      });
    });
  }
  if (command === 'scaffold') {
    if (!target) throw Error('Supply an output .mnode file');
    await writeFile(resolve(target), JSON.stringify(sdk.scaffold, null, 2), {
      flag: 'wx',
    });
    console.log(`Created ${target}`);
  } else if (command === 'validate') {
    if (!target) throw Error('Supply a .mnode file or directory');
    const paths = await files(resolve(target));
    if (!paths.length) throw Error('No .mnode files found');
    for (const file of paths) sdk.validateNode(await readFile(file, 'utf8'));
    console.log(`Validated ${paths.length} node(s). No kernels executed.`);
  } else if (command === 'run') {
    if (!target) throw Error('Supply a .mnode file');
    const d = sdk.validateNode(await readFile(resolve(target), 'utf8'));
    console.log(
      JSON.stringify(await run(d, rest[0] ? JSON.parse(rest[0]) : {}), null, 2),
    );
  } else if (command === 'export-standard') {
    const out = resolve(target || join(root, 'library/standard'));
    const archive = new JSZip();
    await mkdir(out, { recursive: true });
    for (const d of sdk.STANDARD_NODE_DEFINITIONS) {
      const folder = join(out, d.category.replace(/[^a-zA-Z0-9]+/g, '-'));
      await mkdir(folder, { recursive: true });
      await writeFile(
        join(folder, `${d.id}.mnode`),
        JSON.stringify(d, null, 2),
      );
      archive.file(`${d.category}/${d.id}.mnode`, JSON.stringify(d, null, 2));
    }
    await writeFile(
      join(out, 'examples.json'),
      JSON.stringify(sdk.STANDARD_EXAMPLES, null, 2),
    );
    await writeFile(
      join(dirname(out), 'MathNode-Standard.zip'),
      await archive.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      }),
    );
    console.log(
      `Exported ${sdk.STANDARD_NODE_DEFINITIONS.length} nodes to ${out}`,
    );
  } else if (command === 'test-standard') {
    let count = 0;
    for (const d of sdk.STANDARD_NODE_DEFINITIONS) {
      const fixture = sdk.STANDARD_EXAMPLES[d.id],
        result = await run(d, fixture.values),
        raw = result.result,
        actual =
          raw && typeof raw === 'object' && 'latex' in raw ? raw.value : raw;
      const close = (a, b) =>
        typeof b === 'number'
          ? typeof a === 'number' &&
            Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b))
          : Array.isArray(b)
            ? Array.isArray(a) &&
              a.length === b.length &&
              b.every((v, i) => close(a[i], v))
            : isDeepStrictEqual(a, b);
      if (fixture.expected !== undefined && !close(actual, fixture.expected))
        throw Error(`${d.id}: unexpected result ${JSON.stringify(result)}`);
      count++;
    }
    console.log(`Passed ${count} standard node examples.`);
  } else {
    console.log(
      'MathNode SDK\n  scaffold <file.mnode>\n  validate <file.mnode|directory>\n  run <file.mnode> [JSON input values]\n  export-standard [directory]\n  test-standard\n\nOnly run node code you trust. Workers enforce a deadline; they are not a security sandbox.',
    );
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await rm(temp, { recursive: true, force: true });
}
