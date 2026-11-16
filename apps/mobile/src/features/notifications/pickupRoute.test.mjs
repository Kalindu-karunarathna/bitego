import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(path, imports = {}, globals = {}) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, setTimeout, clearTimeout, AbortController,
    require: id => { assert.ok(id in imports, id); return imports[id]; }, ...globals });
  return module.exports;
}
const helpers = load("./pickupRoute.ts");
const destination = { latitude: 6.91, longitude: 79.86 };
const origin = { latitude: 6.9, longitude: 79.85 };
const route = (distanceMeters = 1500) => ({ destination, coordinates: [origin, destination], distanceMeters, durationSeconds: 300 });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };

test("coordinate and route validation handles zero coordinates and zero distance", () => {
  assert.equal(helpers.validPickupCoordinates({ latitude: 0, longitude: 0 }), true);
  assert.equal(helpers.validatePickupRoute(route(0)).distanceMeters, 0);
  for (const point of [null, {}, { latitude: null, longitude: 0 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: Infinity }]) {
    assert.equal(helpers.validPickupCoordinates(point), false);
  }
});
test("rejects missing shop, incomplete geometry, and invalid metrics", () => {
  for (const change of [{ destination: null }, { coordinates: [origin] }, { distanceMeters: NaN }, { durationSeconds: -1 }]) {
    assert.throws(() => helpers.validatePickupRoute({ ...route(), ...change }), /route could not be read/);
  }
});
test("a cancelled request cannot return a late route", async () => {
  const controller = new AbortController(); const task = deferred();
  const pending = helpers.waitForPickupResult(task.promise, controller.signal, 100, "timeout");
  controller.abort(); task.resolve(route()); await assert.rejects(pending, /cancelled/);
});
test("consumes a late rejection even when already cancelled", async () => {
  const controller = new AbortController(); controller.abort(); const task = deferred();
  const pending = helpers.waitForPickupResult(task.promise, controller.signal, 100, "timeout");
  task.reject(new Error("late")); await assert.rejects(pending, /cancelled/);
});
test("bounds GPS and route waits", async () => {
  await assert.rejects(helpers.waitForPickupResult(new Promise(() => {}), new AbortController().signal, 5, "GPS timeout"), /GPS timeout/);
});

