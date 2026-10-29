import { cpSync, mkdirSync } from 'node:fs';

const webDirectory = new URL('../www/', import.meta.url);
mkdirSync(webDirectory, { recursive: true });

for (const file of ['index.html', 'style.css', 'app.js', 'manifest.json', 'sw.js', 'printer-bridge.js']) {
  cpSync(new URL(`../${file}`, import.meta.url), new URL(`../www/${file}`, import.meta.url));
}

cpSync(new URL('../icons/', import.meta.url), new URL('../www/icons/', import.meta.url), {
  recursive: true
});