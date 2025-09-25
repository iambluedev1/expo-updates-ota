import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { treaty } from "@elysiajs/eden";
import { config } from "dotenv";
import { bold, cyan, green, red, yellow } from "picocolors";
import type { Argv } from "yargs";
import type { ServerApp } from "@/server";
import { logger } from "../logger";

interface PublishArgv {
	channel?: string;
	platform?: "ios" | "android";
	message?: string;
}

async function retryRequest<T>(
	fn: () => Promise<T>,
	maxRetries = 3,
	delayMs = 1000,
): Promise<T> {
	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error as Error;
			const isNetworkError =
				error instanceof Error &&
				(error.message.includes("ECONNRESET") ||
					error.message.includes("fetch failed") ||
					error.message.includes("network") ||
					error.message.includes("ETIMEDOUT"));

			if (isNetworkError && attempt < maxRetries) {
				logger.warn(
					yellow(`Network error, retrying (${attempt}/${maxRetries})...`),
				);
				await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
				continue;
			}

			throw error;
		}
	}

	throw lastError;
}

export const command = "publish";
export const describe = "Publish your Expo app to the updates server";
export const aliases = ["p"];

export function builder(yargs: Argv<PublishArgv>): Argv {
	return yargs
		.option("channel", {
			type: "string",
			alias: "c",
			describe: "Channel to publish to",
		})
		.option("platform", {
			type: "string",
			choices: ["ios", "android"] as const,
			alias: "p",
			describe: "Platform to publish (ios, android, or both if not specified)",
		})
		.option("message", {
			type: "string",
			alias: "m",
			describe: "Build message (like a commit message)",
		});
}

