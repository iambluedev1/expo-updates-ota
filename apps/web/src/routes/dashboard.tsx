import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Package, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/dashboard")({
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
	const { session } = Route.useRouteContext();

	const { data: organizations, isLoading } = useQuery({
		queryKey: ["organizations"],
		queryFn: async () => {
			const { data, error } = await authClient.organization.list();
			if (error) {
				throw new Error(error.message || "Failed to fetch organizations", {
					cause: error,
				});
			}
			return data;
		},
	});

	if (isLoading) {
		return (
			<div className="container mx-auto p-6">
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{[1, 2, 3].map((i) => (
						<Card key={i} className="animate-pulse">
							<CardHeader className="space-y-2">
								<div className="h-4 w-3/4 rounded bg-muted" />
								<div className="h-3 w-1/2 rounded bg-muted" />
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="h-3 w-full rounded bg-muted" />
								<div className="h-3 w-2/3 rounded bg-muted" />
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto space-y-8 p-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-bold text-3xl tracking-tight">Dashboard</h1>
					<p className="mt-2 text-muted-foreground">
						Welcome back, {session.data?.user.name}! Manage your Expo apps and
						updates.
					</p>
				</div>
				<Button asChild>
					<Link to="/organizations/new">
						<Plus className="mr-2 h-4 w-4" />
						New Organization
					</Link>
				</Button>
			</div>

			{organizations?.length === 0 ? (
				<div className="py-12 text-center">
					<Package className="mx-auto h-12 w-12 text-muted-foreground" />
					<h2 className="mt-4 font-semibold text-lg">No organizations yet</h2>
					<p className="mt-2 text-muted-foreground">
						Get started by creating your first organization to manage your Expo
						apps.
					</p>
					<Button asChild className="mt-4">
						<Link to="/organizations/new">
							<Plus className="mr-2 h-4 w-4" />
							Create Organization
						</Link>
					</Button>
				</div>
			) : (
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{organizations?.map((org) => (
						<Card
							key={org.id}
							className="group transition-shadow hover:shadow-lg"
						>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle className="text-xl transition-colors group-hover:text-primary">
										{org.name}
									</CardTitle>
									<Button
										variant="ghost"
										size="icon"
										asChild
										className="opacity-0 transition-opacity group-hover:opacity-100"
									>
										<Link
											to={"/organizations/$orgId/settings"}
											params={{ orgId: org.id }}
										>
											<Settings className="h-4 w-4" />
										</Link>
									</Button>
								</div>
								<p className="text-muted-foreground text-sm">@{org.slug}</p>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex gap-2 pt-2">
									<Button asChild className="flex-1" size="sm">
										<Link
											to={"/organizations/$orgId"}
											params={{ orgId: org.id }}
										>
											View Organization
										</Link>
									</Button>
									<Button asChild variant="outline" size="sm">
										<Link
											to={"/organizations/$orgId/apps/new"}
											params={{ orgId: org.id }}
										>
											<Plus className="h-4 w-4" />
										</Link>
									</Button>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
