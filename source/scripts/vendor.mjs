import { build } from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist/vendor',{recursive:true});
await build({entryPoints:['scripts/vendor-entry.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/vendor/esptool.bundle.mjs',minify:true,legalComments:'eof'});
for(const [src,name] of [['esptool-js/LICENSE','esptool-js-LICENSE'],['crypto-js/LICENSE','crypto-js-LICENSE'],['pako/LICENSE','pako-LICENSE'],['atob-lite/LICENSE.md','atob-lite-LICENSE']])await copyFile('node_modules/'+src,'dist/vendor/'+name);
