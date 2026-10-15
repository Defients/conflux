/* eslint-disable */
// Read-only source inventory; generated audit artifacts are written under audit/.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const skipped = new Set(['node_modules', '.git', 'dist', 'audit', '.netlify', '.firebase', 'migrated_prompt_history']);
const files = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
    if (ent.isDirectory() && !skipped.has(ent.name)) walk(path.join(dir,ent.name));
    else if (ent.isFile() && !ent.name.startsWith('.env') && !ent.name.endsWith('.zip')) files.push(path.relative(root,path.join(dir,ent.name)).replaceAll('\\','/'));
  }
}
walk(root);
const records = files.sort().map(file => {
  const text = fs.readFileSync(path.join(root,file),'utf8');
  const source = ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
  const imports = [], symbols = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) imports.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text);
    if ((ts.isFunctionDeclaration(node)||ts.isClassDeclaration(node)||ts.isInterfaceDeclaration(node)||ts.isEnumDeclaration(node)||ts.isTypeAliasDeclaration(node)) && node.name) symbols.push({name:node.name.text,line:source.getLineAndCharacterOfPosition(node.getStart()).line+1});
    if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name) && node.parent?.parent?.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)) symbols.push({name:node.name.text,line:source.getLineAndCharacterOfPosition(node.getStart()).line+1});
    ts.forEachChild(node,visit);
  }
  if (/\.[jt]sx?$/.test(file)) visit(source);
  return {file,lines:text.split('\n').length,bytes:Buffer.byteLength(text),imports,symbols,
    timers:(text.match(/setTimeout|setInterval|requestAnimationFrame/g)||[]).length,
    random:(text.match(/Math\.random/g)||[]).length,
    pauseRefs:(text.match(/isPaused/g)||[]).length,
    feedback:text.includes('useEventFeedback'),
    test:/\.test\./.test(file)};
});
function resolve(from,dep) {
  if (!dep.startsWith('.')) return null;
  const base=path.posix.normalize(path.posix.join(path.posix.dirname(from),dep));
  return [base,base+'.ts',base+'.tsx',base+'.css',base+'/index.ts'].find(p=>files.includes(p));
}
const reached = new Set();
function reach(file) {
  if(reached.has(file))return;
  reached.add(file);
  for(const dep of records.find(r=>r.file===file)?.imports||[]) {const target=resolve(file,dep);if(target)reach(target);}
}
reach('index.tsx');reach('server/src/index.ts');
for(const r of records) r.runtimeImportReachable=reached.has(r.file);
fs.writeFileSync(path.join(__dirname,'file-index.json'),JSON.stringify(records,null,2));
const code = ts.transpileModule(fs.readFileSync(path.join(root,'events/eventRegistry.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const context={exports:{},require:(name)=>{if(name==='react')return {lazy:()=>function Lazy(){}};throw Error(name);}};
vm.runInNewContext(code,context);
const events = context.exports.eventRegistry;
const {STAR_COMPUTERS,EVENT_DESCRIPTORS}=require('../server/dist/server/src/eventDescriptors.js');
const mismatches=[];
const index=events.map(e=>{
  const block=fs.readFileSync(path.join(root,'events/eventRegistry.ts'),'utf8').split("id: '"+e.id+"'")[1];
  const component=block.match(/Component:\s*(\w+)/)?.[1];
  const rec=records.find(r=>r.file===`events/${component}.tsx`);
  const scorer=STAR_COMPUTERS[e.id];
  for(const pm of [0,1,2,3,4,5,7,8,10,12,20,40,60,80,100,180,300,1000,10000,99999]) {
    for(const sm of [undefined,0,1,3,10,100,1000,12000,20000]) {
      const client=e.getStars({primaryMetric:pm,secondaryMetric:sm});
      const server=scorer?.(pm,sm);
      if(client!==server)mismatches.push({event:e.id,pm,sm,client,server});
    }
  }
  return {id:e.id,name:e.displayName,purpose:e.instructions,component,dimension:e.performanceDimension,
    duration:[1,2,3].map(d=>e.durationSec(d,false)),accessibleDuration:[1,2,3].map(d=>e.durationSec(d,true)),
    stub:!!e.isStub,serverDescriptor:EVENT_DESCRIPTORS.some(s=>s.id===e.id),source:rec?.file,
    pauseRefs:rec?.pauseRefs,randomCalls:rec?.random,feedback:rec?.feedback,lines:rec?.lines};
});
fs.writeFileSync(path.join(__dirname,'event-index.json'),JSON.stringify(index,null,2));
fs.writeFileSync(path.join(__dirname,'scoring-parity.json'),JSON.stringify({samples:events.length*22*9,mismatches},null,2));
console.log(JSON.stringify({files:records.length,sourceFiles:records.filter(r=>/\.[jt]sx?$/.test(r.file)).length,events:index.length,scoringMismatches:mismatches.length,
  topFiles:records.filter(r=>/\.[jt]sx?$/.test(r.file)).sort((a,b)=>b.lines-a.lines).slice(0,8).map(r=>({file:r.file,lines:r.lines})),
  unreferenced:records.filter(r=>/\.[jt]sx?$/.test(r.file)&&!r.test&&!r.runtimeImportReachable).map(r=>r.file),events:index},null,2));
