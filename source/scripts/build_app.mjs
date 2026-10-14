import {build} from 'esbuild';
// A classic script works on static hosts that do not serve .mjs MIME types.
await build({entryPoints:['dist/app.mjs'],bundle:true,format:'iife',platform:'browser',target:'es2022',outfile:'dist/app.js',minify:true,legalComments:'eof'});
console.log('Bundled browser app and local flasher into dist/app.js');
