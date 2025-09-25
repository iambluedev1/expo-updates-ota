import { createHash, createSign } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Elysia } from "elysia";
import FormData from "form-data";
import mime from "mime";
import type { App, AppRuntime, Build } from "prisma/generated/prisma/client";
import { serializeDictionary } from "structured-headers";
import { decrypt } from "@/lib/crypto";
import prisma from "../db";
import { uploadService } from "../services/upload";

interface Asset {
	key: string;
	contentType: string;
	url: string;
	hash: string;
	fileExtension: string;
}

interface Manifest {
	id: string;
	createdAt: string;
	runtimeVersion: string;
	launchAsset: Asset;
	assets: Asset[];
	metadata: Record<string, string>;
	extra: Record<string, any>;
}

interface Directive {
	type: string;
	parameters?: Record<string, any>;
}

class NoUpdateAvailableError extends Error {}

export const expoController = new Elysia({ prefix: "/expo" })
	.get("/manifest", async ({ headers, query }) => {
		const protocolVersionMaybeArray = headers["expo-protocol-version"];
		if (protocolVersionMaybeArray && Array.isArray(protocolVersionMaybeArray)) {
			throw new Error("Unsupported protocol version. Expected either 0 or 1.");
		}
		const protocolVersion = Number.parseInt(
			protocolVersionMaybeArray ?? "0",
			10,
		);

		const platform = headers["expo-platform"] ?? query.platform;
		if (!platform || !["ios", "android"].includes(platform)) {
			throw new Error("Unsupported platform. Expected either ios or android.");
		}

		const runtimeVersion =
			headers["expo-runtime-version"] ?? query["runtime-version"];
		if (!runtimeVersion || typeof runtimeVersion !== "string") {
			throw new Error("No runtimeVersion provided.");
		}

		const currentUpdateId = headers["expo-current-update-id"];
		const embeddedUpdateId = headers["expo-embedded-update-id"];

		const appId = headers["ota-app-id"];
		if (!appId) {
			throw new Error("App ID is required");
		}

		const orgId = headers["ota-organization-id"];
		if (!orgId) {
			throw new Error("Organization ID is required");
		}

		const channel = headers["ota-channel-name"] || "production";

		const app = await prisma.app.findUnique({
			where: { id: appId, organizationId: orgId },
			include: {
				runtimes: {
					where: {
						runtimeVersion,
						platform: platform as any,
						channel,
					},
					include: {
						activeBuild: true,
					},
					take: 1,
				},
			},
		});

		if (!app) {
			throw new Error("App not found");
		}

		if (app.saveDownloadStatistics) {
			prisma.appStatsEntry
				.create({
					data: {
						appId: app.id,
						buildId: app.runtimes[0]?.activeBuild?.id,
						currentUpdateId:
							typeof currentUpdateId === "string" ? currentUpdateId : null,
						embeddedUpdateId:
							typeof embeddedUpdateId === "string" ? embeddedUpdateId : null,
						runtimeVersion,
						platform,
						channel,
					},
				})
				.catch((err) => console.error("Failed to save stats:", err));
		}

		const runtime = app.runtimes[0];

		if (!runtime) {
			console.error(`No runtime found for app ${app.id}`);
			return await sendNoUpdateAvailableDirective(
				protocolVersion,
				app.signingKey ? decrypt(app.signingKey) : null,
			);
		}

		if (runtime.isRollback) {
			if (protocolVersion === 0) {
				throw new Error("Rollbacks not supported on protocol version 0");
			}
			if (currentUpdateId === embeddedUpdateId) {
				console.log(`No update available for app ${app.id}`);
				return await sendNoUpdateAvailableDirective(
					protocolVersion,
					app.signingKey ? decrypt(app.signingKey) : null,
				);
			}
			console.log(`Runtime is a rollback for app ${app.id}`);
			return await sendRollbackDirective(
				protocolVersion,
				app.signingKey ? decrypt(app.signingKey) : null,
			);
		}

		const latestBuild = runtime.activeBuild;

		if (!latestBuild || latestBuild.isDraft) {
			console.error(
				`No active finalized build found for app ${app.id}, runtime ${runtime.id}`,
			);
			return await sendNoUpdateAvailableDirective(
				protocolVersion,
				app.signingKey ? decrypt(app.signingKey) : null,
			);
		}

		try {
			// NoUpdateAvailable directive only supported on protocol version 1
			// for protocol version 0, serve most recent update as normal
			if (protocolVersion === 1) {
				const manifestId = await generateManifestId(latestBuild, app, runtime);
				if (currentUpdateId === manifestId) {
					console.log(`No update available for app ${app.id}`);
					throw new NoUpdateAvailableError();
				}
			}

			const manifest = await generateManifest(latestBuild, app, runtime);
			return await sendManifestResponse(
				manifest,
				protocolVersion,
				app.signingKey ? decrypt(app.signingKey) : null,
			);
		} catch (maybeNoUpdateAvailableError) {
			if (maybeNoUpdateAvailableError instanceof NoUpdateAvailableError) {
				console.log(`No update available for app ${app.id}`);
				return await sendNoUpdateAvailableDirective(
					protocolVersion,
					app.signingKey ? decrypt(app.signingKey) : null,
				);
			}
			console.error(
				`Error occurred while processing request for app ${app.id}:`,
				maybeNoUpdateAvailableError,
			);
			throw maybeNoUpdateAvailableError;
		}
	})
	.get("/assets/:assetId", async ({ params }) => {
		const { assetId } = params;

		const targetAsset = await prisma.buildAsset.findUnique({
			where: { id: assetId },
			include: {
				build: {
					include: {
						appRuntime: {
							include: {
								app: true,
							},
						},
					},
				},
			},
		});

		if (!targetAsset) {
			console.error(`Asset not found: ${assetId}`);
			throw new Error("Asset not found");
		}

		if (targetAsset.build.isDraft) {
			console.error(`Asset belongs to draft build: ${targetAsset.buildId}`);
			throw new Error("Asset not available");
		}

		if (targetAsset.destination === "LOCAL") {
			const filePath = targetAsset.filePath;

			const absoluteFilePath =
				!filePath.startsWith("/") && !filePath.startsWith(process.cwd())
					? join(process.cwd(), filePath)
					: filePath;

			if (!existsSync(absoluteFilePath)) {
				console.error(`Asset file not found: ${absoluteFilePath}`);
				console.error("Asset data:", {
					id: targetAsset.id,
					type: targetAsset.type,
					originalName: targetAsset.originalName,
					filePath: targetAsset.filePath,
				});
				throw new Error("Asset file not found");
			}

			const fileContent = await readFile(absoluteFilePath);

			return new Response(fileContent as any, {
				headers: {
					"Content-Type": targetAsset.contentType,
					"Cache-Control": "public, max-age=31536000, immutable",
				},
			});
		}

		const url = await uploadService.getUrl(targetAsset.filePath);

		return new Response(null, {
			status: 302,
			headers: {
				Location: url,
			},
		});
	});

