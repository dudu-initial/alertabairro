const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../frontend/app.js'),'utf8');
function setup(fetch) {
  const events={}, timers=[];
  const bell={innerHTML:'',setAttribute(name,value){this[name]=value;}};
  const root={innerHTML:'',querySelector(selector){return selector==='[data-action="notices"]'?bell:null;}};
  const document={hidden:false,getElementById(id){return id==='app'?root:{append(){}};},addEventListener(type,handler){events[type]=handler;},createElement(){return {remove(){}};}};
  const context={document,fetch,localStorage:{getItem(){return '';},removeItem(){}},location:{hash:'#inicio'},window:{addEventListener(){}},setInterval(fn,ms){timers.push({fn,ms});},setTimeout(){},Intl,AlertaVision:{destroy(){}},AlertaGeo:{destroy(){}},AlertaNotifications:require('../frontend/notifications.js')};
  vm.createContext(context);
  assert.ok(source.includes('  init();'));
  vm.runInContext(source.replace('  init();','  globalThis.testApp={S,syncNotices,clearSession,markNoticesRead};'),context);
  Object.assign(context.testApp.S,{user:{id:1,name:'Morador'},token:'first'});
  return {...context.testApp,events,timers,document,bell};
}
const response=(data,status=200)=>({ok:status===200,status,json:async()=>data});
const deferred=()=>{let resolve;return {promise:new Promise(r=>{resolve=r;}),resolve(value){resolve(value);}};};
test('late notification responses cannot overwrite a different signed-in account',async()=>{
  const request=deferred(), app=setup(()=>request.promise);
  const pending=app.syncNotices();
  app.S.token='second';app.S.user={id:2};app.S.notices=[{id:99}];
  request.resolve(response({items:[{id:1}],unread:1}));
  assert.equal(await pending,false);
  assert.equal(app.S.notices[0].id,99);
});
test('late unauthorized response cannot log out a newly signed-in account',async()=>{
  const request=deferred(), app=setup(()=>request.promise);
  const pending=app.syncNotices();
  app.S.token='second';app.S.user={id:2};
  request.resolve(response({},401));
  await pending;
  assert.equal(app.S.token,'second');
  assert.equal(app.S.user.id,2);
});
test('failed refresh preserves cached notices and exposes update failure',async()=>{
  const app=setup(async()=>{throw new Error('offline');});
  app.S.notices=[{id:4}];app.S.unread=1;app.S.noticesUpdated='10:00:00';
  assert.equal(await app.syncNotices(),false);
  assert.equal(app.S.notices[0].id,4);
  assert.match(app.S.noticesError,/Não foi possível atualizar/);
  assert.equal(app.S.noticesUpdated,'10:00:00');
});
test('successful refresh updates accessible unread count and logout clears private cache',async()=>{
  const app=setup(async()=>response({items:[{id:4,is_read:false}],unread:1}));
  assert.equal(await app.syncNotices(),true);
  assert.equal(app.bell['aria-label'],'Notificações, 1 não lidas');
  assert.match(app.bell.innerHTML,/notice-count/);
  assert.ok(app.S.noticesUpdated);
  app.clearSession();
  assert.equal(app.S.notices.length,0);
  assert.equal(app.S.unread,0);
  assert.equal(app.S.token,'');
});
test('poll runs every 30 seconds only for a visible signed-in session and resumes on visibility',async()=>{
  let calls=0;
  const app=setup(async()=>{calls++;return response({items:[],unread:0});});
  assert.equal(app.timers.length,1);assert.equal(app.timers[0].ms,30000);
  app.document.hidden=true;app.timers[0].fn();assert.equal(calls,0);
  app.document.hidden=false;app.events.visibilitychange();assert.equal(calls,1);
  app.timers[0].fn();assert.equal(calls,2);
  app.S.user=null;app.timers[0].fn();assert.equal(calls,2);
});
