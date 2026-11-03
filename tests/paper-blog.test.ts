import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mountPaperBlog } from '../public/paper-blog.js';

test('normal blog does not mount world DOM, resources, state, or audio',()=>{
 globalThis.location={search:''};try{mountPaperBlog()();}finally{delete globalThis.location;}
});
test('retired build-note and investigation routes stay redirected',()=>{
 for(const file of ['src/pages/project-34.astro','src/pages/p34-record.astro']){
  const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.match(source,/paper=0617/);assert.doesNotMatch(source,/data-paper-proof|decay-text|paper-note-card/);
 }
});
