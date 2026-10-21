import {build} from 'esbuild';
import {readFile,writeFile,copyFile,readdir,unlink} from 'node:fs/promises';
const {version}=JSON.parse(await readFile('release.json','utf8'));
// Release-specific filenames prevent a seven-day host/browser HTTP cache from
// combining a new page with old application code. Keep app.js for old links.
await build({entryPoints:['dist/app.mjs'],bundle:true,format:'iife',platform:'browser',target:'es2022',outfile:'dist/app.js',minify:true,legalComments:'eof'});
for(const name of await readdir('dist'))if(/^(app|boot)-1\.0\.0-rc\.\d+\.js$/.test(name)&&!name.endsWith('-'+version+'.js'))await unlink('dist/'+name);
await copyFile('dist/app.js','dist/app-'+version+'.js');await copyFile('dist/boot.js','dist/boot-'+version+'.js');
let html=await readFile('dist/index.html','utf8');
html=html.replace(/<html\b[^>]*>/,'<html lang="en" data-theme="dark" data-app-version="'+version+'">').replace(/src="\.\/app(?:-1\.0\.0-rc\.\d+)?\.js"/,'src="./app-'+version+'.js"').replace(/src="\.\/boot(?:-1\.0\.0-rc\.\d+)?\.js"/,'src="./boot-'+version+'.js"');
await writeFile('dist/index.html',html);
const recovery=(await readFile('scripts/refresh_app_template.html','utf8')).replaceAll('__APP_VERSION__',version);
await writeFile('dist/refresh-app.html',recovery);
console.log('Bundled release-specific browser scripts and cache-recovery page for '+version);
