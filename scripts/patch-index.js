const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/patch-index.js <index.html>');

const absolute = path.resolve(file);
let html = fs.readFileSync(absolute, 'utf8');

const stock = 'scaffolding.setUsername("player####".replace(/#/g, () => Math.floor(Math.random() * 10)));';
const patched = `const urlParams = new URLSearchParams(window.location.search);
      const paramName = urlParams.get('name');
      const finalUsername = paramName
              ? paramName
              : "player####".replace(/#/g, () => Math.floor(Math.random() * 10));

      scaffolding.setUsername(finalUsername);`;

if (html.includes(patched)) {
  console.log(`Already patched: ${file}`);
  process.exit(0);
}

if (!html.includes(stock)) {
  throw new Error(`TurboWarp username line not found in ${file}. Packager output may have changed.`);
}

html = html.replace(stock, patched);
fs.writeFileSync(absolute, html);
console.log(`Patched: ${file}`);
