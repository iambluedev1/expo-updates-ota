import { Elysia, t } from "elysia";
import prisma from "../db";
import { authMiddleware, cliAuthMiddleware } from "../lib/auth";
import { encrypt } from "../lib/crypto";

export const appController = new Elysia({ prefix: "/apps" })
	.use(authMiddleware)
	.get(
		"/",
		async ({ user, query }) => {
			const organizationId = query.organizationId;

			if (!organizationId) {
				throw new Error("Organization ID is required");
			}

			const member = await prisma.member.findFirst({
				where: {
					organizationId,
					userId: user.id,
				},
			});

			if (!member) {
				throw new Error("Not a member of this organization");
			}

			const apps = await prisma.app.findMany({
				where: { organizationId },
				include: {
					runtimes: {
						include: {
							activeBuild: true,
						},
						orderBy: { createdAt: "desc" },
						take: 3,
					},
					tokens: {
						select: {
							id: true,
							name: true,
							lastUsedAt: true,
							createdAt: true,
						},
					},
				},
			});

			return apps;
		},
		{
			query: t.Object({
				organizationId: t.String(),
			}),
			auth: true,
		},
	)
	.post(
		"/",
		async ({ body, user }) => {
			const member = await prisma.member.findFirst({
				where: {
					organizationId: body.organizationId,
					userId: user.id,
				},
			});

			if (!member || !["admin", "owner"].includes(member.role)) {
				throw new Error("Insufficient permissions");
			}

			const app = await prisma.app.create({
				data: {
					title: body.title,
					slug: body.slug,
					organizationId: body.organizationId,
				},
				include: {
					runtimes: {
						include: {
							activeBuild: true,
							builds: {
								orderBy: { createdAt: "desc" },
								take: 1,
							},
						},
					},
					tokens: {
						select: {
							id: true,
							name: true,
							lastUsedAt: true,
							createdAt: true,
						},
					},
				},
			});

			return app;
		},
		{
			body: t.Object({
				title: t.String(),
				slug: t.String(),
				organizationId: t.String(),
			}),
			auth: true,
		},
	)
	.get(
		"/:id",
		async ({ params, user }) => {
			const app = await prisma.app.findFirst({
				where: {
					id: params.id,
					organization: {
						members: {
							some: {
								userId: user.id,
							},
						},
					},
				},
				include: {
					organization: true,
					runtimes: {
						include: {
							activeBuild: {
								include: {
									author: {
										select: { id: true, name: true, email: true },
									},
								},
							},
							builds: {
								include: {
									author: {
										select: { id: true, name: true, email: true },
									},
								},
								orderBy: { createdAt: "desc" },
							},
						},
						orderBy: { createdAt: "desc" },
					},
					tokens: {
						select: {
							id: true,
							name: true,
							lastUsedAt: true,
							createdAt: true,
						},
					},
				},
			});

			if (!app) {
				throw new Error("App not found");
			}

			return {
				...app,
				buildGroups: app.runtimes,
			};
		},
		{
			auth: true,
		},
	)
	.patch(
		"/:id",
		async ({ params, body, user }) => {
			const app = await prisma.app.findFirst({
				where: {
					id: params.id,
					organization: {
						members: {
							some: {
								userId: user.id,
								role: {
									in: ["admin", "owner"],
								},
							},
						},
					},
				},
			});

			if (!app) {
				throw new Error("App not found or insufficient permissions");
			}

			const updatedApp = await prisma.app.update({
				where: { id: params.id },
				data: body,
				include: {
					runtimes: {
						include: {
							activeBuild: {
								include: {
									author: {
										select: { id: true, name: true, email: true },
									},
								},
							},
							builds: {
								include: {
									author: {
										select: { id: true, name: true, email: true },
									},
								},
								orderBy: { createdAt: "desc" },
							},
						},
						orderBy: { createdAt: "desc" },
					},
					tokens: {
						select: {
							id: true,
							name: true,
							lastUsedAt: true,
							createdAt: true,
						},
					},
				},
			});

			return updatedApp;
		},
		{
			body: t.Object({
				title: t.Optional(t.String()),
				slug: t.Optional(t.String()),
				saveDownloadStatistics: t.Optional(t.Boolean()),
			}),
			auth: true,
		},
	)
	.delete(
		"/:id",
		async ({ params, user }) => {
			const app = await prisma.app.findFirst({
				where: {
					id: params.id,
					organization: {
						members: {
							some: {
								userId: user.id,
								role: {
									in: ["admin", "owner"],
								},
							},
						},
					},
				},
			});

			if (!app) {
				throw new Error("App not found or insufficient permissions");
			}

			await prisma.app.delete({
				where: { id: params.id },
			});

			return { success: true };
		},
		{
			auth: true,
		},
	)
	.post(
		"/:id/transfer",
		async ({ params, body, user }) => {
			const app = await prisma.app.findFirst({
				where: {
					id: params.id,
					organization: {
						members: {
							some: {
								userId: user.id,
								role: {
									in: ["admin", "owner"],
								},
							},
						},
					},
				},
			});

			if (!app) {
				throw new Error("App not found or insufficient permissions");
			}

			const targetOrgMember = await prisma.member.findFirst({
				where: {
					organizationId: body.targetOrganizationId,
					userId: user.id,
				},
			});

			if (
				!targetOrgMember ||
				!["admin", "owner"].includes(targetOrgMember.role)
			) {
				throw new Error("Insufficient permissions on target organization");
			}

			const existingApp = await prisma.app.findFirst({
				where: {
					organizationId: body.targetOrganizationId,
					slug: app.slug,
				},
			});

			if (existingApp) {
				throw new Error(
					"An app with this slug already exists in the target organization",
				);
			}

			const updatedApp = await prisma.app.update({
				where: { id: params.id },
				data: {
					organizationId: body.targetOrganizationId,
				},
				include: {
					organization: true,
				},
			});

			return updatedApp;
		},
		{
			body: t.Object({
				targetOrganizationId: t.String(),
			}),
			auth: true,
		},
	);

export const appSigningController = new Elysia({ prefix: "/apps" })
	.use(cliAuthMiddleware)
	.patch(
		"/:id/signing-key",
		async ({ params, body, user, app }) => {
			if (!app) {
				throw new Error("App not found or insufficient permissions");
			}

			const { signingKey } = body;
			if (signingKey && !signingKey.includes("-----BEGIN")) {
				throw new Error("Invalid signing key format. Expected PEM format.");
			}

			const encryptedSigningKey = signingKey ? encrypt(signingKey) : null;

			const updatedApp = await prisma.app.update({
				where: { id: params.id },
				data: { signingKey: encryptedSigningKey },
				select: {
					id: true,
					title: true,
					slug: true,
					signingKey: true,
					createdAt: true,
					organization: true,
				},
			});

			return updatedApp;
		},
		{
			body: t.Object({
				signingKey: t.String(),
			}),
			tokenAuth: true,
		},
	);