function getBase64URLEncoding(base64EncodedString: string): string {
	return base64EncodedString
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function convertSHA256HashToUUID(value: string) {
	return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
}

function convertToDictionaryItemsRepresentation(obj: {
	[key: string]: string;
}): Map<string, [string, Map<string, any>]> {
	return new Map(
		Object.entries(obj).map(([k, v]) => {
			return [k, [v, new Map()]];
		}),
	);
}

async function generateManifestId(
	build: Build,
	_app: App,
	runtime: AppRuntime,
): Promise<string> {
	const metadataString = JSON.stringify({
		id: build.id,
		runtimeVersion: runtime.runtimeVersion,
		updatedAt: build.updatedAt.toISOString(),
	});
	const hash = createHash("sha256").update(metadataString).digest("hex");
	return convertSHA256HashToUUID(hash);
}

async function generateManifest(
	build: Build,
	app: App,
	runtime: AppRuntime,
): Promise<Manifest> {
	const manifestId = await generateManifestId(build, app, runtime);

	const buildAssets = await prisma.buildAsset.findMany({
		where: { buildId: build.id },
	});

	const bundleAsset = buildAssets.find((asset) => asset.type === "BUNDLE");
	if (!bundleAsset) {
		throw new Error("No bundle found for build");
	}

	const launchAsset: Asset = {
		hash: getBase64URLEncoding(
			Buffer.from(bundleAsset.hash, "hex").toString("base64"),
		),
		key: bundleAsset.md5Key,
		fileExtension: bundleAsset.extension || ".bundle",
		contentType: bundleAsset.contentType,
		url: `${process.env.BASE_URL}/expo/assets/${bundleAsset.id}`,
	};

	const assets: Asset[] = [];
	for (const buildAsset of buildAssets) {
		if (buildAsset.type === "ASSET") {
			assets.push({
				hash: getBase64URLEncoding(
					Buffer.from(buildAsset.hash, "hex").toString("base64"),
				),
				key: buildAsset.md5Key,
				fileExtension: buildAsset.extension || "",
				contentType: buildAsset.contentType,
				url: `${process.env.BASE_URL}/expo/assets/${buildAsset.id}`,
			});
		}
	}

	return {
		id: manifestId,
		createdAt: build.updatedAt.toISOString(),
		runtimeVersion: runtime.runtimeVersion,
		launchAsset,
		assets,
		metadata: {},
		extra: {},
	};
}

async function sendManifestResponse(
	manifest: Manifest,
	protocolVersion: number,
	signingKey?: string | null,
) {
	const assetRequestHeaders: { [key: string]: object } = {};
	const form = new FormData();
	const manifestHeaders: { [key: string]: string } = {
		"content-type": "application/json; charset=utf-8",
	};

	if (signingKey) {
		const signature = await signManifest(manifest, signingKey);
		if (signature) {
			manifestHeaders["expo-signature"] = signature;
		}
	}

	form.append("manifest", JSON.stringify(manifest), {
		contentType: "application/json",
		header: manifestHeaders,
	});

	form.append("extensions", JSON.stringify({ assetRequestHeaders }), {
		contentType: "application/json",
	});

	return new Response(form.getBuffer() as any, {
		headers: {
			"Content-Type": `multipart/mixed; boundary=${form.getBoundary()}`,
			"expo-protocol-version": protocolVersion.toString(),
			"expo-sfv-version": "0",
			"cache-control": "private, max-age=0",
		},
	});
}

async function sendNoUpdateAvailableDirective(
	protocolVersion: number,
	signingKey?: string | null,
) {
	if (protocolVersion === 0) {
		throw new Error(
			"NoUpdateAvailable directive not available in protocol version 0",
		);
	}

	const directive = { type: "noUpdateAvailable" };
	return await sendDirectiveResponse(directive, protocolVersion, signingKey);
}

async function sendRollbackDirective(
	protocolVersion: number,
	signingKey?: string | null,
) {
	if (protocolVersion === 0) {
		throw new Error("Rollbacks not supported on protocol version 0");
	}

	const directive = {
		type: "rollBackToEmbedded",
		parameters: {
			commitTime: new Date().toISOString(),
		},
	};
	return await sendDirectiveResponse(directive, protocolVersion, signingKey);
}

async function sendDirectiveResponse(
	directive: Directive,
	protocolVersion: number,
	signingKey?: string | null,
) {
	const form = new FormData();

	const directiveHeaders: { [key: string]: string } = {
		"content-type": "application/json; charset=utf-8",
	};

	if (signingKey) {
		const signature = await signDirective(directive, signingKey);
		if (signature) {
			directiveHeaders["expo-signature"] = signature;
		}
	}

	form.append("directive", JSON.stringify(directive), {
		contentType: "application/json",
		header: directiveHeaders,
	});

	return new Response(form.getBuffer() as any, {
		headers: {
			"Content-Type": `multipart/mixed; boundary=${form.getBoundary()}`,
			"expo-protocol-version": protocolVersion.toString(),
			"expo-sfv-version": "0",
			"cache-control": "private, max-age=0",
		},
	});
}

async function signManifest(
	manifest: Manifest,
	signingKey: string,
): Promise<string> {
	try {
		const manifestString = JSON.stringify(manifest);
		const sign = createSign("RSA-SHA256");
		sign.update(manifestString, "utf8");
		sign.end();
		const signature = sign.sign(signingKey, "base64");

		const dictionary = convertToDictionaryItemsRepresentation({
			sig: signature,
			keyid: "main",
		});
		return serializeDictionary(dictionary);
	} catch (error) {
		console.error("Failed to sign manifest:", error);
		return "";
	}
}

async function signDirective(
	directive: Directive,
	signingKey: string,
): Promise<string> {
	try {
		const directiveString = JSON.stringify(directive);
		const sign = createSign("RSA-SHA256");
		sign.update(directiveString, "utf8");
		sign.end();
		const signature = sign.sign(signingKey, "base64");

		const dictionary = convertToDictionaryItemsRepresentation({
			sig: signature,
			keyid: "main",
		});
		return serializeDictionary(dictionary);
	} catch (error) {
		console.error("Failed to sign directive:", error);
		return "";
	}
}

function _getContentType(filename: string): string {
	return mime.getType(filename) || "application/octet-stream";
}
