#!/usr/bin/env node
/* Bundle the current WebView source while keeping the audited HQ PBR maps external. */
const fs = require('fs');
const path = require('path');
const esbuild = require(process.env.WOP_ESBUILD_MODULE || 'esbuild');

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}`);
  return process.argv[index + 1];
}

(async () => {
  const root = path.resolve(__dirname, '..');
  const preview = path.join(root, 'unity_preview');
  const output = path.resolve(argument('--output'));
  const publicPBR = JSON.parse(fs.readFileSync(argument('--pbr-manifest'), 'utf8'));
  const html = fs.readFileSync(path.join(preview, 'index.html'), 'utf8');
  const inline = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!inline) throw new Error('unity_preview/index.html inline module was not found');

  const textureModule = fs.readFileSync(path.join(preview, 'blacksmith-textures.js'), 'utf8');
  const fx = textureModule.match(/export const BLACKSMITH_FX = (\{[\s\S]*?\});/);
  if (!fx) throw new Error('BLACKSMITH_FX declaration was not found');
  const externalTextures = [
    `export const BLACKSMITH_PBR = ${JSON.stringify(publicPBR)};`,
    `export const BLACKSMITH_FX = ${fx[1]};`,
    ''
  ].join('\n');

  const result = await esbuild.build({
    stdin: {
      contents: inline[1],
      resolveDir: preview,
      sourcefile: 'index-inline.js',
      loader: 'js'
    },
    plugins: [{
      name: 'audited-external-hq-pbr',
      setup(build) {
        build.onLoad({ filter: /blacksmith-textures\.js$/ }, () => ({
          contents: externalTextures,
          loader: 'js',
          resolveDir: preview
        }));
      }
    }],
    bundle: true,
    write: false,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    charset: 'utf8',
    legalComments: 'eof',
    logLevel: 'warning'
  });
  if (result.outputFiles.length !== 1) throw new Error('Expected one JavaScript bundle');
  const bundle = result.outputFiles[0].text;
  // GLTFLoader contains one tiny WebP capability-probe data URI. No authored
  // PBR map may join it: all fifteen game maps must remain external files.
  const webpDataURIs = bundle.match(/data:image\/webp;base64,/g) || [];
  if (webpDataURIs.length !== 1) {
    throw new Error('Unexpected embedded WebP data; the external audited HQ paths were not honoured');
  }
  for (const marker of [
    'attila', 'Attila_Rigged_3D_Model', 'Running_A', 'Walking_A',
    '1H_Melee_Attack_Slice_Diagonal', 'Spellcast_Shoot', 'pbr_hq/'
  ]) {
    if (!bundle.includes(marker)) throw new Error(`Bundle marker missing: ${marker}`);
  }
  if (/<\/script/i.test(bundle)) throw new Error('Unexpected script terminator in bundle');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, bundle);
  console.log(JSON.stringify({ output, bytes: Buffer.byteLength(bundle), externalPBR: true }));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
