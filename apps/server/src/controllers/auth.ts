import { Elysia } from "elysia";
import { cliAuthMiddleware } from "@/lib/auth";

export const authController = new Elysia({ prefix: "/token-auth" })
	.use(cliAuthMiddleware)
	.get(
		"/validate",
		async ({ app, organization, user }) => {
			return {
				valid: true,
				app: {
					id: app.id,
					name: app.title,
				},
				organization: {
					id: organization.id,
					name: organization.name,
				},
				user: {
					id: user.id,
					name: user.name,
					email: user.email,
				},
			};
		},
		{
			tokenAuth: true,
		},
	);
