import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { treaty } from "@elysiajs/eden";
import { config } from "dotenv";
import { bold, cyan, green, red, yellow } from "picocolors";
import type { Argv } from "yargs";
import type { ServerApp } from "@/server";
import { logger } from "../logger";

interface ChannelArgv {
	channel?: string;
}

export const command = "channel";
export const describe = "Set the default channel for your Expo app";
export const aliases = ["ch"];

export function builder(yargs: Argv<ChannelArgv>): Argv {
	return yargs.option("channel", {
		type: "string",
		alias: "c",
		describe: "Channel name to set as default",
	});
}

export async function handler(argv: ChannelArgv) {
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

		const appJsonPath = join(process.cwd(), "app.json");
		if (!existsSync(appJsonPath)) {
			logger.error(red("app.json not found in project root"));
			return;
		}

		const appConfig = JSON.parse(readFileSync(appJsonPath, "utf-8"));

		const client = treaty<ServerApp>(serverUrl);

		let selectedChannel = argv.channel;
		if (!selectedChannel) {
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

			if (existingChannels.length > 0) {
				const choices = [...existingChannels, "✏️  Enter custom channel"];

				if (!existingChannels.includes("production")) {
					choices.push("📦 production (default)");
				}

				const selectedOption = await logger.prompt(
					cyan("Select a channel to set as default:"),
					{
						type: "select",
						options: choices,
					},
				);

				if (selectedOption === "✏️  Enter custom channel") {
					selectedChannel = await logger.prompt(
						cyan("Enter custom channel name:"),
						{
							type: "text",
							placeholder: "my-custom-channel",
						},
					);
				} else if (selectedOption === "📦 production (default)") {
					selectedChannel = "production";
				} else {
					selectedChannel = selectedOption;
				}
			} else {
				selectedChannel = await logger.prompt(cyan("Enter channel name:"), {
					type: "text",
					placeholder: "production",
				});
			}
		}

		if (!selectedChannel) {
			selectedChannel = "production";
		}

		if (!appConfig.expo) {
			appConfig.expo = {};
		}
		if (!appConfig.expo.updates) {
			appConfig.expo.updates = {};
		}
		if (!appConfig.expo.updates.requestHeaders) {
			appConfig.expo.updates.requestHeaders = {};
		}

		appConfig.expo.updates.requestHeaders["ota-channel-name"] = selectedChannel;

		writeFileSync(appJsonPath, `${JSON.stringify(appConfig, null, 2)}\n`);

		logger.success(green(`✓ Default channel set to: ${bold(selectedChannel)}`));
		logger.info(
			`Updated app.json with expo.updates.requestHeaders["ota-channel-name"]`,
		);
		logger.info(
			yellow(
				"Note: You may need to rebuild your app for this change to take effect in production.",
			),
		);
	} catch (error: unknown) {
		logger.error(
			red(
				`Channel command failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			),
		);
	}
}
