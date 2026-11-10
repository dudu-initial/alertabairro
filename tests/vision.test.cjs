const test=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../frontend/vision-rules.js');
const scores=(winner=0,score=.9,runner=.05)=>rules.CANDIDATES.map(([label],i)=>({label,score:i===winner?score:i===(winner+1)%9?runner:(1-score-runner)/7}));

test('Strong supported scene produces a suggestion, never an alert',()=>{
  const result=rules.decide(scores());
  assert.equal(result.suggested_type,'Alagamento');
  assert.equal(result.reason,'suggestion');
  assert.equal(result.status,undefined);
  assert.equal(rules.assessment(result).human_confirmed,true);
});
test('Low score, small margin and unsupported scenes abstain',()=>{
  for(const prediction of [scores(0,.45,.4),scores(0,.6,.5),scores(4,.9,.05),scores(8,.9,.05)])assert.equal(rules.decide(prediction).suggested_type,null);
  assert.equal(rules.assessment(rules.decide(scores(4))),null);
});
test('Malformed and unknown predictions cannot become a suggestion',()=>{
  for(const value of [null,[],[{label:'fire',score:1}],scores().map(p=>({...p,score:NaN})),scores().map(p=>({...p,label:'unknown'}))])assert.equal(rules.decide(value).suggested_type,null);
});
test('Sorting does not mutate model output and missing classes cannot force a hazard',()=>{
  const input=scores(2).reverse(),copy=JSON.stringify(input);
  assert.equal(rules.decide(input).suggested_type,'Deslizamento');assert.equal(JSON.stringify(input),copy);
  assert.equal(rules.decide(input.slice(0,4)).suggested_type,null);
});
