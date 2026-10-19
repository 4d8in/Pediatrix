import type { FastifyInstance } from "fastify";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { listUsers } from "../../socle/auth/user-store.js";

// Médecins actifs, pour choisir chez qui prendre rendez-vous.
export async function listDoctorsRoute(app: FastifyInstance) {
  app.get(
    "/api/appointments/doctors",
    { preHandler: [authenticate, authorize("receptionist", "nurse", "doctor", "director")] },
    async (_request, reply) => {
      const users = await listUsers();
      const doctors = users
        .filter(({ user }) => user.role === "doctor" && !user.disabled)
        .map(({ user }) => ({ practitionerId: user.practitionerId, name: user.displayName }));
      return reply.send({ doctors });
    },
  );
}
