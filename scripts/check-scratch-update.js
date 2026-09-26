const fs = require('fs');
const crypto = require('crypto');

const PROJECT_ID = '831274817';
const STATE_FILE = 'build/scratch-state.json';

async function downloadProject() {
  const metadataResponse = await fetch(`https://trampoline.turbowarp.org/api/projects/${PROJECT_ID}`);
  if (!metadataResponse.ok) {
    throw new Error(`Project metadata request failed: ${metadataResponse.status}`);
  }

  const metadata = await metadataResponse.json();
  const token = metadata.project_token;
  if (!token) {
    throw new Error('Scratch project token was not returned.');
  }

  const projectResponse = await fetch(
    `https://projects.scratch.mit.edu/${PROJECT_ID}?token=${encodeURIComponent(token)}`
  );
  if (!projectResponse.ok) {
    throw new Error(`Project download failed: ${projectResponse.status}`);
  }

  return Buffer.from(await projectResponse.arrayBuffer());
}

async function main() {
  const project = await downloadProject();
  const hash = crypto.createHash('sha256').update(project).digest('hex');

  let previousHash = null;
  if (fs.existsSync(STATE_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      previousHash = state.sha256 ?? null;
    } catch (error) {
      console.warn(`Could not read ${STATE_FILE}; treating this as an update.`);
    }
  }

  const changed = previousHash !== hash;

  console.log(`Scratch project: ${PROJECT_ID}`);
  console.log(`Current SHA-256: ${hash}`);
  console.log(`Previous SHA-256: ${previousHash ?? '(none)'}`);
  console.log(`Changed: ${changed}`);

  const output = process.env.GITHUB_OUTPUT;
  if (output) {
    fs.appendFileSync(output, `changed=${changed}\nsha256=${hash}\n`);
  }

  // The workflow deliberately does not save the new hash here.
  // It is saved only after package-scratch.js succeeds.
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
