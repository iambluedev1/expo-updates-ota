import { type BetterAuthOptions, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import Elysia from "elysia";
import { sendInvitationEmail as _sendInvatationEmail } from "@/services/email";
import prisma from "../db";

export const auth = betterAuth<BetterAuthOptions>({
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	trustedOrigins: [process.env.ADMIN_WEB_URL || ""],
	baseURL: process.env.SERVER_URL,
	emailAndPassword: {
		enabled: true,
	},
	advanced: {
		defaultCookieAttributes: {
			sameSite: "none",
			secure: true,
			httpOnly: true,
		},
	},
	plugins: [
		organization({
			async sendInvitationEmail(data) {
				_sendInvatationEmail({
					to: data.email,
					inviterName: data.inviter.user.name,
					organizationName: data.organization.name,
					role: data.role,
					inviteToken: data.id,
				});
			},
		}),
	],
});

export const authMiddleware = new Elysia({ name: "better-auth" })
	.mount(auth.handler)
	.macro({
		auth: {
			async resolve({ status, request: { headers } }) {
				const session = await auth.api.getSession({
					headers,
				});

				if (!session) return status(401);

				return {
					user: session.user,
					session: session.session,
				};
			},
		},
	});

export const cliAuthMiddleware = new Elysia({ name: "cli-token-auth" }).macro({
	tokenAuth: {
		async resolve({ status, request: { headers, url } }) {
			const authHeader = headers.get("Authorization");

			if (!authHeader || !authHeader.startsWith("Bearer ")) {
				return status(401, { error: "Invalid authorization header" });
			}

			const token = authHeader.slice(7);

			const appToken = await prisma.appToken.findFirst({
				where: { token },
				include: {
					app: {
						include: {
							organization: true,
						},
					},
					user: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
				},
			});

			if (!appToken) {
				return status(401, { error: "Invalid token" });
			}

			return {
				token: appToken,
				app: appToken.app,
				organization: appToken.app.organization,
				user: appToken.user,
			};
		},
	},
});

export const hybridAuthMiddleware = new Elysia({ name: "hybrid-auth" }).macro({
	hybridAuth: {
		async resolve({ status, request: { headers } }) {
			const authHeader = headers.get("Authorization");

			if (authHeader?.startsWith("Bearer ")) {
				const token = authHeader.slice(7);

				const appToken = await prisma.appToken.findFirst({
					where: { token },
					include: {
						app: {
							include: {
								organization: true,
							},
						},
						user: {
							select: {
								id: true,
								name: true,
								email: true,
							},
						},
					},
				});

				if (appToken) {
					return {
						type: "token",
						token: appToken,
						app: appToken.app,
						organization: appToken.app.organization,
						user: appToken.user,
					};
				}
			}

			const session = await auth.api.getSession({
				headers,
			});

			if (session) {
				return {
					type: "session",
					user: session.user,
					session: session.session,
				};
			}

			return status(401, { error: "Authentication required" });
		},
	},
});
