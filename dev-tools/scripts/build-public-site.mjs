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

['index.html', 'mygita.html', 'register.html', 'privacy.html', 'CNAME', 'assets', 'style'].forEach(copy);
mkdirSync(join(outputRoot, 'mygita'), { recursive: true });
['mygita/index.html', 'mygita/src', 'mygita/styles'].forEach(copy);

const registrationPath = join(outputRoot, 'register.html');
let html = readFileSync(registrationPath, 'utf8');
html = html.replace(/data-registration-mode="(?:mock|live)"/, `data-registration-mode="${mode}"`);
if (mode === 'mock') {
  html = html
    .replace('https://api.gitajyoti.org/v1/client.js', 'https://dev.api.gitajyoti.org/v1/client.js')
    .replace('https://api.gitajyoti.org"', 'https://dev.api.gitajyoti.org"');
} else {
  // Local serving needs these values, but a deployed artifact must not publish
  // a development endpoint that a visitor could select or discover.
  html = html.replace(/\sdata-registration-dev-(?:client-url|api-base-url)="[^"]*"/g, '');
}
writeFileSync(registrationPath, html);
console.log(`Built public site at ${outputRoot} with registration mode ${mode}.`);
