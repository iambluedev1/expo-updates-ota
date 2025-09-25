import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import SignUpForm from "@/components/sign-up-form";
import { getEnv } from "@/utis/env";

const searchSchema = z.object({
	invitation: z.string().optional(),
});

export const Route = createFileRoute("/register")({
	beforeLoad: (ctx) => {
		if (getEnv().DISABLE_REGISTER && !ctx.search.invitation) {
			throw redirect({ to: "/login" });
		}
	},
	component: RouteComponent,
	validateSearch: searchSchema,
});

function RouteComponent() {
	const search = Route.useSearch();
	return <SignUpForm invitationToken={search.invitation} />;
}
