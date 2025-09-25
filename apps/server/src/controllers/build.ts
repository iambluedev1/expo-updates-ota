import { Elysia, t } from "elysia";
import prisma from "../db";
import { authMiddleware } from "../lib/auth";
import { uploadService } from "../services/upload";

export const buildController = new Elysia({ prefix: "/builds" })
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

			const appRuntimes = await prisma.appRuntime.findMany({
				where: { appId },
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
			});

			return appRuntimes;
		},
		{
			query: t.Object({
				appId: t.String(),
			}),
			auth: true,
		},
	)
	.get(
		"/:id",
		async ({ params, user }) => {
			const build = await prisma.build.findFirst({
				where: {
					id: params.id,
					appRuntime: {
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
				},
				include: {
					appRuntime: {
						include: {
							app: true,
						},
					},
					author: {
						select: { id: true, name: true, email: true },
					},
				},
			});

			if (!build) {
				throw new Error("Build not found");
			}

			return build;
		},
		{ auth: true },
	)
	.patch(
		"/:id/activate",
		async ({ params, user }) => {
			const build = await prisma.build.findFirst({
				where: {
					id: params.id,
					appRuntime: {
						app: {
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
					},
				},
				include: {
					appRuntime: true,
				},
			});

			if (!build) {
				throw new Error("Build not found or insufficient permissions");
			}

			await prisma.appRuntime.update({
				where: { id: build.appRuntimeId },
				data: {
					activeBuildId: build.id,
					isRollback: false,
				},
			});

			await prisma.build.updateMany({
				where: {
					appRuntimeId: build.appRuntimeId,
				},
				data: {
					updatedAt: new Date(),
				},
			});

			return build;
		},
		{
			auth: true,
		},
	)
	.patch(
		"/:id/rollback",
		async ({ params, user }) => {
			const build = await prisma.build.findFirst({
				where: {
					id: params.id,
					appRuntime: {
						app: {
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
					},
				},
				include: {
					appRuntime: true,
				},
			});

			if (!build) {
				throw new Error("Build not found or insufficient permissions");
			}

			await prisma.appRuntime.update({
				where: { id: build.appRuntimeId },
				data: {
					isRollback: true,
					activeBuildId: null,
				},
			});

			await prisma.build.updateMany({
				where: {
					appRuntimeId: build.appRuntimeId,
				},
				data: {
					updatedAt: new Date(),
				},
			});

			return build;
		},
		{
			auth: true,
		},
	)
	.patch(
		"/runtime/:runtimeId/rollback-to-embedded",
		async ({ params, user }) => {
			const appRuntime = await prisma.appRuntime.findFirst({
				where: {
					id: params.runtimeId,
					app: {
						organization: {
							members: {
								some: {
									userId: user.id,
									role: "ADMIN",
								},
							},
						},
					},
				},
			});

			if (!appRuntime) {
				throw new Error("Runtime not found or insufficient permissions");
			}

			const updatedRuntime = await prisma.appRuntime.update({
				where: { id: params.runtimeId },
				data: {
					isRollback: true,
					activeBuildId: null,
				},
			});

			return updatedRuntime;
		},
		{
			auth: true,
		},
	)
	.delete(
		"/:id",
		async ({ params, user }) => {
			const build = await prisma.build.findFirst({
				where: {
					id: params.id,
					appRuntime: {
						app: {
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
					},
				},
				include: {
					appRuntime: true,
					assets: true,
				},
			});

			if (!build) {
				throw new Error("Build not found or insufficient permissions");
			}

			if (build.appRuntime.activeBuildId === build.id) {
				await prisma.appRuntime.update({
					where: { id: build.appRuntimeId },
					data: { activeBuildId: null },
				});
			}

			try {
				await Promise.all(
					build.assets.map((asset) => uploadService.delete(asset.filePath)),
				);
			} catch (error: any) {
				console.error("Failed to delete build files:", error);
			}

			await prisma.build.delete({
				where: { id: params.id },
			});

			return { success: true };
		},
		{ auth: true },
	);
