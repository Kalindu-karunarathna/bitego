import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

function compile(path) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
function load(code, imports, globals = {}) {
  const loadedModule = { exports: {} };
  vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, require: id => {
    assert.ok(id in imports, id); return imports[id];
  }, ...globals });
  return loadedModule.exports;
}
const shared = load(compile("../../../../../../packages/shared/src/notifications.ts"), { zod: { z } });
const code = compile("./pickup-route.service.ts");
const routeCode = compile("../../../app/api/v1/notifications/pickup-route/route.ts");
class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const input = { reservationId: "2f2da038-3fef-4b35-a629-258236d6bc8c", origin: { latitude: 6.9, longitude: 79.85 } };
const payload = () => ({ routes: [{ distanceMeters: 1500, duration: "320.5s", polyline: {
  geoJsonLinestring: { type: "LineString", coordinates: [[79.85, 6.9], [79.86, 6.91]] },
} }] });
function setup({ row = { status: "CONFIRMED", listing: {
  pickupEnd: new Date(Date.now() + 60000), business: { latitude: 6.91, longitude: 79.86 },
} }, key = "test-server-key", result = payload(), status = 200, failure, timeout = false } = {}) {
  const calls = [];
  const queries = [];
  const service = load(code, {
    zod: { z }, "@bitego/shared": shared, "@/lib/http": { ApiError },
    "@/lib/prisma": { prisma: { reservation: { findFirst: async query => {
      queries.push(query);
      return query.where.buyerId === "buyer" && query.where.id === input.reservationId ? row : null;
    } } } },
  }, {
    process: { env: { GOOGLE_ROUTES_API_KEY: key } },
    AbortSignal: { timeout: ms => { assert.equal(ms, 10000); return { aborted: timeout }; } },
    fetch: async (url, options) => {
      calls.push({ url, ...options });
      if (failure) throw failure;
      return { ok: status >= 200 && status < 300, json: async () => result };
    },
  });
  return { ...service, calls, queries };
}
const rejectsCode = (promise, code, status) => assert.rejects(promise, e => e.code === code && e.status === status);

test("validates reservation ID and finite origin; does not accept a client-selected destination", () => {
  assert.ok(shared.pickupRouteRequestSchema.safeParse(input).success);
  for (const bad of [
    { ...input, reservationId: "bad" }, { ...input, destination: input.origin },
    ...[NaN, Infinity, 91, -91, null, "6.9"].map(latitude => ({ ...input, origin: { ...input.origin, latitude } })),
    { ...input, origin: { latitude: 6.9 } }, { ...input, origin: { latitude: 0, longitude: 181 } },
  ]) assert.equal(shared.pickupRouteRequestSchema.safeParse(bad).success, false);
});

test("uses the buyer's reservation shop and returns a road route with correctly ordered coordinates", async () => {
  const s = setup(); const route = await s.getPickupRoute("buyer", input);
  assert.equal(route.destination.latitude, 6.91);
  assert.equal(route.coordinates[0].latitude, 6.9);
  assert.equal(route.coordinates[0].longitude, 79.85);
  assert.equal(route.distanceMeters, 1500); assert.equal(route.durationSeconds, 320.5);
  assert.equal(s.calls.length, 1);
  const request = s.calls[0]; const body = JSON.parse(request.body);
  assert.equal(body.destination.location.latLng.latitude, 6.91);
  assert.deepEqual(body.origin.location.latLng, input.origin);
  assert.equal(body.travelMode, "DRIVE"); assert.equal(body.routingPreference, "TRAFFIC_UNAWARE");
  assert.equal(body.polylineEncoding, "GEO_JSON_LINESTRING");
  assert.equal(request.cache, "no-store");
  assert.equal(request.headers["X-Goog-Api-Key"], "test-server-key");
  assert.equal(request.url, "https://routes.googleapis.com/directions/v2:computeRoutes");
  assert.equal(JSON.stringify(route).includes("test-server-key"), false);
});