export async function handler(argv: PublishArgv) {
	try {
		config();

		const serverUrl = process.env.EXPO_UPDATES_APP_URL;
		const accessToken = process.env.EXPO_UPDATES_ACCESS_TOKEN;

		if (!serverUrl || !accessToken) {
			logger.error(
				red("Please run the auth command first to set up your credentials"),
			);
			return;
		}

		const client = treaty<ServerApp>(serverUrl);

		const tokenResponse = await client.api["token-auth"].validate.get({
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		if (tokenResponse.error) {
			logger.error(red("Failed to validate token"));
			return;
		}

		const appId = tokenResponse.data.app.id;

		const appJsonPath = join(process.cwd(), "app.json");
		if (!existsSync(appJsonPath)) {
			logger.error(red("app.json not found in project root"));
			return;
		}

		const appConfig = JSON.parse(readFileSync(appJsonPath, "utf-8"));
		const channelFromAppJson =
			appConfig?.expo?.updates?.requestHeaders?.["ota-channel-name"];

		let channel = argv.channel;
		if (!channel) {
			let existingChannels: string[] = [];

			try {
				const channelsResponse = await client.api.cli.builds.channels.get({
					headers: {
						Authorization: `Bearer ${accessToken}`,
					},
				});

				if (!channelsResponse.error && channelsResponse.data) {
					existingChannels = channelsResponse.data;
				}
			} catch (_error) {
				logger.warn(
					yellow(
						"Failed to fetch existing channels, proceeding with manual input",
					),
				);
			}

			if (existingChannels.length > 0 || channelFromAppJson) {
				const choices = [...existingChannels];

				if (
					channelFromAppJson &&
					!existingChannels.includes(channelFromAppJson)
				) {
					choices.unshift(`🎯 ${channelFromAppJson} (from your app.json)`);
				}

				choices.push("✏️  Enter custom channel");

				if (
					!existingChannels.includes("production") &&
					channelFromAppJson !== "production"
				) {
					choices.push("📦 production (default)");
				}

				const selectedChannel = await logger.prompt(cyan("Select a channel:"), {
					type: "select",
					options: choices,
				});

				if (selectedChannel === "✏️  Enter custom channel") {
					channel = await logger.prompt(cyan("Enter custom channel name:"), {
						type: "text",
						placeholder: "my-custom-channel",
					});
				} else if (selectedChannel === "📦 production (default)") {
					channel = "production";
				} else if (
					selectedChannel.startsWith("🎯 ") &&
					selectedChannel.includes(" (from your app.json)")
				) {
					channel = channelFromAppJson;
				} else {
					channel = selectedChannel;
				}
			} else {
				channel = await logger.prompt(cyan("Enter channel name (optional):"), {
					type: "text",
					placeholder: "production",
				});
			}
		}

		let message = argv.message;
		if (!message) {
			message = await logger.prompt(cyan("Enter build message (optional):"), {
				type: "text",
				placeholder: "Build description...",
			});
		}

		let platforms: ("ios" | "android")[];
		if (argv.platform) {
			platforms = [argv.platform];
		} else {
			const platformChoice = await logger.prompt(
				cyan("Select platform(s) to publish:"),
				{
					type: "select",
					options: ["📱 iOS", "🤖 Android", "🚀 Both (iOS + Android)"],
				},
			);

			if (platformChoice === "📱 iOS") {
				platforms = ["ios"];
			} else if (platformChoice === "🤖 Android") {
				platforms = ["android"];
			} else {
				platforms = ["ios", "android"];
			}
		}

		logger.info(`Publishing to platforms: ${platforms.join(", ")}`);
		if (channel) {
			logger.info(`Channel: ${bold(channel)}`);
		}

		const distPath = join(process.cwd(), "dist");

		if (existsSync(distPath)) {
			logger.info("Removing existing dist folder...");
			rmSync(distPath, { recursive: true, force: true });
		}

		let exportCommand = "npx expo export";
		if (platforms.length === 1) {
			exportCommand += ` --platform ${platforms[0]}`;
			logger.info(`Running expo export for ${platforms[0]}...`);
		} else {
			logger.info("Running expo export for all platforms...");
		}

		try {
			execSync(exportCommand, {
				stdio: "inherit",
				cwd: process.cwd(),
			});
		} catch (error) {
			logger.error(red("Failed to run expo export"));
			throw error;
		}

		const metadataPath = join(distPath, "metadata.json");
		if (!existsSync(metadataPath)) {
			logger.error(red("metadata.json not found in dist folder"));
			return;
		}

		const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
		logger.info("Metadata loaded successfully");

		const runtimeVersions = new Map<string, string>();
		for (const platform of platforms) {
			const runtimeVersion = await getRuntimeVersion(appConfig, platform);
			runtimeVersions.set(platform, runtimeVersion);
			logger.info(`Runtime version for ${platform}: ${bold(runtimeVersion)}`);
		}

		for (const platform of platforms) {
			const platformData = metadata.fileMetadata[platform];
			if (!platformData) {
				logger.warn(yellow(`No data found for platform: ${platform}`));
				continue;
			}

			const runtimeVersion = runtimeVersions.get(platform)!;
			logger.info(`Processing ${platform} build...`);

			const bundlePath = join(distPath, platformData.bundle);
			if (!existsSync(bundlePath)) {
				logger.error(red(`Bundle file not found: ${bundlePath}`));
				continue;
			}

			const assetFiles: File[] = [];
			for (const asset of platformData.assets) {
				const assetPath = join(distPath, asset.path);
				if (existsSync(assetPath)) {
					const assetBuffer = readFileSync(assetPath);
					const file = new File([assetBuffer], asset.path, {
						type: getContentType(asset.ext),
					});
					assetFiles.push(file);
				} else {
					logger.warn(yellow(`Asset file not found: ${assetPath}`));
				}
			}

			const bundleBuffer = readFileSync(bundlePath);

			const bundleFile = new File([bundleBuffer], platformData.bundle, {
				type: "application/javascript",
			});

			logger.info(`Publishing ${platform} build...`);
			try {
				logger.info("Creating build...");
				const createResponse = await retryRequest(() =>
					client.api.cli.builds.create.post(
						{
							appId,
							runtimeVersion,
							platform: platform as "ios" | "android",
							channel: channel || "production",
							message: message || undefined,
							metadata: JSON.stringify({
								exportedAt: new Date().toISOString(),
								fileMetadata: platformData,
							}),
						},
						{
							headers: {
								Authorization: `Bearer ${accessToken}`,
							},
						},
					),
				);

				if (createResponse.error) {
					throw new Error(
						`Failed to create build: ${JSON.stringify(createResponse.error)}`,
					);
				}

				const buildId = createResponse.data.id;
				logger.success(green(`✓ Build created: ${bold(buildId)}`));

				logger.info("Uploading bundle...");
				const bundleResponse = await retryRequest(() =>
					client.api.cli.builds({ id: buildId })["upload-bundle"].post(
						{ bundle: bundleFile },
						{
							headers: {
								Authorization: `Bearer ${accessToken}`,
							},
						},
					),
				);

				if (bundleResponse.error) {
					throw new Error(
						`Failed to upload bundle: ${JSON.stringify(bundleResponse.error)}`,
					);
				}

				logger.success(green("✓ Bundle uploaded"));

				if (assetFiles.length > 0) {
					logger.info(`Uploading ${assetFiles.length} assets...`);

					for (let i = 0; i < assetFiles.length; i++) {
						const assetFile = assetFiles[i];
						if (!assetFile) continue;

						const assetPath = assetFile.name.replace(`${distPath}/`, "");
						const assetMetadata = platformData.assets.find(
							(meta: any) => meta.path === assetPath,
						);

						if (!assetMetadata) {
							logger.warn(
								yellow(
									`⚠ No metadata found for asset: ${assetPath}, skipping...`,
								),
							);
							continue;
						}

						logger.info(
							`Uploading asset ${i + 1}/${assetFiles.length}: ${assetPath}...`,
						);

						const assetsResponse = await retryRequest(() =>
							client.api.cli.builds({ id: buildId })["upload-asset"].post(
								{
									asset: assetFile,
									path: assetMetadata.path,
									extension: assetMetadata.ext,
								},
								{
									headers: {
										Authorization: `Bearer ${accessToken}`,
									},
								},
							),
						);

						if (assetsResponse.error) {
							throw new Error(
								`Failed to upload asset ${assetPath}: ${JSON.stringify(assetsResponse.error)}`,
							);
						}

						logger.info(`✓ Uploaded ${assetPath}`);
					}

					logger.success(green(`✓ All ${assetFiles.length} assets uploaded`));
				}

				logger.info("Finalizing build...");
				const shouldActivate = await logger.prompt(
					cyan(`Do you want to activate this ${platform} build now?`),
					{
						type: "confirm",
						initial: true,
					},
				);

				const finalizeResponse = await retryRequest(() =>
					client.api.cli.builds({ id: buildId }).finalize.post(
						{ activate: shouldActivate },
						{
							headers: {
								Authorization: `Bearer ${accessToken}`,
							},
						},
					),
				);

				if (finalizeResponse.error) {
					throw new Error(
						`Failed to finalize build: ${JSON.stringify(finalizeResponse.error)}`,
					);
				}

				logger.success(green(`✓ ${platform} build published successfully!`));
				logger.info(`Build ID: ${bold(buildId)}`);
				logger.info(`Assets: ${finalizeResponse.data.assetsCount}`);

				if (finalizeResponse.data.wasActivated) {
					logger.success(green("✓ Build activated and live!"));
				} else {
					logger.info(yellow("Build created but not activated"));
				}
			} catch (error) {
				logger.error(
					red(
						`Failed to publish ${platform} build: ${error instanceof Error ? error.message : "Unknown error"}`,
					),
					error,
				);
			}
		}

		if (existsSync(distPath)) {
			logger.info("Cleaning up dist folder...");
			rmSync(distPath, { recursive: true, force: true });
		}

		logger.success(green("Publish completed!"));
	} catch (error: unknown) {
		logger.error(
			red(
				`Publish failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			),
		);
	}
}

async function getRuntimeVersion(
	appConfig: any,
	platform: "ios" | "android",
): Promise<string> {
	const expo = appConfig.expo || appConfig;
	const runtimeVersion = expo.runtimeVersion;

	if (typeof runtimeVersion === "string") {
		return runtimeVersion;
	}

	if (typeof runtimeVersion === "object" && runtimeVersion.policy) {
		const policy = runtimeVersion.policy;

		switch (policy) {
			case "appVersion":
				return expo.version || "1.0.0";

			case "nativeVersion": {
				const version = expo.version || "1.0.0";

				if (platform === "ios") {
					const iosBuildNumber = expo.ios?.buildNumber || "1";
					return `${version}(${iosBuildNumber})`;
				}
				const androidVersionCode = expo.android?.versionCode || "1";
				return `${version}(${androidVersionCode})`;
			}

			case "fingerprint":
				try {
					logger.info(`Generating fingerprint for ${platform}...`);
					const fingerprintOutput = execSync(
						`npx @expo/fingerprint fingerprint:generate --platform ${platform}`,
						{
							encoding: "utf-8",
							cwd: process.cwd(),
						},
					);
					const fingerprint = JSON.parse(fingerprintOutput);
					return fingerprint.hash;
				} catch (_error) {
					logger.warn(
						yellow(
							`Failed to generate fingerprint for ${platform}, falling back to app version`,
						),
					);
					return expo.version || "1.0.0";
				}

			default:
				logger.warn(
					yellow(
						`Unknown runtime version policy: ${policy}, using app version`,
					),
				);
				return expo.version || "1.0.0";
		}
	}

	return expo.version || "1.0.0";
}

function getContentType(ext: string): string {
	const contentTypes: Record<string, string> = {
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		gif: "image/gif",
		svg: "image/svg+xml",
		ttf: "font/ttf",
		otf: "font/otf",
		woff: "font/woff",
		woff2: "font/woff2",
		js: "application/javascript",
		json: "application/json",
	};
	return contentTypes[ext] || "application/octet-stream";
}
