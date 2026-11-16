#!/usr/bin/env node
// Build three self-contained static previews (facade, plaza, garden) that open
// straight from disk, without a local server. The local scene modules are
// inlined as data: URLs; Three.js still loads from the jsDelivr CDN.
//
// Usage: node scripts/build-static-previews.mjs [output-directory]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'project');
const outDir = path.resolve(process.argv[2] ?? 'renders');
const views = ['facade', 'plaza', 'garden'];

function replaceOnce(text, search, replacement) {
  const index = text.indexOf(search);
  if (index < 0 || text.indexOf(search, index + search.length) >= 0) {
    throw new Error(`Expected exactly one occurrence of: ${search}`);
  }
  return text.slice(0, index) + replacement + text.slice(index + search.length);
}

const page = await readFile(path.join(project, 'index.html'), 'utf8');
let main = await readFile(path.join(project, 'src/anime_main.js'), 'utf8');
for (const name of ['anime_architecture_detail.js', 'anime_environment_detail.js']) {
  const source = await readFile(path.join(project, 'src', name), 'utf8');
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  main = replaceOnce(main, `'./${name}'`, `'${url}'`);
}
// A file:// page has no query string, so each preview names its view on <html>.
main = replaceOnce(main, "new URLSearchParams(location.search).get('render')",
  "new URLSearchParams(location.search).get('render')\n  ?? document.documentElement.dataset.render");

await mkdir(outDir, { recursive: true });
for (const view of views) {
  let html = replaceOnce(page, '<html lang="zh-CN">', `<html lang="zh-CN" data-render="${view}">`);
  html = replaceOnce(html, '<script type="module" src="./src/anime_main.js"></script>',
    `<script type="module">${main}</script>`);
  await writeFile(path.join(outDir, `${view}.html`), html);
}
console.log(`Built three static previews in ${outDir}`);
