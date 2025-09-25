import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import SignInForm from "@/components/sign-in-form";
import { getEnv } from "@/utis/env";

const searchSchema = z.object({
	invitation: z.string().optional(),
});

export const Route = createFileRoute("/login")({
	component: RouteComponent,
	validateSearch: searchSchema,
});

function RouteComponent() {
	const search = Route.useSearch();
	const registerIsEnabled = !getEnv().DISABLE_REGISTER;

	return (
		<SignInForm
			invitationToken={search.invitation}
			registerIsEnabled={!registerIsEnabled}
		/>
	);
}
