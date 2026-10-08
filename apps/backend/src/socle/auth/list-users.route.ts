import type { FastifyInstance } from "fastify";
import { authenticate } from "./authenticate.js";
import { authorize } from "./authorize.js";
import { listUsers } from "./user-store.js";

// Liste des comptes (écran Comptes de l'administrateur technique). Les hash de
// mot de passe ne sont jamais renvoyés.
export async function listUsersRoute(app: FastifyInstance) {
  app.get("/api/users", { preHandler: [authenticate, authorize("tech_admin")] }, async (_request, reply) => {
    const users = await listUsers();
    return reply.send({
      users: users
        .map(({ username, user }) => ({
          username,
          displayName: user.displayName,
          role: user.role,
          active: !user.disabled,
        }))
        .sort((a, b) => a.username.localeCompare(b.username)),
    });
  });
}
