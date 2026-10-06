import { access, readFile } from 'node:fs/promises';
import { projects } from '../content.js';
const html = await readFile('index.html', 'utf8');
const images = projects.flatMap(project => project.images);
const paths = images.map(item => item.src);
const css = await readFile('styles.css','utf8');
const app = await readFile('app.js','utf8');
paths.push(...Array.from(css.matchAll(/url\(['"](\.\/[^'"]+)['"]\)/g),match=>match[1]));
paths.push(...Array.from(app.matchAll(/(?:src|poster):\s*['"](\.\/[^'"]+)['"]/g),match=>match[1]));
paths.push(...Array.from(html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g), match => match[1]));
for (const file of new Set(paths)) {
  await access(file.split('?')[0]);
}
const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g), match => match[1]);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate HTML IDs');
for (const match of html.matchAll(/href="#([^"]+)"/g)) {
  if (!ids.includes(match[1])) throw new Error(`Missing anchor: ${match[1]}`);
}
console.log(`Checked ${projects.length} Figma projects, ${images.length} images, local assets and anchors.`);
