import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const outputRoot = join(siteRoot, 'dist', 'site');
const mode = process.env.REGISTRATION_DEPLOY_MODE || 'mock';
if (!['mock', 'live'].includes(mode)) throw new Error('REGISTRATION_DEPLOY_MODE must be mock or live.');

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });
const copy = relative => {
  const source = join(siteRoot, relative);
  if (!existsSync(source)) throw new Error(`Missing public source: ${relative}`);
  const destination = join(outputRoot, relative);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
};

['index.html', 'mygita.html', 'privacy.html', 'site.webmanifest', 'CNAME', 'assets', 'style'].forEach(copy);
mkdirSync(join(outputRoot, 'mygita'), { recursive: true });
['mygita/index.html', 'mygita/src', 'mygita/styles'].forEach(copy);

const mygitaPath = join(outputRoot, 'mygita.html');
let html = readFileSync(mygitaPath, 'utf8');
html = html
  .replace(/data-registration-mode="(?:mock|live)"/, `data-registration-mode="${mode}"`)
  .replace('https://dev.api.gitajyoti.org/v1/client.js', 'https://api.gitajyoti.org/v1/client.js')
  .replace('https://dev.api.gitajyoti.org"', 'https://api.gitajyoti.org"');
writeFileSync(mygitaPath, html);
console.log(`Built public site at ${outputRoot} with registration mode ${mode}.`);
