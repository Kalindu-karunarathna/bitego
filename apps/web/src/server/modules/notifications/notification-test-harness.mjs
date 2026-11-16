import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";

const compiled = new Map();
export function loadTs(path, imports = {}, globals = {}) {
  if (!compiled.has(path)) compiled.set(path, ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  const loadedModule = { exports: {} };
  vm.runInNewContext(compiled.get(path), {
    module: loadedModule, exports: loadedModule.exports, Buffer, Error,
    require: id => { assert.ok(id in imports, id); return imports[id]; }, ...globals,
  });
  return loadedModule.exports;
}
export const identity = loadTs("./notification-identity.ts", { "node:crypto": { createHash } });
export const USER = "11111111-1111-4111-8111-111111111111";
export const OTHER_USER = "22222222-2222-4222-8222-222222222222";
export const LISTING = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const OTHER_LISTING = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const RESERVATION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const OTHER_RESERVATION = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const event = (overrides = {}) => ({ userId: USER, type: "NEW_NEARBY_LISTING", listingId: LISTING,
  title: "Nearby food", message: "Food is available", ...overrides });

// Atomic insert/unique-key adapter, NOT a live PostgreSQL test. Both concurrent reads
// can see no row; create then models the existing database primary-key constraint.
export function setupNotifier({ rows = [], disabledUsers = [], createError, readError, pushError } = {}) {
  const stored = new Map(rows.map(row => [row.id, { ...row }]));
  const disabled = new Set(disabledUsers);
  const calls = { creates: 0, conflicts: 0, pushes: [], errors: [] };
  const equal = (key, a, b) => key.endsWith("Id") || key === "id" ? a?.toLowerCase() === b?.toLowerCase() : a === b;
  const prisma = {
    userPreference: { findUnique: async ({ where }) => disabled.has(where.userId) ? { notificationsEnabled: false } : null },
    notification: {
      findFirst: async ({ where }) => {
        if (readError) throw readError;
        const row = [...stored.values()].find(item => Object.entries(where).every(([key, value]) => equal(key, item[key], value)));
        return row ? { id: row.id } : null;
      },
      create: async ({ data }) => {
        calls.creates++;
        await Promise.resolve();
        if (createError) throw (typeof createError === "function" ? createError() : createError);
        const id = data.id ?? randomUUID();
        if (stored.has(id)) { calls.conflicts++; throw Object.assign(new Error("Unique key"), { code: "P2002" }); }
        stored.set(id, { ...data, id });
        return { id };
      },
    },
  };
  function loadNotifier() {
    return loadTs("./notify.ts", {
      "@/lib/prisma": { prisma }, "./notification-identity": identity,
      "@/server/modules/notifications/push.service": { sendPush: async (userId, payload) => {
        assert.ok(stored.has(payload.data.notificationId), "push must follow persistence");
        calls.pushes.push({ userId, ...payload }); if (pushError) throw pushError;
      } },
    }, { console: { error: (...args) => calls.errors.push(args) } });
  }
  return { ...loadNotifier(), loadNotifier, prisma, stored, disabled, calls };
}
