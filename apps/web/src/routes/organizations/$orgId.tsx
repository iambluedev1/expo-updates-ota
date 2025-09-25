import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/organizations/$orgId")({
	component: RouteComponent,
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data) {
			redirect({
				to: "/login",
				throw: true,
			});
		}
		return { session };
	},
});

function RouteComponent() {
	const { orgId } = Route.useParams();

	const { data: organization, isLoading } = useQuery({
		queryKey: ["organization", orgId],
		queryFn: async () => {
			const { data, error } = await authClient.organization.setActive({
				organizationId: orgId,
			});

			if (error) {
				throw new Error(error.message || "Failed to fetch organization", {
					cause: error,
				});
			}

			return data;
		},
	});

	const { data: activeOrg } = authClient.useActiveOrganization();

	useEffect(() => {
		if (!activeOrg || (activeOrg && activeOrg.id !== orgId)) {
			authClient.organization.setActive({
				organizationId: orgId,
			});
		}
	}, [orgId, activeOrg]);

	if (isLoading) {
		return (
			<div className="container mx-auto p-6">
				<div className="animate-pulse space-y-6">
					<div className="h-8 w-1/3 rounded bg-muted" />
					<div className="h-4 w-1/2 rounded bg-muted" />
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-48 rounded bg-muted" />
						))}
					</div>
				</div>
			</div>
		);
	}

	if (!organization) {
		return (
			<div className="container mx-auto p-6">
				<div className="py-12 text-center">
					<h2 className="font-semibold text-lg">Organization not found</h2>
					<p className="mt-2 text-muted-foreground">
						The organization you're looking for doesn't exist or you don't have
						access to it.
					</p>
					<Button asChild className="mt-4">
						<Link to="/dashboard">Back to Dashboard</Link>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<Outlet />
		</div>
	);
}
