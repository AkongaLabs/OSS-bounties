import { Script } from 'node:vm';
import { mkdir } from 'node:fs/promises';
const page = await Bun.file(new URL('./index.html', import.meta.url)).text();
const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 1 || /<script[^>]+src=|<link[^>]+href=/i.test(page)) throw new Error('The application must remain one HTML file with inline CSS/JS.');
new Script(scripts[0][1], { filename: 'index.html' });
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
await Bun.write(new URL('./dist/index.html', import.meta.url), page);
console.log('Inline script syntax passed; dist/index.html is the standalone application.');
