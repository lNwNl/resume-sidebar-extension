import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data = await readFile(resolve(root, 'extension/data.js'), 'utf8');
const errors = [];
if (!data.includes('PUBLIC_EXAMPLE_DATA') || !data.includes('示例用户')) errors.push('公开数据缺少示例标记');
const phones = data.match(/(?<!\d)1[3-9]\d{9}(?!\d)/g) || [];
if (phones.some((phone) => phone !== '13800000000')) errors.push('发现非示例手机号');
if (/(?<!\d)\d{17}[\dXx](?!\d)/.test(data)) errors.push('发现疑似身份证号');
const emails = data.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g) || [];
if (emails.some((email) => !email.endsWith('@example.com'))) errors.push('发现非 example.com 邮箱');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('公开示例数据检查通过');
