import { treaty } from "@elysiajs/eden";
import { getEnv } from "@/utis/env";
import type { ServerApp } from "../../../server/src/index";

const baseUrl = getEnv().SERVER_URL;

export const api = treaty<ServerApp>(baseUrl, {
	fetch: {
		credentials: "include",
	},
});
