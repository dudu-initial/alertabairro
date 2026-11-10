// Unit tests with fake media/worker objects. No browser or camera is launched.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const rules=require('../frontend/vision-rules.js');
function harness(getUserMedia,initialType='',winner=0){
  const elements=new Map();let createdWorkers=0,terminatedWorkers=0,nextFrame=null;
  function element(id){
    if(!elements.has(id))elements.set(id,{hidden:false,value:'',textContent:'',files:[],width:640,height:480,videoWidth:640,videoHeight:480,listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},removeAttribute(){},focus(){},play:async()=>{},getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(640*480*4)})})});
    return elements.get(id);
  }
  class FakeWorker {
    constructor(){createdWorkers++;}
    postMessage(data){queueMicrotask(()=>this.onmessage({data:data.type==='load'?{id:data.id,type:'ready'}:{id:data.id,type:'result',predictions:rules.CANDIDATES.map(([label],i)=>({label,score:i===winner?.9:.1/(rules.CANDIDATES.length-1)}))}}));}
    terminate(){terminatedWorkers++;}
  }
  const context={document:{getElementById:element,addEventListener(){}},window:{addEventListener(){}},navigator:{mediaDevices:{getUserMedia}},isSecureContext:true,Worker:FakeWorker,AlertaVisionRules:rules,setTimeout:(fn,delay)=>{if(delay===3000){nextFrame=fn;return -1;}return setTimeout(fn,delay);},clearTimeout:(id)=>{if(id===-1)nextFrame=null;else clearTimeout(id);},Uint8ClampedArray,URL:{createObjectURL:()=> 'blob:unit-test',revokeObjectURL(){}},Image:class{width=640;height=480;decode(){return Promise.resolve();}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../frontend/vision.js'),'utf8'),context);
  const report={};element('report-type').value=initialType;context.AlertaVision.mount(report);
  return {app:context.AlertaVision,element,report,advance:()=>nextFrame?.(),workers:()=>({createdWorkers,terminatedWorkers})};
}
test('Photo analysis fills the type automatically; only Continue confirms the AI metadata',async()=>{
  const h=harness();h.element('vision-file').files=[{type:'image/jpeg',size:100}];
  await h.element('vision-file').onchange();
  assert.equal(h.report.type,'Alagamento');
  assert.equal(h.element('vision-accept').hidden,true);
  assert.equal(h.report.ai_assistance,undefined);
  h.app.review(h.report,h.element('report-type').value);
  assert.equal(h.report.ai_assistance.human_confirmed,true);
  assert.ok(h.report.description.length>=20);
  assert.equal(h.workers().terminatedWorkers,1);
  h.element('report-type').value='Outro';h.element('report-type').listeners.change();
  assert.equal(h.report.ai_assistance,undefined);h.app.destroy();
});
test('Denied camera permission keeps manual registration available',async()=>{
  const h=harness(async()=>{const e=new Error();e.name='NotAllowedError';throw e;});
  await h.element('vision-start').onclick();
  assert.match(h.element('vision-status').textContent,/não foi autorizada/);
  assert.equal(h.element('vision-start').disabled,false);assert.equal(h.workers().createdWorkers,0);h.app.destroy();
});
test('Leaving the page stops camera granted after the page was disposed',async()=>{
  let resolve,stopped=0;const h=harness(()=>new Promise(r=>resolve=r));
  const opening=h.element('vision-start').onclick();h.app.destroy();
  resolve({getTracks:()=>[{stop(){stopped++;}}]});await opening;
  assert.equal(stopped,1);assert.equal(h.workers().createdWorkers,0);
});
test('Oversized or non-image uploads never start inference',async()=>{
  for(const file of [{type:'application/pdf',size:100},{type:'image/jpeg',size:13*1024*1024}]){
    const h=harness();h.element('vision-file').files=[file];await h.element('vision-file').onchange();
    assert.equal(h.workers().createdWorkers,0);assert.match(h.element('vision-status').textContent,/12 MB/);h.app.destroy();
  }
});
test('Live suggestions require two matching frames and disposal releases the active stream',async()=>{
  let stopped=0;const h=harness(async()=>({getTracks:()=>[{stop(){stopped++;}}]}));
  await h.element('vision-start').onclick();
  assert.equal(h.element('vision-accept').hidden,true);
  assert.equal(h.report.type,undefined);
  await h.advance();
  assert.equal(h.element('vision-accept').hidden,true);
  assert.equal(h.report.type,'Alagamento');
  assert.equal(h.report.ai_assistance,undefined);
  h.app.destroy();assert.equal(stopped,1);assert.equal(h.workers().terminatedWorkers,1);
});
test('House fire classification automatically becomes Incêndio, while manual choices remain editable',async()=>{
  const h=harness(undefined,'',1);
  h.element('vision-file').files=[{type:'image/jpeg',size:100}];await h.element('vision-file').onchange();
  assert.equal(h.element('report-type').value,'Incêndio');assert.match(h.report.description,/chamas/);
  assert.match(h.element('vision-result-title').textContent,/Classificação da IA: Incêndio/);
  h.element('report-type').value='Outro';h.element('report-type').listeners.change();h.app.review(h.report,'Outro');
  assert.equal(h.report.ai_assistance,undefined);h.app.destroy();
  const manual=harness(undefined,'Queda de árvore',1);
  manual.element('report-description').value='Descrição que eu já escrevi e quero preservar.';
  manual.element('vision-file').files=[{type:'image/jpeg',size:100}];await manual.element('vision-file').onchange();
  assert.equal(manual.element('report-type').value,'Queda de árvore');
  assert.equal(manual.element('vision-accept').hidden,false);
  manual.element('vision-accept').onclick();assert.equal(manual.element('report-type').value,'Incêndio');
  assert.equal(manual.report.description,'Descrição que eu já escrevi e quero preservar.');manual.app.destroy();
});
