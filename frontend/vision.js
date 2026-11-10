/* Camera assistant. Frames stay in memory, inside the device's worker. */
(() => {
  'use strict';
  let active=null;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function panel(report) {
    const detected=report.vision_pending||report.ai_assistance;
    return `<section class="vision-panel" aria-labelledby="vision-heading"><div class="vision-heading"><span class="vision-symbol" aria-hidden="true">◎</span><div><h3 id="vision-heading">Mostre o que aconteceu</h3><p>Aponte a câmera. A IA identifica e preenche o tipo.</p></div><span class="vision-label">IA experimental</span></div><p class="vision-intro">Fogo em uma casa → Incêndio. Água cobrindo a rua → Alagamento. A classificação aparece automaticamente; revise antes de enviar.</p><div class="vision-actions"><button type="button" class="btn btn-primary" id="vision-start">Abrir câmera com IA</button><label class="btn btn-secondary vision-upload" for="vision-file">Tirar ou escolher foto<input id="vision-file" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"></label></div><p class="explain">A primeira análise baixa cerca de 180 MB. Prefira Wi-Fi. A imagem é analisada no aparelho e não é enviada ao servidor.</p><div id="vision-stage" class="vision-stage" hidden><video id="vision-video" autoplay muted playsinline aria-label="Prévia da câmera traseira"></video><canvas id="vision-canvas" hidden aria-label="Foto selecionada para análise"></canvas><span class="vision-frame" aria-hidden="true"></span><span class="vision-stage-label">Mantenha distância do perigo</span></div><div class="vision-controls"><button type="button" class="btn btn-secondary" id="vision-stop" hidden>Parar câmera e análise</button><button type="button" class="btn btn-quiet" id="vision-clear" hidden>Remover imagem</button></div><p id="vision-status" class="vision-status" role="status">A detecção preenche o tipo e uma descrição inicial. Você também pode preencher manualmente.</p><progress id="vision-progress" max="100" hidden aria-label="Carregamento da inteligência artificial"></progress><div id="vision-result" class="vision-result" hidden><h4 id="vision-result-title"></h4><p id="vision-result-detail"></p><button type="button" class="btn btn-primary" id="vision-accept" hidden>Aplicar este resultado</button></div><p id="vision-applied" class="vision-applied" ${detected?'':'hidden'}>${detected?`Tipo identificado: ${esc(detected.suggested_type)}. Revise o relato antes de continuar.`:''}</p><details class="details"><summary>O que a IA identifica?</summary><p>Ela compara a cena com exemplos de alagamento, fogo, deslizamento e árvore caída. Pode errar ou não identificar. Não detecta falta de energia nem avalia se um local é seguro.</p><p>A sugestão não confirma a ocorrência e não emite alertas. Um agente continua responsável pela validação.</p></details></section>`;
  }
  function destroy(){active?.dispose();active=null;}
  function mount(report) {
    destroy();
    const byId=id=>document.getElementById(id);
    const video=byId('vision-video'),canvas=byId('vision-canvas'),status=byId('vision-status');
    const start=byId('vision-start'),file=byId('vision-file'),stopButton=byId('vision-stop'),clear=byId('vision-clear'),progress=byId('vision-progress');
    const result=byId('vision-result'),accept=byId('vision-accept');
    let stream=null,worker=null,timer=null,disposed=false,epoch=0,seq=0,ready=false,proposed=null,previousType=null,repeats=0;
    const pending=new Map();
    let manualType=!!byId('report-type').value&&!report.vision_pending;
    function controls(working){start.disabled=working;file.disabled=working;stopButton.hidden=!working;clear.hidden=!working&&byId('vision-stage').hidden;}
    function stop(message='Análise pausada. Você pode abrir a câmera novamente ou continuar pelo formulário.') {
      epoch++;clearTimeout(timer);stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;
      worker?.terminate();worker=null;ready=false;
      for(const job of pending.values()){clearTimeout(job.timer);job.reject(new Error('cancelled'));}pending.clear();
      controls(false);progress.hidden=true;
      if(!disposed)status.textContent=message;
    }
    function resetResult(){proposed=null;previousType=null;repeats=0;result.hidden=true;accept.hidden=true;}
    function reset(){stop('Imagem removida. Você pode continuar pelo formulário.');resetResult();canvas.width=1;canvas.height=1;byId('vision-stage').hidden=true;clear.hidden=true;file.value='';}
    function send(type,body={}){
      const id=++seq;
      return new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(new Error('A análise demorou demais neste aparelho. Tente uma foto ou continue pelo formulário.'));stop('A análise foi interrompida por tempo limite.');}},type==='load'?180000:45000);
        pending.set(id,{resolve,reject,timer:timeout});
        worker.postMessage({type,id,...body});
      });
    }
    async function load(){
      if(ready)return;
      if(!globalThis.Worker)throw new Error('Este navegador não oferece análise local. Continue pelo formulário.');
      status.textContent='Preparando a IA no aparelho. O primeiro carregamento pode levar alguns minutos…';progress.hidden=false;progress.removeAttribute('value');
      worker=new Worker('/vision-worker.mjs?v=vision-6',{type:'module'});
      worker.onmessage=({data})=>{
        const job=pending.get(data.id);if(!job)return;
        if(data.type==='progress'){progress.value=data.progress;status.textContent=`Baixando arquivo da IA: ${data.progress}%. A foto permanece no aparelho.`;return;}
        clearTimeout(job.timer);pending.delete(data.id);
        if(data.type==='error')job.reject(new Error(data.message));else job.resolve(data);
      };
      worker.onerror=()=>{
        for(const job of pending.values()){clearTimeout(job.timer);job.reject(new Error('A IA não carregou neste navegador. Tente atualizar a página ou preencha o relato manualmente.'));}pending.clear();
      };
      await send('load');ready=true;progress.hidden=true;
    }
    function capture(source,width,height){
      if(!width||!height)throw new Error('A imagem ainda não está pronta. Tente novamente.');
      const scale=Math.min(1,640/Math.max(width,height));canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
      const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(source,0,0,canvas.width,canvas.height);
      return {pixels:context.getImageData(0,0,canvas.width,canvas.height).data.buffer,width:canvas.width,height:canvas.height};
    }
    function show(predictions,live){
      const decision=AlertaVisionRules.decide(predictions);
      result.hidden=false;
      if(!decision.suggested_type){
        resetResult();result.hidden=false;
        byId('vision-result-title').textContent='Não consegui identificar com clareza';
        byId('vision-result-detail').textContent='Isso não significa ausência de risco. Tente outro enquadramento ou descreva o que você viu.';
        return;
      }
      repeats=previousType===decision.suggested_type?repeats+1:1;previousType=decision.suggested_type;
      if(live&&repeats<2){proposed=null;accept.hidden=true;byId('vision-result-title').textContent='Analisando mais um instante…';byId('vision-result-detail').textContent='Mantenha o enquadramento para comparar duas imagens.';return;}
      proposed=decision;
      byId('vision-result-title').textContent=`Classificação da IA: ${decision.suggested_type}`;
      byId('vision-result-detail').textContent=`Compatibilidade visual: ${Math.round(decision.score*100)}%. A classificação é automática e pode errar. Revise o relato antes de continuar.`;
      if(!manualType)fillResult(decision);
      else {accept.hidden=false;status.textContent='A IA identificou uma categoria. Mantivemos o tipo que você escolheu; aplique o resultado se desejar.';}
    }
    async function analyze(source,width,height,live,current){
      const image=capture(source,width,height);
      proposed=null;accept.hidden=true;
      status.textContent='Analisando a imagem no aparelho…';
      const data=await send('analyze',image);
      if(disposed||current!==epoch)return;
      show(data.predictions,live);if(current===epoch)status.textContent=live?'Câmera ativa. A classificação é atualizada a cada análise.':'Análise concluída. Revise o resultado e o formulário.';
    }
    function failure(error,current){if(disposed||current!==epoch||error.message==='cancelled')return;stop(error.message);}
    start.onclick=async()=>{
      stop('Abrindo câmera…');resetResult();const current=epoch;
      controls(true);canvas.hidden=true;video.hidden=false;
      try{
        if(!globalThis.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('A câmera ao vivo precisa de HTTPS ou localhost. Use Tirar ou escolher foto, ou continue pelo formulário.');
        const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:640},height:{ideal:480}},audio:false});
        if(disposed||current!==epoch){acquired.getTracks().forEach(t=>t.stop());return;}
        stream=acquired;video.srcObject=stream;byId('vision-stage').hidden=false;clear.hidden=false;
        await video.play();await load();
        if(disposed||current!==epoch)return;
        const next=async()=>{
          if(disposed||current!==epoch||!stream)return;
          try{await analyze(video,video.videoWidth,video.videoHeight,true,current);if(current===epoch)timer=setTimeout(next,3000);}catch(error){failure(error,current);}
        };
        await next();
      }catch(error){
        if(error.name==='NotAllowedError')error=new Error('A câmera não foi autorizada. Use uma foto ou permita o acesso nas configurações do navegador.');
        else if(error.name==='NotFoundError'||error.name==='NotReadableError')error=new Error('Câmera indisponível ou em uso. Tente escolher uma foto.');
        failure(error,current);
      }
    };
    file.onchange=async()=>{
      const imageFile=file.files?.[0];if(!imageFile)return;
      stop('Preparando foto…');resetResult();const current=epoch;
      if(!['image/jpeg','image/png','image/webp'].includes(imageFile.type)||imageFile.size>12*1024*1024){status.textContent='Escolha uma foto JPG, PNG ou WebP com até 12 MB.';file.value='';return;}
      controls(true);let objectUrl=null;
      try{
        objectUrl=URL.createObjectURL(imageFile);const image=new Image();image.src=objectUrl;await image.decode();
        if(disposed||current!==epoch)return;
        if(image.width*image.height>40000000)throw new Error('A foto é muito grande. Escolha uma imagem menor.');
        capture(image,image.width,image.height);canvas.hidden=false;video.hidden=true;byId('vision-stage').hidden=false;clear.hidden=false;
        await load();if(disposed||current!==epoch)return;
        await analyze(image,image.width,image.height,false,current);
        if(current===epoch){controls(false);stopButton.hidden=false;}
      }catch(error){failure(error,current);}finally{if(objectUrl)URL.revokeObjectURL(objectUrl);file.value='';}
    };
    stopButton.onclick=()=>stop();clear.onclick=()=>reset();
    function fillResult(chosen){
      stop(`IA identificou: ${chosen.suggested_type}. O tipo foi preenchido automaticamente. Revise o relato e toque em Continuar.`);
      const type=byId('report-type'),description=byId('report-description');
      type.value=chosen.suggested_type;report.type=chosen.suggested_type;
      delete report.ai_assistance;
      report.vision_pending=chosen;
      if(!description.value.trim()||description.value===report.vision_auto_description){
        description.value=AlertaVisionRules.draft(chosen);report.vision_auto_description=description.value;
      }
      report.description=description.value;
      const applied=byId('vision-applied');applied.hidden=false;applied.textContent=`Tipo identificado: ${chosen.suggested_type}. Revise o preenchimento automático antes de tocar em Continuar.`;
      video.hidden=true;canvas.hidden=false;
      accept.hidden=true;proposed=null;
    }
    accept.onclick=()=>{
      if(!proposed)return;
      manualType=false;fillResult(proposed);byId('report-type').focus();
    };
    byId('report-type').addEventListener('change',()=>{manualType=!!byId('report-type').value;delete report.ai_assistance;delete report.vision_pending;byId('vision-applied').hidden=true;});
    active={stop,dispose(){disposed=true;stop();canvas.width=1;canvas.height=1;}};
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)active?.stop('Análise pausada ao sair da tela. Toque em Abrir câmera para retomar.');});
  window.addEventListener('pagehide',()=>active?.stop());
  function detail(value){
    if(!value)return '';
    return `<section class="card"><h2>Relato com auxílio de IA</h2><p>O morador confirmou a sugestão <strong>${esc(value.suggested_type)}</strong>.</p><p>Compatibilidade visual informada pelo aparelho: <strong>${Math.round(Number(value.score)*100)}%</strong>.</p><p class="explain">Modelo CLIP, análise experimental. Essa pontuação não foi verificada pelo servidor e não aumenta a confiança da ocorrência. A imagem não foi armazenada.</p></section>`;
  }
  function review(report,type){
    if(report.vision_pending?.suggested_type===type)report.ai_assistance=AlertaVisionRules.assessment(report.vision_pending);
    delete report.vision_pending;
  }
  globalThis.AlertaVision={panel,mount,destroy,detail,review};
})();
