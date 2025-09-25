import { createHash } from "node:crypto";
import { Elysia, t } from "elysia";
import mime from "mime";
import prisma from "../db";
import { cliAuthMiddleware } from "../lib/auth";
import { uploadService } from "../services/upload";

export const cliBuildController = new Elysia({ prefix: "/cli/builds" })
	.use(cliAuthMiddleware)
	.post(
		"/create",
		async ({ body, app, user }) => {
			if (app.id !== body.appId) {
				throw new Error("App ID mismatch with token");
			}

			const metadata = body.metadata ? JSON.parse(body.metadata) : {};
			const channel = body.channel || metadata.channel || "production";

			let appRuntime = await prisma.appRuntime.findUnique({
				where: {
					appId_runtimeVersion_platform_channel: {
						appId: body.appId,
						runtimeVersion: body.runtimeVersion,
						platform: body.platform,
						channel: channel,
					},
				},
			});

			if (!appRuntime) {
				appRuntime = await prisma.appRuntime.create({
					data: {
						appId: body.appId,
						runtimeVersion: body.runtimeVersion,
						platform: body.platform,
						channel: channel,
					},
				});
			}

			const build = await prisma.build.create({
				data: {
					appRuntimeId: appRuntime.id,
					message: body.message,
					metadata: metadata,
					authorId: user.id,
					isDraft: true,
				},
			});

			return { id: build.id, isDraft: build.isDraft };
		},
		{
			body: t.Object({
				appId: t.String(),
				runtimeVersion: t.String(),
				platform: t.Union([t.Literal("ios"), t.Literal("android")]),
				channel: t.Optional(t.String()),
				metadata: t.Optional(t.String()),
				message: t.Optional(t.String()),
			}),
			tokenAuth: true,
		},
	)
	.post(
		"/:id/upload-bundle",
		async ({ params, body, app }) => {
			const build = await prisma.build.findFirst({
				where: {
					id: params.id,
					appRuntime: { appId: app.id },
					isDraft: true,
				},
				include: { appRuntime: true },
			});

			if (!build) {
				throw new Error("Build not found, not a draft, or access denied");
			}

			const filePath = await uploadService.upload(
				body.bundle,
				app.id,
				build.id,
			);

			const buffer = await body.bundle.arrayBuffer();
			const fileBuffer = Buffer.from(buffer);
			const hash = createHash("sha256").update(fileBuffer).digest("hex");
			const md5Key = createHash("md5").update(fileBuffer).digest("hex");

			const asset = await prisma.buildAsset.create({
				data: {
					buildId: build.id,
					type: "BUNDLE",
					filePath,
					originalName: body.bundle.name || "bundle.js",
					extension: ".bundle",
					contentType: "application/javascript",
					fileSize: fileBuffer.length,
					hash,
					md5Key,
					destination: process.env.UPLOAD_PROVIDER === "local" ? "LOCAL" : "S3",
				},
			});

			return { id: asset.id, type: asset.type, hash: asset.hash };
		},
		{
			body: t.Object({
				bundle: t.File(),
			}),
			tokenAuth: true,
		},
	)
	.post(
		"/:id/upload-asset",
		async ({ params, body, app }) => {
			const build = await prisma.build.findFirst({
				where: {
					id: params.id,
					appRuntime: { appId: app.id },
					isDraft: true,
				},
				include: { appRuntime: true },
			});

			if (!build) {
				throw new Error("Build not found, not a draft, or access denied");
			}

			const filePath = await uploadService.upload(body.asset, app.id, build.id);

			const buffer = await body.asset.arrayBuffer();
			const fileBuffer = Buffer.from(buffer);
			const hash = createHash("sha256").update(fileBuffer).digest("hex");
			const md5Key = createHash("md5").update(fileBuffer).digest("hex");

			const extension = `.${body.extension}`;
			const contentType = mime.getType(extension) || "application/octet-stream";

			const asset = await prisma.buildAsset.create({
				data: {
					buildId: build.id,
					type: "ASSET",
					filePath,
					originalName: body.path,
					extension,
					contentType,
					fileSize: fileBuffer.length,
					hash,
					md5Key,
					destination: process.env.UPLOAD_PROVIDER === "local" ? "LOCAL" : "S3",
				},
			});

			return {
				id: asset.id,
				path: asset.originalName,
				extension: asset.extension,
				hash: asset.hash,
			};
		},
		{
			body: t.Object({
				asset: t.File(),
				path: t.String(),
				extension: t.String(),
			}),
			tokenAuth: true,
		},
	)
	.post(
		"/:id/finalize",
		async ({ params, body, app }) => {
			const build = await prisma.build.findFirst({
				where: {
					id: params.id,
					appRuntime: { appId: app.id },
					isDraft: true,
				},
				include: {
					appRuntime: true,
					assets: true,
				},
			});

			if (!build) {
				throw new Error("Build not found, not a draft, or access denied");
			}

			const hasBundle = build.assets.some((asset) => asset.type === "BUNDLE");
			if (!hasBundle) {
				throw new Error("Build must have at least a bundle before finalizing");
			}

			const finalizedBuild = await prisma.build.update({
				where: { id: build.id },
				data: { isDraft: false },
			});

			if (body.activate) {
				await prisma.appRuntime.update({
					where: { id: build.appRuntimeId },
					data: { activeBuildId: build.id, isRollback: false },
				});
			}

			return {
				id: finalizedBuild.id,
				isDraft: finalizedBuild.isDraft,
				wasActivated: !!body.activate,
				assetsCount: build.assets.length,
			};
		},
		{
			body: t.Object({
				activate: t.Optional(t.Boolean()),
			}),
			tokenAuth: true,
		},
	)
	.get(
		"/",
		async ({ app, query }) => {
			const appId = query.appId || app.id;

			if (appId !== app.id) {
				throw new Error("Access denied to this app");
			}

			const appRuntimes = await prisma.appRuntime.findMany({
				where: { appId },
				include: {
					activeBuild: {
						include: {
							author: {
								select: { id: true, name: true, email: true },
							},
							assets: true,
						},
					},
					builds: {
						where: { isDraft: false },
						include: {
							author: {
								select: { id: true, name: true, email: true },
							},
							assets: true,
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
				appId: t.Optional(t.String()),
			}),
			tokenAuth: true,
		},
	)
	.get(
		"/channels",
		async ({ app }) => {
			const channels = await prisma.appRuntime.findMany({
				where: { appId: app.id },
				select: { channel: true },
				distinct: ["channel"],
				orderBy: { channel: "asc" },
			});

			return channels.map((runtime) => runtime.channel);
		},
		{
			tokenAuth: true,
		},
	)
	.patch(
		"/:id/activate",
		async ({ params, app, user }) => {
			const build = await prisma.build.findFirst({
				where: {
					id: params.id,
					appRuntime: { appId: app.id },
					isDraft: false,
				},
				include: {
					appRuntime: true,
				},
			});

			if (!build) {
				throw new Error("Build not found, not finalized, or access denied");
			}

			const updatedRuntime = await prisma.appRuntime.update({
				where: { id: build.appRuntimeId },
				data: { activeBuildId: build.id, isRollback: false },
			});

			return { success: true, runtime: updatedRuntime };
		},
		{ tokenAuth: true },
	);
