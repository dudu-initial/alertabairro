const test = require('node:test');
const assert = require('node:assert/strict');
const geo = require('../frontend/geo.js');

test('Lookup normalizes accents, spaces, abbreviations and aliases without guessing', () => {
  const places = [{name:'Vila Mariana'},{name:'Jardim Ângela'},{name:'Artur Alvim'}];
  assert.equal(geo.lookup(places,'  vila   mariana ').name, 'Vila Mariana');
  assert.equal(geo.lookup(places,'jd. angela').name, 'Jardim Ângela');
  assert.equal(geo.lookup(places,'Arthur Alvim').name, 'Artur Alvim');
  assert.equal(geo.lookup(places,'vila mar'), undefined);
});

test('Missing coordinates never become a marker at zero or a neighborhood center', () => {
  for (const point of [{},{latitude:null,longitude:null},{latitude:'',longitude:''},{latitude:-23.5},{latitude:NaN,longitude:-46.6}]) assert.equal(geo.hasPoint(point),false);
  assert.equal(geo.hasPoint({latitude:-23.59,longitude:-46.63}),true);
  assert.equal(geo.inRegion(0,0),false);
  assert.equal(geo.inRegion(-23.59,-46.63),true);
});

test('Map filters separate verified alerts, pending reports and history', () => {
  const items=[{id:1,risk_level:'Crítico',status:'Registrado',neighborhood:'Vila Mariana'}, {id:2,risk_level:'Alto',status:'Alerta emitido',neighborhood:'Mooca'}, {id:3,risk_level:'Alto',status:'Encerrado',neighborhood:'Mooca'}, {id:4,risk_level:'Baixo',status:'Descartado',neighborhood:'Mooca'}];
  const ids = (risk,scope,place) => geo.filter(items,risk,scope,place).map(o=>o.id);
  assert.deepEqual(ids('','open',''),[1,2]);
  assert.deepEqual(ids('','alerts',''),[2]);
  assert.deepEqual(ids('Alto','all','Mooca'),[2,3]);
  assert.deepEqual(ids('Baixo','open',''),[]);
});

test('Geographic form and filter labels escape untrusted names', () => {
  const payload='"><img src=x onerror=alert(1)>';
  assert.ok(!geo.neighborhoodField(payload).includes('<img'));
  assert.ok(!geo.mapFields([{neighborhood:payload}],payload).includes('<img'));
  assert.ok(geo.pickerFields({latitude:payload}).includes('&quot;'));
});
