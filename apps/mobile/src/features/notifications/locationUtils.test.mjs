import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(path,imports={},globals={}) {
  const module={exports:{}};
  const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require:id=>{assert.ok(id in imports,id);return imports[id];},...globals});
  return module.exports;
}
const helpers=load('./pickupRoute.ts');
const destination={latitude:6.91,longitude:79.86};
const options={...destination,userLatitude:6.9,userLongitude:79.85};
function setup(os='android',{fail=false,noWindow=false}={}) {
  const opened=[];
  const launch=(url)=>{opened.push(url);if(fail)throw new Error('platform detail');};
  const utils=load('./locationUtils.ts',{
    './pickupRoute':helpers,'react-native':{Platform:{OS:os},Linking:{openURL:async url=>launch(url)}},
  },os==='web'&&!noWindow?{window:{location:{assign:launch}}}:{});
  return {...utils,opened};
}

test('directions URL uses exact customer and shop coordinates with driving mode',()=>{
  const url=new URL(setup().buildGoogleMapsDirectionsUrl(options));
  assert.equal(url.origin,'https://www.google.com');assert.equal(url.pathname,'/maps/dir/');
  assert.equal(url.searchParams.get('api'),'1');assert.equal(url.searchParams.get('origin'),'6.9,79.85');
  assert.equal(url.searchParams.get('destination'),'6.91,79.86');assert.equal(url.searchParams.get('travelmode'),'driving');
  assert.equal(url.searchParams.has('key'),false);assert.equal(url.searchParams.has('query'),false);
  assert.ok(url.href.includes('%2C'));
});
test('zero and negative coordinates remain valid and are not rounded',()=>{
  const url=new URL(setup().buildGoogleMapsDirectionsUrl({latitude:0,longitude:0,userLatitude:-33.123456789,userLongitude:-70.123456789}));
  assert.equal(url.searchParams.get('destination'),'0,0');assert.equal(url.searchParams.get('origin'),'-33.123456789,-70.123456789');
});
test('without GPS the origin is omitted so Google can use device location or ask for it',()=>{
  const url=new URL(setup().buildGoogleMapsDirectionsUrl(destination));
  assert.equal(url.searchParams.has('origin'),false);assert.equal(url.searchParams.get('destination'),'6.91,79.86');
});
for(const [label,invalid] of [
  ['invalid shop latitude',{latitude:91}],['invalid shop longitude',{longitude:-181}],
  ['NaN shop latitude',{latitude:NaN}],['string shop latitude',{latitude:'6.9&origin=elsewhere'}],
  ['partial GPS pair',{userLatitude:undefined}],['invalid GPS longitude',{userLongitude:Infinity}],
  ['null GPS',{userLatitude:null,userLongitude:null}],
]) test(label+' never launches a map',async()=>{
  const s=setup();await assert.rejects(s.openDirectionsInMaps({...options,...invalid}),/location is unavailable/);assert.equal(s.opened.length,0);
});
for(const os of ['ios','android']) test(os+' opens the universal Google directions URL, never Apple Maps or a geo search',async()=>{
  const s=setup(os);await s.openDirectionsInMaps(options);assert.equal(s.opened.length,1);
  assert.equal(s.opened[0],s.buildGoogleMapsDirectionsUrl(options));assert.ok(s.opened[0].startsWith('https://www.google.com/maps/dir/'));
});
test('web launches synchronously in the same tab without using popup windows',async()=>{
  const s=setup('web');const promise=s.openDirectionsInMaps(options);assert.equal(s.opened.length,1);await promise;
  assert.equal(new URL(s.opened[0]).searchParams.get('origin'),'6.9,79.85');
});
for(const os of ['ios','android','web']) test(os+' launch failure is reported without platform details',async()=>{
  const s=setup(os,{fail:true});await assert.rejects(s.openDirectionsInMaps(options),/^Error: Could not open Google Maps\. Please try again\.$/);assert.equal(s.opened.length,1);
});
test('server rendering cannot silently claim to open a browser',async()=>{
  const s=setup('web',{noWindow:true});await assert.rejects(s.openDirectionsInMaps(options),/Could not open Google Maps/);assert.equal(s.opened.length,0);
});