for (const [name, user, row] of [["another buyer", "stranger", undefined], ["missing order", "buyer", null]]) {
  test("rejects " + name + " before contacting Google", async () => {
    const s = setup(row === undefined ? {} : { row });
    await rejectsCode(s.getPickupRoute(user, input), "RESERVATION_NOT_FOUND", 404);
    assert.equal(s.calls.length, 0);
  });
}
for (const status of ["CANCELLED", "PICKED_UP", "EXPIRED"]) test("rejects " + status + " pickups", async () => {
  const s = setup({ row: { status, listing: { pickupEnd: new Date(Date.now() + 60000) } } });
  await rejectsCode(s.getPickupRoute("buyer", input), "PICKUP_UNAVAILABLE", 409); assert.equal(s.calls.length, 0);
});
test("rejects expired pickups even before the expiry job runs", async () => {
  const s = setup({ row: { status: "CONFIRMED", listing: { pickupEnd: new Date(0) } } });
  await rejectsCode(s.getPickupRoute("buyer", input), "PICKUP_UNAVAILABLE", 409);
});
test("rejects an invalid stored shop location", async () => {
  const s = setup({ row: { status: "CONFIRMED", listing: {
    pickupEnd: new Date(Date.now() + 60000), business: { latitude: NaN, longitude: 79.86 },
  } } });
  await rejectsCode(s.getPickupRoute("buyer", input), "SHOP_LOCATION_UNAVAILABLE", 422);
});
for (const key of ["", "   "]) test("missing server key fails closed", async () => {
  const s = setup({ key }); await rejectsCode(s.getPickupRoute("buyer", input), "ROUTING_NOT_CONFIGURED", 503);
  assert.equal(s.calls.length, 0);
});
test("empty routes show no driving route instead of an invented straight line", async () => {
  const s = setup({ result: {} }); await rejectsCode(s.getPickupRoute("buyer", input), "ROUTE_NOT_FOUND", 404);
});
for (const mutate of [
  r => { r.routes[0].polyline.geoJsonLinestring.coordinates = [[200, 0], [0, 0]]; },
  r => { r.routes[0].polyline.geoJsonLinestring.coordinates = [[79, 6]]; },
  r => { r.routes[0].duration = "-1s"; }, r => { r.routes[0].distanceMeters = -1; },
]) test("rejects malformed route geometry or metrics", async () => {
  const result = payload(); mutate(result); const s = setup({ result });
  await rejectsCode(s.getPickupRoute("buyer", input), "INVALID_ROUTE", 502);
});
test("preserves a zero-distance route and protobuf omitted zero distance", async () => {
  const result = payload(); delete result.routes[0].distanceMeters; result.routes[0].duration = "0s";
  const route = await setup({ result }).getPickupRoute("buyer", input);
  assert.equal(route.distanceMeters, 0); assert.equal(route.durationSeconds, 0);
});
for (const status of [403, 429, 500]) test("provider HTTP " + status + " is sanitized and never retried", async () => {
  const s = setup({ status }); await rejectsCode(s.getPickupRoute("buyer", input), "ROUTING_UNAVAILABLE", 502);
  assert.equal(s.calls.length, 1);
});
test("network errors do not expose provider secrets", async () => {
  const s = setup({ failure: new Error("secret and customer coordinates") });
  await assert.rejects(s.getPickupRoute("buyer", input), e => e.code === "ROUTING_UNAVAILABLE" && !e.message.includes("secret"));
});
test("timeout is returned as a retryable failure", async () => {
  const s = setup({ timeout: true, failure: new Error("aborted") });
  await rejectsCode(s.getPickupRoute("buyer", input), "ROUTING_TIMEOUT", 504);
});
test("HTTP handler authenticates before parsing, passes the authenticated buyer and disables caching", async () => {
  const calls = [];
  const handler = load(routeCode, {
    "next/server": { connection: async () => {} }, "@bitego/shared": shared,
    "@/lib/http": { route: fn => fn, parseBody: async (_req, schema) => { calls.push("body"); return schema.parse(input); },
      ok: data => ({ data, headers: new Headers() }) },
    "@/server/middleware/auth": { requireRole: async (_req, ...roles) => {
      assert.deepEqual(roles, ["CUSTOMER", "BUSINESS"]); calls.push("auth"); return { user: { id: "verified-buyer" } };
    } },
    "@/server/modules/notifications/pickup-route.service": { getPickupRoute: async (id, body) => {
      assert.equal(id, "verified-buyer"); assert.equal(body.reservationId, input.reservationId); return { route: true };
    } },
  });
  const response = await handler.POST({});
  assert.deepEqual(calls, ["auth", "body"]); assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});
