import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { treaty } from "@elysiajs/eden";
import { bold, cyan, green, red } from "picocolors";
import type { Argv } from "yargs";
import type { ServerApp } from "@/server";
import { logger } from "../logger";

type AuthArgv = {};

export const command = "auth";
export const describe = "Authenticate with the Expo Updates server";
export const aliases = ["a"];

export function builder(yargs: Argv<AuthArgv>): Argv {
	return yargs;
}

export async function handler() {
	try {
		const serverUrl = await logger.prompt(
			cyan("Enter the Expo Updates server URL:"),
			{
				type: "text",
				placeholder: "http://localhost:3000",
			},
		);

		if (!serverUrl) {
			logger.error(red("Server URL is required"));
			return;
		}

		const accessToken = await logger.prompt(cyan("Enter your access token:"), {
			type: "text",
		});

		if (!accessToken) {
			logger.error(red("Access token is required"));
			return;
		}

		logger.info("Validating access token...");

		try {
			const client = treaty<ServerApp>(serverUrl);

			const response = await client.api["token-auth"].validate.get({
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			});

			if (response.error) {
				logger.error(red("Invalid access token or server error"));
				return;
			}

			const data = response.data;
			logger.success(green("Authentication successful!"));
			logger.info(
				`Organization: ${bold(data.organization.name)} (ID: ${data.organization.id})`,
			);
			logger.info(`App: ${bold(data.app.name)} (ID: ${data.app.id})`);
		} catch (error: unknown) {
			logger.error(
				red(
					`Failed to validate access token: ${error instanceof Error ? error.message : "Unknown error"}`,
				),
			);
			return;
		}

		const envFiles = [".env", ".env.local"];
		let envFile = envFiles.find((file) =>
			existsSync(join(process.cwd(), file)),
		);

		if (!envFile) {
			const selectedFile = await logger.prompt(
				cyan("No .env file found. What should the env file be named?"),
				{
					type: "text",
					placeholder: ".env",
				},
			);
			envFile = selectedFile || ".env";
		}

		const envPath = join(process.cwd(), envFile);

		let envContent = "";
		if (existsSync(envPath)) {
			envContent = readFileSync(envPath, "utf-8");
		}

		const serverUrlKey = "EXPO_UPDATES_APP_URL";
		const accessTokenKey = "EXPO_UPDATES_ACCESS_TOKEN";

		envContent = envContent
			.split("\n")
			.filter(
				(line) =>
					!line.startsWith(`${serverUrlKey}=`) &&
					!line.startsWith(`${accessTokenKey}=`),
			)
			.join("\n");

		if (envContent && !envContent.endsWith("\n")) {
			envContent += "\n";
		}
		envContent += `${serverUrlKey}=${serverUrl}\n`;
		envContent += `${accessTokenKey}=${accessToken}\n`;

		writeFileSync(envPath, envContent);

		logger.success(green(`Credentials saved to ${bold(envFile)}`));
		logger.info("You can now use the init command to configure your Expo app");
	} catch (error: unknown) {
		logger.error(
			red(
				`Authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			),
		);
	}
}
