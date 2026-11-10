/* Shared, testable decision rules. Similarity is not verified incident confidence. */
(() => {
  const MODEL='Xenova/clip-vit-base-patch32';
  const REVISION='6b7c523703ae26e39be4b03774966f8571c7f523';
  const CANDIDATES=[
    ['a flooded street with water covering the road','Alagamento'],
    ['a fire with visible flames and smoke','Incêndio'],
    ['a landslide with soil and rocks blocking a road','Deslizamento'],
    ['a fallen tree blocking a street','Queda de árvore'],
    ['an ordinary dry street with cars and buildings',null],
    ['a room inside a house or office',null],
    ['a portrait of a person or a close-up of an everyday object',null],
    ['an animal or natural scenery without a visible disaster',null],
    ['a blurry dark or unrecognizable image',null]
  ];
  function decide(predictions) {
    const invalid={suggested_type:null,score:null,margin:null,reason:'inconclusive'};
    if(!Array.isArray(predictions)||predictions.length!==CANDIDATES.length)return invalid;
    const labels=new Set(predictions.map(p=>p.label));
    if(labels.size!==CANDIDATES.length||predictions.some(p=>!CANDIDATES.some(([l])=>p.label===l)||!Number.isFinite(p.score)||p.score<0||p.score>1))return invalid;
    const sorted=[...predictions].sort((a,b)=>b.score-a.score);
    const winner=sorted[0], margin=winner.score-sorted[1].score;
    const type=CANDIDATES.find(([label])=>label===winner.label)[1];
    if(!type||winner.score<0.60||margin<0.15)return {...invalid,reason:!type?'unsupported':'uncertain'};
    return {suggested_type:type,score:winner.score,margin,model:MODEL,revision:REVISION,reason:'suggestion'};
  }
  function assessment(result) {
    if(!result?.suggested_type)return null;
    return {model:MODEL,revision:REVISION,suggested_type:result.suggested_type,score:result.score,margin:result.margin,human_confirmed:true};
  }
  globalThis.AlertaVisionRules={MODEL,REVISION,CANDIDATES,decide,assessment};
  if(typeof module!=='undefined')module.exports=globalThis.AlertaVisionRules;
})();
