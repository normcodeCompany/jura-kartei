/* Kopiert die Web-Dateien nach docs/ – von dort veröffentlicht GitHub Pages.
   Nach jeder Änderung an index.html/app.js/styles.css aufrufen:
     node build.js && git add -A && git commit -m "Update" && git push */
const fs = require('fs'), path = require('path');
const DATEIEN = ['index.html', 'app.js', 'styles.css', 'sw.js', 'manifest.webmanifest',
                 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
const ziel = path.join(__dirname, 'docs');
fs.rmSync(ziel, { recursive: true, force: true });
for (const f of DATEIEN) {
  const z = path.join(ziel, f);
  fs.mkdirSync(path.dirname(z), { recursive: true });
  fs.copyFileSync(path.join(__dirname, f), z);
}
fs.writeFileSync(path.join(ziel, '.nojekyll'), '');
fs.writeFileSync(path.join(ziel, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log('docs/ erstellt – ' + DATEIEN.length + ' Dateien');
