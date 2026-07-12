import { access, mkdir, cp, rm } from 'node:fs/promises';
const root=new URL('../',import.meta.url); const dist=new URL('../dist/',import.meta.url);
await rm(dist,{recursive:true,force:true}); await mkdir(dist,{recursive:true});
for(const item of ['index.html','styles.css','app.js','manifest.webmanifest','sw.js','icons','lib']){await access(new URL(item,root));await cp(new URL(item,root),new URL(item,dist),{recursive:true});}
console.log('Production static bundle created in dist/.');
