import { test } from "node:test";
import assert from "node:assert/strict";
import type { FastifyReply, FastifyRequest } from "fastify";
import { authorize } from "../src/socle/auth/authorize.js";

// Faux objet reply qui enregistre le code et le corps envoyés.
function fakeReply() {
  const sent: { code?: number; body?: unknown } = {};
  const reply = {
    code(value: number) {
      sent.code = value;
      return reply;
    },
    send(body: unknown) {
      sent.body = body;
      return reply;
    },
  };
  return { reply: reply as unknown as FastifyReply, sent };
}

function requestWithRole(role?: string): FastifyRequest {
  return { user: role ? { sub: "p1", role, name: "Test" } : undefined } as unknown as FastifyRequest;
}

test("authorize laisse passer un rôle autorisé", async () => {
  const { reply, sent } = fakeReply();
  await authorize("doctor", "nurse")(requestWithRole("doctor"), reply);
  assert.equal(sent.code, undefined);
});

test("authorize bloque un rôle non autorisé avec 403", async () => {
  const { reply, sent } = fakeReply();
  await authorize("doctor")(requestWithRole("lab_tech"), reply);
  assert.equal(sent.code, 403);
});

test("authorize bloque une requête sans utilisateur avec 403", async () => {
  const { reply, sent } = fakeReply();
  await authorize("doctor")(requestWithRole(undefined), reply);
  assert.equal(sent.code, 403);
});
