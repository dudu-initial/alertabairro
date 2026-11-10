// Optional real-model smoke test: downloads model weights and public images.
// These examples test execution; they are not an accuracy benchmark.
import {pipeline,env} from '@huggingface/transformers';
import {mkdir,writeFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import '../frontend/vision-rules.js';
const {MODEL,REVISION,CANDIDATES,decide}=globalThis.AlertaVisionRules;
env.cacheDir=fileURLToPath(new URL('../.cache/models/',import.meta.url));
const imageDir=new URL('../.cache/vision-images/',import.meta.url);
await mkdir(imageDir,{recursive:true});
const cases=[
  {name:'house-fire',url:'https://upload.wikimedia.org/wikipedia/commons/5/53/House_fire_using_gasoline.jpg',expected:'Incêndio'},
  {name:'gas-stove',url:'https://upload.wikimedia.org/wikipedia/commons/3/3b/Gas_stove_flame.jpg',expected:null},
  {name:'flood',url:'https://upload.wikimedia.org/wikipedia/commons/f/f8/Chuva_Rio.jpg',expected:'Alagamento'},
  {name:'tiger',url:'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/tiger.jpg',expected:null}
];
console.log('Carregando CLIP q8 (primeira execução baixa os pesos)…');
const classifier=await pipeline('zero-shot-image-classification',MODEL,{revision:REVISION,device:'cpu',dtype:'q8'});
try {
  for(const sample of cases){
    const file=new URL(sample.name+'.jpg',imageDir);
    try{await access(file);}catch{
      const response=await fetch(sample.url,{headers:{'User-Agent':'AlertaBairro/1.1 (https://github.com/dudu-initial/alertabairro; model smoke test)'}});
      if(!response.ok)throw new Error(`Imagem indisponível: ${response.status}`);
      await writeFile(file,new Uint8Array(await response.arrayBuffer()));
    }
    const start=performance.now();
    const predictions=await classifier(fileURLToPath(file),CANDIDATES.map(([label])=>label),{hypothesis_template:'A photo of {}.'});
    const decision=decide(predictions);
    console.log(JSON.stringify({sample:sample.name,milliseconds:Math.round(performance.now()-start),decision,top:predictions.slice(0,3)},null,2));
    assert.equal(decision.suggested_type,sample.expected);
  }
}finally{await classifier.dispose();}
