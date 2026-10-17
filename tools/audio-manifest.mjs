// Liste les pistes audio présentes (ogg + mp3) dans public/assets/audio/manifest.json.
// À relancer après tout ajout de son : npm run assets
import { readdirSync, writeFileSync } from 'node:fs';

const dir = new URL('../public/assets/audio/', import.meta.url);
const files = readdirSync(dir);
const names = [...new Set(files.filter((f) => f.endsWith('.ogg')).map((f) => f.slice(0, -4)))]
  .filter((n) => files.includes(`${n}.mp3`))
  .sort();
writeFileSync(new URL('manifest.json', dir), JSON.stringify({ tracks: names }, null, 1) + '\n');
console.log(`${names.length} pistes audio`);
