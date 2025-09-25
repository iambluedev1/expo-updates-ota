import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { getEnv } from "@/utis/env";

export const authClient = createAuthClient({
	baseURL: getEnv().SERVER_URL,
	plugins: [organizationClient()],
});
