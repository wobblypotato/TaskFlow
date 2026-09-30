const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const frontend = path.resolve(root, '..', 'frontend');
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(target) : [target];
});

const javascript = [...walk(path.join(root, 'src')), ...walk(path.join(frontend, 'js'))].filter((file) => file.endsWith('.js'));
for (const file of javascript) new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
for (const file of ['index.html', 'login.html', 'register.html', 'dashboard.html']) {
  if (!fs.existsSync(path.join(frontend, file))) throw new Error(`Missing frontend page: ${file}`);
}
console.log(`Build check passed (${javascript.length} JavaScript files, 4 frontend pages).`);
