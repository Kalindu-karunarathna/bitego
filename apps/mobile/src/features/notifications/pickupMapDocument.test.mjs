import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("./pickupMapDocument.ts",import.meta.url),"utf8"), {
  compilerOptions: { module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022 },
}).outputText,{ module,exports:module.exports });
const destination={ latitude:6.91,longitude:79.86 };
const input={ apiKey:"browser-key&x=1",mapId:"DEMO_MAP_ID",destination,origin:null,coordinates:[],name:"Shop",interactive:false };
const documentFor=options=>module.exports.createPickupMapDocument({ ...input,...options });

test("escapes shop names and all script data without allowing injected HTML",()=>{
  const html=documentFor({ name:'</script><script>alert(1)</script>&\u2028' });
  assert.equal((html.match(/<script>/g)||[]).length,1);
  assert.equal((html.match(/<\/script>/g)||[]).length,1);
  assert.equal(html.includes('<script>alert(1)'),false);
});

function setup() {
  const calls={ maps:[],markers:[],lines:[],bounds:[],scripts:[] }; const listeners={};
  const parent={}; const container={ textContent:"" };
  class Map {
    constructor(element,options) { calls.maps.push(options); }
    fitBounds(bounds) { calls.bounds.push(bounds.points); }
    getZoom() { return 15; } setZoom() {}
  }
  class AdvancedMarkerElement {
    constructor(options) { Object.assign(this,options); calls.markers.push(this); } append() {}
  }
  class PinElement { constructor(options) { Object.assign(this,options); } }
  class Polyline { constructor(options) { Object.assign(this,options); calls.lines.push(this); } setMap(map) { this.map=map; } }
  class LatLngBounds { points=[]; extend(point) { this.points.push(point); } }
  const window={ addEventListener:(name,handler)=>{listeners[name]=handler;} };
  vm.runInNewContext(documentFor().match(/<script>([\s\S]*?)<\/script>/)[1],{
    parent,window,document:{ getElementById:()=>container,createElement:()=>({}),head:{ append:script=>calls.scripts.push(script) } },
    setTimeout:()=>1,clearTimeout:()=>{},
    google:{ maps:{ importLibrary:async name=>name==="maps"?{Map}:{AdvancedMarkerElement,PinElement},Polyline,LatLngBounds,event:{addListenerOnce:()=>{}} } },
  });
  return { calls,window,parent,listeners,container };
}
test("updates customer pin and route without creating another billable map instance",async()=>{
  const s=setup(); await s.window.initPickupMap(); assert.equal(s.calls.maps.length,1);
  const origin={ latitude:6.9,longitude:79.85 };
  s.listeners.message({ source:s.parent,data:{type:"bitego-pickup-map",payload:{origin,coordinates:[origin,destination]}} });
  assert.equal(s.calls.maps.length,1);
  assert.equal(s.calls.markers.filter(m=>m.map).length,2);
  assert.equal(s.calls.lines[0].path[0].lat,6.9); assert.equal(s.calls.lines[0].path[0].lng,79.85);
  assert.equal(s.calls.bounds[0].length,4);
  assert.ok(s.calls.scripts[0].src.endsWith("browser-key%26x%3D1"));
});
test("keeps route updates received before the Google library finishes loading",async()=>{
  const s=setup(); const origin={ latitude:6.9,longitude:79.85 };
  s.listeners.message({ source:s.parent,data:{type:"bitego-pickup-map",payload:{origin,coordinates:[origin,destination]}} });
  await s.window.initPickupMap(); assert.equal(s.calls.markers.filter(m=>m.map).length,2); assert.equal(s.calls.lines.length,1);
});
test("ignores route messages from unrelated windows",async()=>{
  const s=setup(); await s.window.initPickupMap();
  s.listeners.message({ source:{},data:{type:"bitego-pickup-map",payload:{origin:destination,coordinates:[destination,destination]}} });
  assert.equal(s.calls.markers.length,1); assert.equal(s.calls.lines.length,0);
});
test("map authentication failure displays a useful message",()=>{
  const s=setup(); s.window.gm_authFailure(); assert.match(s.container.textContent,/map could not load/);
});
