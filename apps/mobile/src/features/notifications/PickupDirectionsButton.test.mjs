import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
function load(path,imports={},globals={}) {
  const module={exports:{}};
  const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
  }).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,Error,require:id=>{assert.ok(id in imports,id);return imports[id];},...globals});
  return module.exports;
}
const jsx=(type,props,key)=>({type,props,key});
const runtime={jsx,jsxs:jsx};
const native={View:'View',Text:'Text',TouchableOpacity:'Button',StyleSheet:{create:s=>s}};
const helpers=load('./pickupRoute.ts');
const options={reservationId:'order-a',latitude:6.91,longitude:79.86,userLatitude:6.9,userLongitude:79.85};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function find(tree,type) {
  if(!tree||typeof tree!=='object')return null;
  if(tree.type===type)return tree;
  for(const item of [tree.props?.children].flat()) {const match=find(item,type);if(match)return match;} return null;
}
function textOf(tree) {
  if(typeof tree==='string')return tree;
  if(!tree||typeof tree!=='object')return '';
  return [tree?.props?.children].flat().map(textOf).join(' ');
}

// Exercise the actual component's event/lifecycle logic with React/native boundaries
// replaced. This checks behavior, not native rendering or OS app association.
function setup(open=async()=>{}) {
  let context,tree,props=options;const calls=[];
  const react={
    useState(initial) {const c=context;const i=c.index++;if(!(i in c.slots))c.slots[i]=initial;return[c.slots[i],v=>{c.slots[i]=v;}];},
    useRef(initial) {const c=context;const i=c.index++;if(!(i in c.slots))c.slots[i]={current:initial};return c.slots[i];},
    useEffect(effect) {const c=context;const i=c.index++;if(!(i in c.slots)){c.slots[i]=true;c.jobs.push(()=>c.cleanup.push(effect()));}},
  };
  const {PickupDirectionsButton}=load('./PickupDirectionsButton.tsx',{
    react,'react-native':native,'react/jsx-runtime':runtime,'./pickupRoute':helpers,
    './locationUtils':{openDirectionsInMaps:input=>{calls.push(input);return open(input);}},
  });
  function render(next=props) {
    props=next;const child=PickupDirectionsButton(props);
    if(context?.key!==child.key){context?.cleanup.forEach(f=>f?.());context={key:child.key,slots:[],index:0,cleanup:[],jobs:[]};}
    context.index=0;tree=child.type(child.props);context.jobs.splice(0).forEach(f=>f());return tree;
  }
  async function settle(){for(let i=0;i<8;i++)await Promise.resolve();return render();}
  render();
  return{render,settle,calls,press:()=>find(tree,'Button').props.onPress(),get tree(){return tree;},unmount(){context.cleanup.forEach(f=>f?.());}};
}
test('mount does not launch anything; clicking sends the selected order coordinates',async()=>{
  const h=setup();assert.equal(h.calls.length,0);h.press();await h.settle();
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].latitude,6.91);assert.equal(h.calls[0].userLongitude,79.85);h.unmount();
});
test('rapid repeated taps launch only once and expose busy state',async()=>{
  const pending=deferred();const h=setup(()=>pending.promise);h.press();h.press();h.render();
  assert.equal(h.calls.length,1);assert.equal(find(h.tree,'Button').props.accessibilityState.busy,true);
  pending.resolve();await h.settle();assert.equal(find(h.tree,'Button').props.disabled,false);h.unmount();
});
test('launch failure is visible and allows an explicit retry',async()=>{
  let attempt=0;const h=setup(async()=>{if(++attempt===1)throw new Error('Could not open Google Maps. Please try again.');});
  h.press();await h.settle();assert.match(textOf(h.tree),/Could not open Google Maps/);
  h.press();await h.settle();assert.equal(h.calls.length,2);assert.doesNotMatch(textOf(h.tree),/Could not open Google Maps/);h.unmount();
});
test('invalid shop coordinates disable the button and explain why',()=>{
  const h=setup();h.render({...options,latitude:NaN});h.press();assert.equal(h.calls.length,0);
  assert.equal(find(h.tree,'Button').props.disabled,true);assert.match(textOf(h.tree),/shop location is unavailable/);h.unmount();
});
test('parent can disable the action for an unavailable pickup',()=>{
  const h=setup();h.render({...options,disabled:true});h.press();assert.equal(h.calls.length,0);h.unmount();
});
test('old launch failures cannot change the next orders button',async()=>{
  const old=deferred();const h=setup(input=>input.reservationId==='order-a'?old.promise:Promise.resolve());
  h.press();h.render({...options,reservationId:'order-b',latitude:7});h.press();
  old.reject(new Error('Old failure'));await h.settle();assert.doesNotMatch(textOf(h.tree),/Old failure/);
  assert.equal(h.calls[1].latitude,7);assert.equal(find(h.tree,'Button').props.disabled,false);h.unmount();
});

function mapModule(web,state,key='test-browser-key') {
  const react={useMemo:fn=>fn(),useCallback:fn=>fn,useRef:()=>({current:null}),useState:()=>[false,()=>{}],useEffect:()=>{}};
  return load(web?'./BusinessLocationMap.web.tsx':'./BusinessLocationMap.tsx',{
    react,'react-native':native,'react/jsx-runtime':runtime,'./pickupRoute':helpers,
    './PickupDirectionsButton':{PickupDirectionsButton:'Directions'},'./PickupMapStatus':{PickupMapStatus:'Status'},
    './usePickupRoute':{usePickupRoute:()=>state},'./pickupMapDocument':{createPickupMapDocument:()=>''},
    'react-native-maps':{__esModule:true,default:'Map',Marker:'Marker',Polyline:'Polyline',PROVIDER_GOOGLE:'google'},
  },{process:{env:{EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY:key}}});
}
for(const web of [false,true])test((web?'web':'native')+' map directions use the returned shop and current customer coordinates',()=>{
  const state={key:'order-a',status:'ready',origin:{latitude:6.8,longitude:79.7},route:{destination:{latitude:7,longitude:80},coordinates:[]}};
  const {BusinessLocationMap}=mapModule(web,state);
  const render=props=>{const result=BusinessLocationMap(props);return web?result.type(result.props):result;};
  const action=find(render({...options,name:'Shop'}),'Directions');
  assert.equal(action.props.latitude,7);assert.equal(action.props.longitude,80);assert.equal(action.props.userLatitude,6.8);
  assert.equal(action.props.reservationId,'order-a');assert.equal(find(render({...options,name:'Shop',showDirections:false}),'Directions'),null);
});
test('web directions remain available without an embedded-map key and can be hidden for a footer',()=>{
  const {BusinessLocationMap}=mapModule(true,null,'');
  assert.equal(find(BusinessLocationMap({...options,name:'Shop'}),'Directions').props.latitude,6.91);
  assert.equal(find(BusinessLocationMap({...options,name:'Shop',showDirections:false}),'Directions'),null);
});
