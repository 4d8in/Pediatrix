import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { Role } from "./roles.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; role: Role; name: string };
    user: { sub: string; role: Role; name: string };
  }
}

// Durée d'une garde : au-delà, l'utilisateur doit se reconnecter.
const JWT_EXPIRES_IN = "8h";

// Enveloppé avec fastify-plugin pour ne pas créer de contexte d'encapsulation :
// sans ça, request.jwtVerify()/reply.jwtSign() ne seraient visibles que dans ce
// plugin et pas dans les routes enregistrées séparément sur `app` (comportement
// standard de Fastify, constaté en pratique via une erreur "jwtSign is not a
// function" sur /api/auth/login).
export const jwtPlugin = fp(async function jwtPlugin(app: FastifyInstance) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET est requis (voir .env.example).");
  }
  await app.register(fastifyJwt, { secret, sign: { expiresIn: JWT_EXPIRES_IN } });
});
