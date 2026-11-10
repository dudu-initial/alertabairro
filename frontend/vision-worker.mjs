import {pipeline,env,RawImage} from './vendor/transformers/transformers.min.js';
import './vision-rules.js';

const {MODEL,REVISION,CANDIDATES}=globalThis.AlertaVisionRules;
env.allowLocalModels=false;
env.backends.onnx.wasm.wasmPaths=new URL('./vendor/transformers/',import.meta.url).href;
env.backends.onnx.wasm.numThreads=1; // Works without cross-origin isolation, including mobile browsers.
env.backends.onnx.wasm.proxy=false;
let classifier=null, busy=false;

self.onmessage=async ({data})=>{
  if(busy)return;
  busy=true;
  try {
    if(!classifier){
      classifier=await pipeline('zero-shot-image-classification',MODEL,{
        revision:REVISION,device:'wasm',dtype:'q8',
        progress_callback:progress=>{
          if(progress.status==='progress')self.postMessage({type:'progress',id:data.id,file:progress.file,progress:Math.round(progress.progress)});
        }
      });
    }
    if(data.type==='load'){self.postMessage({type:'ready',id:data.id});return;}
    if(data.type!=='analyze'||!data.pixels||data.width<1||data.height<1||data.width>640||data.height>640)throw new Error('Imagem inválida.');
    const image=new RawImage(new Uint8ClampedArray(data.pixels),data.width,data.height,4);
    const predictions=await classifier(image,CANDIDATES.map(([label])=>label),{hypothesis_template:'A photo of {}.'});
    self.postMessage({type:'result',id:data.id,predictions});
  }catch(error){
    self.postMessage({type:'error',id:data.id,message:'Não foi possível analisar a imagem. Verifique a conexão e a memória disponível, ou continue pelo formulário.'});
  }finally{busy=false;}
};
