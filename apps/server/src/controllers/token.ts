import { Elysia, t } from "elysia";
import prisma from "../db";
import { authMiddleware } from "../lib/auth";
import { generateToken } from "../utils/token";

export const tokenController = new Elysia({ prefix: "/tokens" })
	.use(authMiddleware)
	.get(
		"/",
		async ({ user, query }) => {
			const appId = query.appId;

			if (!appId) {
				throw new Error("App ID is required");
			}

			const app = await prisma.app.findFirst({
				where: {
					id: appId,
					organization: {
						members: {
							some: {
								userId: user.id,
							},
						},
					},
				},
			});

			if (!app) {
				throw new Error("App not found");
			}

			const tokens = await prisma.appToken.findMany({
				where: { appId },
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
				},
				orderBy: { createdAt: "desc" },
			});

			return tokens;
		},
		{
			query: t.Object({
				appId: t.String(),
			}),
			auth: true,
		},
	)
	.post(
		"/",
		async ({ body, user }) => {
			const app = await prisma.app.findFirst({
				where: {
					id: body.appId,
					organization: {
						members: {
							some: {
								userId: user.id,
							},
						},
					},
				},
			});

			if (!app) {
				throw new Error("App not found");
			}

			const token = generateToken();

			const appToken = await prisma.appToken.create({
				data: {
					name: body.name,
					token,
					userId: user.id,
					appId: body.appId,
				},
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
				},
			});

			return { ...appToken, token };
		},
		{
			body: t.Object({
				name: t.String(),
				appId: t.String(),
			}),
			auth: true,
		},
	)
	.patch(
		"/:id",
		async ({ params, body, user }) => {
			const token = await prisma.appToken.findFirst({
				where: {
					id: params.id,
					app: {
						organization: {
							members: {
								some: {
									userId: user.id,
								},
							},
						},
					},
				},
			});

			if (!token) {
				throw new Error("Token not found");
			}

			const updatedToken = await prisma.appToken.update({
				where: { id: params.id },
				data: { name: body.name },
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
				},
			});

			return updatedToken;
		},
		{
			body: t.Object({
				name: t.String(),
			}),
			auth: true,
		},
	)
	.delete(
		"/:id",
		async ({ params, user }) => {
			const token = await prisma.appToken.findFirst({
				where: {
					id: params.id,
					app: {
						organization: {
							members: {
								some: {
									userId: user.id,
								},
							},
						},
					},
				},
			});

			if (!token) {
				throw new Error("Token not found");
			}

			await prisma.appToken.delete({
				where: { id: params.id },
			});

			return { success: true };
		},
		{
			auth: true,
		},
	);
