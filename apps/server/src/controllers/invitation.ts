import { Elysia } from "elysia";
import prisma from "../db";
import { authMiddleware } from "../lib/auth";

export const invitationController = new Elysia({ prefix: "/invitations" }).get(
	"/:token",
	async ({ params }) => {
		const invitation = await prisma.invitation.findUnique({
			where: { id: params.token },
			include: {
				organization: true,
				inviter: true,
			},
		});

		if (!invitation) {
			throw new Error("Invitation not found");
		}

		if (invitation.status !== "PENDING") {
			throw new Error("Invitation is no longer valid");
		}

		if (invitation.expiresAt < new Date()) {
			throw new Error("Invitation has expired");
		}

		return invitation;
	},
);
