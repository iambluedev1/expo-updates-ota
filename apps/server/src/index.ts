import "dotenv/config";
import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import logixlysia from "logixlysia";
import { appController, appSigningController } from "./controllers/app";
import { authController } from "./controllers/auth";
import { buildController } from "./controllers/build";
import { cliBuildController } from "./controllers/cli-build";
import { expoController } from "./controllers/expo";
import { invitationController } from "./controllers/invitation";
import { statsController } from "./controllers/stats";
import { tokenController } from "./controllers/token";
import prisma from "./db";
import { auth } from "./lib/auth";
import { initAdminUser } from "./scripts/init-admin";

export const app = new Elysia({ adapter: node() })
	.use(
		cors({
			origin: process.env.ADMIN_WEB_URL || "",
			methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
			allowedHeaders: [
				"Content-Type",
				"Authorization",
				"expo-protocol-version",
				"expo-platform",
				"expo-runtime-version",
				"expo-current-update-id",
				"expo-embedded-update-id",
				"expo-expect-signature",
				"ota-app-id",
				"ota-organization-id",
				"ota-channel-name",
				"accept",
			],
			credentials: true,
		}),
	)
	.onError(({ error, code, request }) => {
		console.error(
			`Error [${code}] on ${request.method} ${request.url}:`,
			error,
		);
		return error;
	})
	.use(
		logixlysia({
			config: {
				showStartupMessage: false,
				timestamp: {
					translateTime: "yyyy-mm-dd HH:MM:ss",
				},
				ip: true,
				customLogFormat:
					"{now} {level} {duration} {method} {pathname} {status} {message} {ip} {epoch}",
			},
		}),
	)
	.use(
		staticPlugin({
			assets: process.env.UPLOAD_DIR || "uploads",
			prefix: "/files",
		}),
	)
	.all("/api/auth/*", async (context) => {
		const { request, status, query } = context;

		if (
			request.url.includes("/sign-up") &&
			process.env.DISABLE_REGISTER &&
			process.env.DISABLE_REGISTER === "true"
		) {
			if (query.invitation) {
				try {
					const invitation = await prisma.invitation.findUnique({
						where: {
							id: query.invitation,
							status: "pending",
						},
					});

					if (!invitation) {
						return status(404);
					}
				} catch (e) {
					console.error("Unable to fetch invitation", e);
					return status(404);
				}
			} else {
				return status(404);
			}
		}

		if (["POST", "GET"].includes(request.method)) {
			return auth.handler(request);
		}

		return status(405);
	})
	.group("/api", (app) =>
		app
			.use(appController)
			.use(appSigningController)
			.use(tokenController)
			.use(buildController)
			.use(cliBuildController)
			.use(authController)
			.use(statsController)
			.use(invitationController),
	)
	.use(expoController)
	.get("/", () => "Expo Updates Server")
	.listen(5501, () => {
		console.log("Server is listening on http://localhost:5501");
		initAdminUser();
	});

export type ServerApp = typeof app;