// Small hook lifecycle harness: run the real hook with deterministic React/Expo/API
// boundaries. This verifies async state ownership; it is not a native rendering test.
function setup({ permission = "granted", position, fetchRoute = async () => route() } = {}) {
  let slots = [], index = 0, effects = [], queued = [], dirty = false, mounted = true, value, props;
  const calls = { permission: 0, gps: 0, route: [] };
  const same = (a,b) => a && b && a.length === b.length && a.every((v,i) => Object.is(v,b[i]));
  const react = {
    useState(initial) {
      const i=index++; if (!(i in slots)) slots[i]=initial;
      return [slots[i], next => { if(mounted) { slots[i]=typeof next === "function" ? next(slots[i]) : next; dirty=true; } }];
    },
    useCallback(fn,deps) {
      const i=index++; if (!slots[i] || !same(slots[i].deps,deps)) slots[i]={ fn,deps }; return slots[i].fn;
    },
    useEffect(fn,deps) {
      const i=index++; if (!effects[i] || !same(effects[i].deps,deps)) {
        queued.push(() => { effects[i]?.cleanup?.(); effects[i]={ deps,cleanup:fn() }; });
      }
    },
  };
  const { usePickupRoute } = load("./usePickupRoute.ts", {
    react, "./pickupRoute": helpers,
    "expo-location": { Accuracy: { Balanced: 3 }, requestForegroundPermissionsAsync: async () => {
      calls.permission++; return { status: permission };
    }, getCurrentPositionAsync: async () => { calls.gps++; return position ? position() : { coords: origin }; } },
    "@/api/notifications": { fetchPickupRoute: async input => { calls.route.push(input); return fetchRoute(input); } },
  });
  function render(next = props) { props=next; index=0; dirty=false; value=usePickupRoute(props); const jobs=queued; queued=[]; jobs.forEach(fn=>fn()); return value; }
  async function settle() { for(let i=0;i<20;i++) { await Promise.resolve(); if(dirty)render(); } return value; }
  return { render, settle, calls, unmount() { mounted=false; effects.forEach(e=>e?.cleanup?.()); }, get value() { return value; } };
}
const options = { reservationId: "order-a", latitude: destination.latitude, longitude: destination.longitude };
test("obtains current GPS and binds the default API request to the selected order", async () => {
  const h=setup(); h.render(options); const result=await h.settle();
  assert.equal(result.status,"ready"); assert.equal(h.calls.permission,1); assert.equal(h.calls.gps,1);
  assert.equal(h.calls.route[0].reservationId,"order-a"); assert.equal(h.calls.route[0].origin.latitude,origin.latitude);
  h.unmount();
});
test("explicit customer coordinates avoid requesting GPS permission", async () => {
  const h=setup(); h.render({ ...options, userLatitude:0, userLongitude:0 }); await h.settle();
  assert.equal(h.value.status,"ready"); assert.equal(h.calls.permission,0); assert.equal(h.calls.route[0].origin.latitude,0); h.unmount();
});
test("permission denied shows a useful error without requesting a route", async () => {
  const h=setup({ permission:"denied" }); h.render(options); await h.settle();
  assert.equal(h.value.status,"error"); assert.match(h.value.message,/Allow location/); assert.equal(h.calls.route.length,0); h.unmount();
});
test("rejects a partial customer coordinate pair", async () => {
  const h=setup(); h.render({ ...options,userLatitude:6.9 }); await h.settle();
  assert.equal(h.value.status,"error"); assert.equal(h.calls.route.length,0); h.unmount();
});
test("switching orders hides the old route immediately and ignores its late response", async () => {
  const first=deferred(); const second=deferred();
  const h=setup({ fetchRoute: input=>input.reservationId === "order-a" ? first.promise : second.promise });
  h.render(options); await h.settle();
  const switched=h.render({ ...options,reservationId:"order-b" });
  assert.equal(switched.route,null); assert.equal(switched.origin,null);
  await h.settle(); second.resolve(route(2200)); await h.settle();
  first.resolve(route(100)); await h.settle();
  assert.equal(h.value.route.distanceMeters,2200); h.unmount();
});
test("switching away from a completed route clears it before the next effect resolves", async () => {
  const h=setup(); h.render(options); await h.settle(); assert.equal(h.value.status,"ready");
  const next=h.render({ ...options,reservationId:"order-b" }); assert.equal(next.route,null); assert.equal(next.status,"locating"); h.unmount();
});
test("late GPS after an order switch cannot start a request for the old order", async () => {
  const oldGPS=deferred(); let count=0;
  const h=setup({ position:()=>++count===1?oldGPS.promise:Promise.resolve({ coords:origin }) });
  h.render(options); await h.settle(); h.render({ ...options,reservationId:"order-b" }); await h.settle();
  oldGPS.resolve({ coords:origin }); await h.settle();
  assert.deepEqual(h.calls.route.map(r=>r.reservationId),["order-b"]); h.unmount();
});
test("retry reacquires current location and can recover from a route failure", async () => {
  let count=0; const h=setup({ fetchRoute:async()=>{ if(++count===1)throw new Error("Try again"); return route(); } });
  h.render(options); await h.settle(); assert.equal(h.value.status,"error");
  h.value.retry(); await h.settle(); assert.equal(h.value.status,"ready"); assert.equal(h.calls.gps,2); h.unmount();
});
test("unmount prevents a pending GPS request from starting network work", async () => {
  const gps=deferred(); const h=setup({ position:()=>gps.promise }); h.render(options); await h.settle();
  h.unmount(); gps.resolve({ coords:origin }); await h.settle(); assert.equal(h.calls.route.length,0);
});
