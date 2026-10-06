import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'content.js', 'glass.js', 'assets']) {
  await cp(file, `dist/${file}`, { recursive: true });
}
// Apple font files are used only by the local preview. Do not redistribute them.
const css = await readFile('styles.css','utf8');
await writeFile('dist/styles.css',css.replace(/,url\('\.\/fonts\/SF-Pro-Display-(?:Regular|Medium)\.otf'\) format\('opentype'\)/g,''));
console.log('Static site built in dist/');
