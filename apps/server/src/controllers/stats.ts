import { Elysia, t } from "elysia";
import prisma from "../db";
import { authMiddleware } from "../lib/auth";

export const statsController = new Elysia({ prefix: "/stats" })
	.use(authMiddleware)
	.get(
		"/app/:appId",
		async ({ params, user, query }) => {
			const app = await prisma.app.findFirst({
				where: {
					id: params.appId,
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

			const { days = 30 } = query;
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - days);

			const entries = await prisma.appStatsEntry.findMany({
				where: {
					appId: params.appId,
					createdAt: {
						gte: startDate,
					},
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			const totalDownloads = entries.length;

			const byRuntimeVersion = entries.reduce(
				(acc, entry) => {
					const key = entry.runtimeVersion;
					if (!acc[key]) {
						acc[key] = { count: 0, platforms: { ios: 0, android: 0 } };
					}
					acc[key].count++;
					if (entry.platform === "ios" || entry.platform === "android") {
						acc[key].platforms[entry.platform]++;
					}
					return acc;
				},
				{} as Record<
					string,
					{ count: number; platforms: { ios: number; android: number } }
				>,
			);

			const byChannel = entries.reduce(
				(acc, entry) => {
					const key = entry.channel;
					acc[key] = (acc[key] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>,
			);

			const byPlatform = entries.reduce(
				(acc, entry) => {
					const key = entry.platform;
					acc[key] = (acc[key] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>,
			);

			const updateTypeDistribution = entries.reduce(
				(acc, entry) => {
					if (
						entry.embeddedUpdateId &&
						entry.currentUpdateId === entry.embeddedUpdateId
					) {
						acc.native++;
					} else if (
						entry.currentUpdateId &&
						entry.currentUpdateId !== entry.embeddedUpdateId
					) {
						acc.ota++;
					} else {
						acc.unknown++;
					}
					return acc;
				},
				{ native: 0, ota: 0, unknown: 0 },
			);

			const timeline = entries.reduce(
				(acc, entry) => {
					const date = entry.createdAt.toISOString().split("T")[0];
					if (!acc[date]) {
						acc[date] = 0;
					}
					acc[date]++;
					return acc;
				},
				{} as Record<string, number>,
			);

			const byBuild = entries.reduce(
				(acc, entry) => {
					if (!entry.buildId) return acc;
					if (!acc[entry.buildId]) {
						acc[entry.buildId] = {
							count: 0,
							platforms: { ios: 0, android: 0 },
						};
					}
					acc[entry.buildId].count++;
					if (entry.platform === "ios" || entry.platform === "android") {
						acc[entry.buildId].platforms[entry.platform]++;
					}
					return acc;
				},
				{} as Record<
					string,
					{ count: number; platforms: { ios: number; android: 0 } }
				>,
			);

			const buildIds = Object.keys(byBuild);
			const builds = await prisma.build.findMany({
				where: {
					id: { in: buildIds },
				},
				select: {
					id: true,
					message: true,
					createdAt: true,
					appRuntime: {
						select: {
							runtimeVersion: true,
							platform: true,
							channel: true,
						},
					},
				},
			});

			const byBuildWithDetails = builds.map((build) => ({
				buildId: build.id,
				message: build.message,
				createdAt: build.createdAt,
				runtimeVersion: build.appRuntime.runtimeVersion,
				platform: build.appRuntime.platform,
				channel: build.appRuntime.channel,
				count: byBuild[build.id].count,
				platforms: byBuild[build.id].platforms,
			}));

			return {
				totalDownloads,
				byRuntimeVersion,
				byChannel,
				byPlatform,
				updateTypeDistribution,
				timeline,
				byBuild: byBuildWithDetails,
			};
		},
		{
			query: t.Object({
				days: t.Optional(t.Number()),
			}),
			auth: true,
		},
	)
	.get(
		"/build/:buildId",
		async ({ params, user, query }) => {
			const build = await prisma.build.findFirst({
				where: {
					id: params.buildId,
				},
				include: {
					appRuntime: {
						include: {
							app: {
								include: {
									organization: {
										include: {
											members: {
												where: {
													userId: user.id,
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});

			if (!build || build.appRuntime.app.organization.members.length === 0) {
				throw new Error("Build not found");
			}

			const { days = 30 } = query;
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - days);

			const entries = await prisma.appStatsEntry.findMany({
				where: {
					buildId: params.buildId,
					createdAt: {
						gte: startDate,
					},
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			const totalDownloads = entries.length;

			const byPlatform = entries.reduce(
				(acc, entry) => {
					const key = entry.platform;
					acc[key] = (acc[key] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>,
			);

			const byChannel = entries.reduce(
				(acc, entry) => {
					const key = entry.channel;
					acc[key] = (acc[key] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>,
			);

			const timeline = entries.reduce(
				(acc, entry) => {
					const date = entry.createdAt.toISOString().split("T")[0];
					if (!acc[date]) {
						acc[date] = 0;
					}
					acc[date]++;
					return acc;
				},
				{} as Record<string, number>,
			);

			return {
				build: {
					id: build.id,
					message: build.message,
					createdAt: build.createdAt,
					runtimeVersion: build.appRuntime.runtimeVersion,
					platform: build.appRuntime.platform,
				},
				totalDownloads,
				byPlatform,
				byChannel,
				timeline,
			};
		},
		{
			query: t.Object({
				days: t.Optional(t.Number()),
			}),
			auth: true,
		},
	);
