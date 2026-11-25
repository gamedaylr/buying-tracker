import { readFileSync, writeFileSync } from 'node:fs';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function deploymentTitle(env = process.env) {
  const title = env.REACT_APP_APP_TITLE || env.APP_TITLE || env.REACT_APP_SHOP_NAME || env.SHOP_NAME || '';
  return String(title).trim();
}

/** Leave the built files alone when this is the Little Rock site. */
export function applyBrand(html, manifest, title) {
  const name = String(title || '').trim();
  if (!name) return { html, manifest, changed: false };
  const nextHtml = String(html).replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(name)}</title>`);
  return {
    html: nextHtml,
    manifest: { ...manifest, name, short_name: name },
    changed: true,
  };
}

function main() {
  const title = deploymentTitle();
  if (!title) return;
  const indexPath = 'build/index.html';
  const manifestPath = 'build/manifest.json';
  const html = readFileSync(indexPath, 'utf8');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const branded = applyBrand(html, manifest, title);
  if (!branded.changed) return;
  writeFileSync(indexPath, branded.html);
  writeFileSync(manifestPath, `${JSON.stringify(branded.manifest, null, 2)}\n`);
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith('brand-build.mjs');
if (isDirectRun) main();
