import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'content.js', 'glass.js', 'assets']) {
  await cp(file, `dist/${file}`, { recursive: true });
}
console.log('Static site built in dist/');
