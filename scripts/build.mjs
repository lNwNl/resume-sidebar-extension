import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const valueAfter = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
};
const dataArg = valueAfter('--data');
const outArg = valueAfter('--out');
if (!outArg) {
  console.error('用法：node scripts/build.mjs --out <输出目录> [--data <数据文件>]');
  process.exit(1);
}
const source = resolve(root, 'extension');
const output = resolve(process.cwd(), outArg);
if (output === source || source.startsWith(`${output}/`)) {
  console.error('输出目录不能是 extension 源码目录或其父目录');
  process.exit(1);
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });
if (dataArg) {
  const data = await readFile(resolve(process.cwd(), dataArg), 'utf8');
  await writeFile(resolve(output, 'data.js'), data);
}
console.log(`已生成：${output}`);
