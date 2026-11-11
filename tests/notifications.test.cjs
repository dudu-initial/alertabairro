const test = require('node:test');
const assert = require('node:assert/strict');
const {filter,cards} = require('../frontend/notifications.js');
const unread = {id:11,occurrence_id:5,is_read:false,title:'Alerta no bairro',body:'Evite a via.',neighborhood:'Vila Mariana',risk_level:'Alto',confidence_score:78,source_label:'Comunidade',created_at:'2026-11-10'};
const read = {...unread,id:12,is_read:true};
const format = ()=>'10 nov., 10:00';

test('filters preserve order and leave original notification data unchanged',()=>{
  const items=Object.freeze([Object.freeze(unread),Object.freeze(read)]);
  assert.deepEqual(filter(items,'all'),[unread,read]);
  assert.deepEqual(filter(items,'unread'),[unread]);
  assert.deepEqual(filter(items,'read'),[read]);
});
test('unread cards provide independent open and read controls with occurrence context',()=>{
  const html=cards([unread],'all',format);
  for(const text of ['data-notice="11"','data-notice-read="11"','Vila Mariana','Risco Alto','Confiança 78%','Fonte: Comunidade','Não lida'])assert.ok(html.includes(text),text);
});
test('read cards keep occurrence access without redundant mark-read button',()=>{
  const html=cards([read],'read',format);
  assert.ok(html.includes('data-notice="12"'));
  assert.ok(!html.includes('data-notice-read='));
  assert.ok(!html.includes('notification-new'));
});
test('empty states describe the selected filter',()=>{
  assert.match(cards([read],'unread',format),/Você está em dia/);
  assert.match(cards([unread],'read',format),/Nenhuma notificação lida/);
  assert.match(cards([],'all',format),/Nenhuma notificação ainda/);
});
test('notification text and attribute values are escaped before rendering',()=>{
  const html=cards([{...unread,id:'"><img src=x>',title:'<script>alert(1)</script>',body:'<img onerror=evil>',source_label:'<svg onload=evil>'}],'all',format);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<svg'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('data-notice="&quot;&gt;&lt;img src=x&gt;"'));
});
