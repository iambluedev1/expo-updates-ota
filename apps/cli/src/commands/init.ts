import { exec } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { treaty } from "@elysiajs/eden";
import { config } from "dotenv";
import { bold, cyan, green, red, yellow } from "picocolors";
import type { Argv } from "yargs";
import type { ServerApp } from "@/server";
import { logger } from "../logger";

const execAsync = promisify(exec);

type InitArgv = {};

export const command = "init";
export const describe = "Initialize Expo Updates configuration in app.json";
export const aliases = ["i"];

export function builder(yargs: Argv<InitArgv>): Argv {
	return yargs;
}

export async function handler() {
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

		logger.info("Fetching app and organization information...");

		let appId: string;
		let organizationId: string;

		try {
			const client = treaty<ServerApp>(serverUrl);
			const response = await client.api["token-auth"].validate.get({
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			});

			if (response.error) {
				logger.error(
					red(
						"Failed to validate access token. Please run auth command again.",
					),
				);
				return;
			}

			const data = response.data;
			appId = data.app.id;
			organizationId = data.organization.id;

			logger.success(
				green(
					`Found app: ${bold(data.app.name)} in organization: ${bold(data.organization.name)}`,
				),
			);
		} catch (error: unknown) {
			logger.error(
				red(
					`Failed to connect to server: ${error instanceof Error ? error.message : "Unknown error"}`,
				),
			);
			return;
		}

		const appJsonPath = join(process.cwd(), "app.json");
		if (!existsSync(appJsonPath)) {
			logger.error(red("app.json not found in current directory"));
			return;
		}

		let appConfig = null;

		try {
			const appJsonContent = readFileSync(appJsonPath, "utf-8");
			appConfig = JSON.parse(appJsonContent);
		} catch (_error) {
			logger.error(red("Failed to parse app.json"));
			return;
		}

		if (appConfig.expo?.updates) {
			logger.warn(
				yellow("Expo updates configuration already exists in app.json"),
			);
			const shouldOverride = await logger.prompt(
				cyan("Do you want to override the existing configuration?"),
				{
					type: "confirm",
				},
			);

			if (!shouldOverride) {
				logger.info("Configuration cancelled");
				return;
			}
		}

		logger.info("\nChoose how you want to calculate your runtime version:");
		logger.info(
			"1. " +
				bold("manual") +
				' - You manually set the version (e.g., "1.0.0")',
		);
		logger.info(`2. ${bold("appVersion")} - Based on the app version`);
		logger.info(
			"3. " +
				bold("nativeVersion") +
				" - Based on version and versionCode/buildNumber",
		);
		logger.info(
			`4. ${bold("fingerprint")} - Automatically calculated (recommended)`,
		);

		const runtimeVersionChoice = await logger.prompt(
			cyan("Select runtime version policy (1-4):"),
			{
				type: "select",
				options: [
					{ label: "Manual", value: "manual" },
					{ label: "App Version", value: "appVersion" },
					{ label: "Native Version", value: "nativeVersion" },
					{ label: "Fingerprint (recommended)", value: "fingerprint" },
				],
			},
		);

		if (!appConfig.expo) {
			appConfig.expo = {};
		}

		appConfig.expo.updates = {
			url: `${serverUrl}/expo/manifest`,
			enabled: true,
			requestHeaders: {
				"ota-app-id": appId,
				"ota-organization-id": organizationId,
			},
		};

		switch (runtimeVersionChoice) {
			case "manual":
				appConfig.expo.runtimeVersion = "1.0.0";
				logger.info(
					yellow(
						"Remember to update the runtime version when you modify native code!",
					),
				);
				break;
			case "appVersion":
				appConfig.expo.runtimeVersion = { policy: "appVersion" };
				break;
			case "nativeVersion":
				appConfig.expo.runtimeVersion = { policy: "nativeVersion" };
				break;
			default:
				appConfig.expo.runtimeVersion = { policy: "fingerprint" };
				break;
		}

		logger.info(`\n${bold("Code Signing Configuration")}`);
		const enableCodeSigning = await logger.prompt(
			cyan("Do you want to enable code signing for your updates?"),
			{
				type: "confirm",
			},
		);

		if (enableCodeSigning) {
			logger.info("Setting up code signing configuration...");

			const keyOutputDirectory = await logger.prompt(
				cyan(
					"Private key output directory (should be outside project, not committed):",
				),
				{
					type: "text",
					initial: "../keys",
				},
			);

			const certOutputDirectory = await logger.prompt(
				cyan("Certificate output directory (can be committed):"),
				{
					type: "text",
					initial: "certs",
				},
			);

			const certificateValidityYears = await logger.prompt(
				cyan("Certificate validity duration (years):"),
				{
					type: "text",
					initial: "10",
				},
			);

			const certificateCommonName = await logger.prompt(
				cyan("Certificate common name (your organization name):"),
				{
					type: "text",
					initial: "Your Organization Name",
				},
			);

			const projectRoot = process.cwd();
			const certPath = resolve(projectRoot, certOutputDirectory);
			const keyPath = resolve(projectRoot, keyOutputDirectory);
			const privateKeyPath = resolve(
				projectRoot,
				keyOutputDirectory,
				"private-key.pem",
			);

			let shouldGenerate = true;
			const existingDirs = [];

			if (existsSync(certPath)) {
				existingDirs.push(`certificate directory '${certOutputDirectory}'`);
			}

			if (existsSync(keyPath)) {
				existingDirs.push(`key directory '${keyOutputDirectory}'`);
			}

			if (existingDirs.length > 0) {
				logger.warn(
					yellow(
						`The following directories already exist: ${existingDirs.join(" and ")}`,
					),
				);
				const shouldOverwrite = await logger.prompt(
					cyan("Do you want to overwrite the existing certificates and keys?"),
					{
						type: "confirm",
					},
				);

				if (shouldOverwrite) {
					logger.info("Removing existing directories...");
					if (existsSync(certPath)) {
						logger.info(`Removing ${certPath}...`);
						rmSync(certPath, { recursive: true, force: true });
					}
					if (existsSync(keyPath)) {
						logger.info(`Removing ${keyPath}...`);
						rmSync(keyPath, { recursive: true, force: true });
					}
				} else {
					shouldGenerate = false;
					logger.info(
						"Skipping key generation. Will attempt to use existing keys.",
					);
				}
			}

			if (shouldGenerate) {
				const codeSigningCommand = [
					"npx expo-updates codesigning:generate",
					`--key-output-directory ${keyOutputDirectory}`,
					`--certificate-output-directory ${certOutputDirectory}`,
					`--certificate-validity-duration-years ${certificateValidityYears}`,
					`--certificate-common-name "${certificateCommonName}"`,
				].join(" ");

				logger.info(`Executing: ${bold(codeSigningCommand)}`);

				try {
					const { stdout, stderr } = await execAsync(codeSigningCommand);

					if (stdout) {
						logger.info("Command output:");
						logger.info(stdout);
					}

					if (stderr) {
						logger.warn("Command warnings:");
						logger.warn(stderr);
					}

					logger.success(
						green("Code signing keys and certificate generated successfully!"),
					);
				} catch (error) {
					logger.error(
						red(
							`Failed to generate code signing keys: ${error instanceof Error ? error.message : "Unknown error"}`,
						),
					);
					logger.warn(
						yellow("Will attempt to use existing keys if available..."),
					);
				}
			}

			const certificatePath = resolve(
				projectRoot,
				certOutputDirectory,
				"certificate.pem",
			);
			if (existsSync(certificatePath)) {
				const relativeCertPath = relative(projectRoot, certificatePath);

				appConfig.expo.updates.codeSigningCertificate = `./${relativeCertPath.replace(/\\/g, "/")}`;
				appConfig.expo.updates.codeSigningMetadata = {
					keyid: "main",
					alg: "rsa-v1_5-sha256",
				};

				logger.success(
					green("Code signing certificate configuration added to app.json"),
				);
			} else {
				logger.error(red(`Certificate not found at ${certificatePath}`));
				logger.warn(
					yellow("Code signing configuration will not be added to app.json"),
				);
			}

			if (existsSync(privateKeyPath)) {
				logger.info("Uploading private key to server...");

				try {
					const privateKeyContent = readFileSync(privateKeyPath, "utf-8");

					const client = treaty<ServerApp>(serverUrl);
					const uploadResponse = await client.api
						.apps({ id: appId })
						["signing-key"].patch(
							{
								signingKey: privateKeyContent,
							},
							{
								headers: {
									Authorization: `Bearer ${accessToken}`,
								},
							},
						);

					if (uploadResponse.error) {
						logger.error(red("Failed to upload private key to server"));
						logger.error(red(uploadResponse.error.toString()));
					} else {
						logger.success(
							green("Private key uploaded to server successfully!"),
						);
						logger.warn(
							yellow(
								`⚠️  IMPORTANT: Secure your private key at ${privateKeyPath}`,
							),
						);
						logger.warn(
							yellow(
								"   This key should be kept secret and not committed to version control.",
							),
						);
					}
				} catch (uploadError) {
					logger.error(
						red(
							`Failed to upload private key: ${uploadError instanceof Error ? uploadError.message : "Unknown error"}`,
						),
					);
				}
			} else {
				logger.warn(yellow(`Private key not found at ${privateKeyPath}`));
				logger.warn(yellow("Private key will not be uploaded to server"));

				const uploadExistingKey = await logger.prompt(
					cyan(
						"Do you want to upload an existing private key from a different location?",
					),
					{
						type: "confirm",
					},
				);

				if (uploadExistingKey) {
					const existingKeyPath = await logger.prompt(
						cyan("Enter the path to your existing private key:"),
						{
							type: "text",
						},
					);

					if (existsSync(existingKeyPath)) {
						try {
							const privateKeyContent = readFileSync(existingKeyPath, "utf-8");

							const client = treaty<ServerApp>(serverUrl);
							const uploadResponse = await client.api
								.apps({ id: appId })
								["signing-key"].patch(
									{
										signingKey: privateKeyContent,
									},
									{
										headers: {
											Authorization: `Bearer ${accessToken}`,
										},
									},
								);

							if (uploadResponse.error) {
								logger.error(red("Failed to upload private key to server"));
								logger.error(red(uploadResponse.error.toString()));
							} else {
								logger.success(
									green("Private key uploaded to server successfully!"),
								);
								logger.warn(
									yellow(
										`⚠️  IMPORTANT: Secure your private key at ${existingKeyPath}`,
									),
								);
								logger.warn(
									yellow(
										"   This key should be kept secret and not committed to version control.",
									),
								);
							}
						} catch (uploadError) {
							logger.error(
								red(
									`Failed to upload private key: ${uploadError instanceof Error ? uploadError.message : "Unknown error"}`,
								),
							);
						}
					} else {
						logger.error(
							red(`Private key file not found at ${existingKeyPath}`),
						);
					}
				}
			}
		}

		try {
			writeFileSync(appJsonPath, JSON.stringify(appConfig, null, 2));
			logger.success(green("app.json updated successfully!"));

			logger.info("\nConfiguration added:");
			logger.info(`- Updates URL: ${bold(appConfig.expo.updates.url)}`);
			logger.info(`- App ID: ${bold(appId)}`);
			logger.info(`- Organization ID: ${bold(organizationId)}`);

			if (typeof appConfig.expo.runtimeVersion === "string") {
				logger.info(
					`- Runtime Version: ${bold(appConfig.expo.runtimeVersion)} (manual)`,
				);
			} else {
				logger.info(
					`- Runtime Version Policy: ${bold(appConfig.expo.runtimeVersion.policy)}`,
				);
			}

			if (appConfig.expo.updates.codeSigningCertificate) {
				logger.info(`- Code Signing: ${bold("Enabled")}`);
				logger.info(
					`- Certificate: ${bold(appConfig.expo.updates.codeSigningCertificate)}`,
				);
				logger.info(
					`- Algorithm: ${bold(appConfig.expo.updates.codeSigningMetadata.alg)}`,
				);
			} else {
				logger.info(`- Code Signing: ${bold("Disabled")}`);
			}

			logger.info(`\n${green("Your Expo app is now configured for updates!")}`);
		} catch (_error) {
			logger.error(red("Failed to write app.json"));
			return;
		}
	} catch (error: unknown) {
		logger.error(
			red(
				`Initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			),
		);
	}
}
