const fs = require('fs');
const path = require('path');
const Packager = require('@turbowarp/packager');

const ROOT = path.resolve(__dirname, '..');
const PROJECT_ID = '831274817';

const configs = [
  { name: 'play', config: 'build/packager-configs/play.json' },
  { name: 'playlite', config: 'build/packager-configs/playlite.json' }
];

async function downloadProject() {
  const metadataResponse = await fetch(`https://trampoline.turbowarp.org/api/projects/${PROJECT_ID}`);
  if (!metadataResponse.ok) throw new Error(`Project metadata request failed: ${metadataResponse.status}`);
  const metadata = await metadataResponse.json();
  const token = metadata.project_token;
  if (!token) throw new Error('Scratch project token was not returned.');

  const projectResponse = await fetch(`https://projects.scratch.mit.edu/${PROJECT_ID}?token=${encodeURIComponent(token)}`);
  if (!projectResponse.ok) throw new Error(`Project download failed: ${projectResponse.status}`);
  return Buffer.from(await projectResponse.arrayBuffer());
}

function applyConfig(target, config, prefix = '') {
  for (const [key, value] of Object.entries(config)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
        target[key] = {};
      }
      applyConfig(target[key], value, fullKey);
    } else {
      target[key] = value;
    }
  }
}

function getPath(object, pathString) {
  return pathString.split('.').reduce((value, key) => value?.[key], object);
}

function verifyConfig(packager, config, name) {
  for (const [key, value] of Object.entries(config)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      verifyConfig(packager, value, name);
      continue;
    }

    const actual = getPath(packager.options, key);
    if (JSON.stringify(actual) !== JSON.stringify(value)) {
      throw new Error(
        `${name}: Packager option '${key}' was not applied. ` +
        `expected ${JSON.stringify(value)}, got ${JSON.stringify(actual)}`
      );
    }
  }
}

async function main() {
  const projectData = await downloadProject();
  console.log(`Downloaded Scratch project ${PROJECT_ID}`);

  const loadedProject = await Packager.loadProject(projectData, (type, a, b) => {
    if (typeof b === 'number' && b > 0) console.log(`load ${type}: ${a}/${b}`);
    else if (typeof a === 'number') console.log(`load ${type}: ${Math.round(a * 100)}%`);
  });

  for (const item of configs) {
    const configPath = path.join(ROOT, item.config);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const packager = new Packager.Packager();
    packager.project = loadedProject;

    // Apply only the fields explicitly present in this build's config.
    // A new Packager is created for every output because Packager instances are single-use.
    applyConfig(packager.options, config);
    verifyConfig(packager, config, item.name);

    console.log(`${item.name}: applied config ${configPath}`);
    console.log(`${item.name}: highQualityPen=${JSON.stringify(packager.options.highQualityPen)}`);
    console.log(`${item.name}: framerate=${JSON.stringify(packager.options.framerate)}`);
    console.log(`${item.name}: turbo=${JSON.stringify(packager.options.turbo)}`);

    const result = await packager.package();
    if (result.type !== 'text/html') throw new Error(`${item.name}: expected HTML output, got ${result.type}`);

    const outDir = path.join(ROOT, 'mirror', item.name);
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), Buffer.from(result.data));

    console.log(`Generated ${item.name}/index.html`);
    const patch = require('child_process').spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'patch-index.js'), path.join(outDir, 'index.html')], { stdio: 'inherit' });
    if (patch.status !== 0) throw new Error(`Patching ${item.name}/index.html failed.`);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
