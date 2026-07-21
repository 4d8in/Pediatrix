import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "./roles.js";

// À utiliser après `authenticate` : suppose que request.user est déjà rempli.
export function authorize(...allowedRoles: Role[]) {
  return async function authorizeHandler(request: FastifyRequest, reply: FastifyReply) {
    const role = request.user?.role;
    if (!role || !allowedRoles.includes(role)) {
      return reply.code(403).send({ error: "Rôle non autorisé pour cette action." });
    }
  };
}
