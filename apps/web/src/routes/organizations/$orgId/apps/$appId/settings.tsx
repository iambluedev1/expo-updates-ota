import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { ArrowRightLeft, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute(
	"/organizations/$orgId/apps/$appId/settings",
)({
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
	const navigate = useNavigate();
	const { orgId, appId } = Route.useParams();
	const queryClient = useQueryClient();
	const [title, setTitle] = useState("");
	const [slug, setSlug] = useState("");
	const [saveDownloadStatistics, setSaveDownloadStatistics] = useState(false);
	const [targetOrgId, setTargetOrgId] = useState("");

	const { data: app, isLoading } = useQuery({
		queryKey: ["app", appId],
		queryFn: async () => {
			const response = await api.api.apps({ id: appId }).get();
			if (response.error) {
				throw new Error(
					(response.error.value as any).message || "Failed to fetch app",
					{
						cause: response.error,
					},
				);
			}
			return response.data;
		},
	});

	const { data: organizations } = useQuery({
		queryKey: ["user-organizations"],
		queryFn: async () => {
			const session = await authClient.getSession();
			if (!session.data?.user) return [];

			const response = await api.api.organizations.get();
			if (response.error) {
				throw new Error(
					(response.error.value as any).message ||
						"Failed to fetch organizations",
					{
						cause: response.error,
					},
				);
			}
			return response.data;
		},
	});

	useEffect(() => {
		if (app) {
			setTitle(app.title);
			setSlug(app.slug);
			setSaveDownloadStatistics(app.saveDownloadStatistics || false);
		}
	}, [app]);

	const updateAppMutation = useMutation({
		mutationFn: async (data: {
			title: string;
			slug: string;
			saveDownloadStatistics?: boolean;
		}) => {
			const response = await api.api.apps({ id: appId }).patch(data);
			if (response.error) {
				throw new Error(
					(response.error.value as any).message || "Failed to update app",
					{
						cause: response.error,
					},
				);
			}
			return response.data;
		},
		onSuccess: () => {
			toast.success("App updated successfully!");
			queryClient.invalidateQueries({ queryKey: ["app", appId] });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const transferAppMutation = useMutation({
		mutationFn: async (targetOrganizationId: string) => {
			const response = await api.api.apps({ id: appId }).transfer.post({
				targetOrganizationId,
			});
			if (response.error) {
				throw new Error(
					(response.error.value as any).message || "Unable to transfer app",
					{
						cause: response.error,
					},
				);
			}
			return response.data;
		},
		onSuccess: (data) => {
			toast.success("App transferred successfully!");
			navigate({
				to: "/organizations/$orgId/apps/$appId",
				params: { orgId: data.organizationId, appId },
			});
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const deleteAppMutation = useMutation({
		mutationFn: async () => {
			const response = await api.api.apps({ id: appId }).delete();
			if (response.error) {
				throw new Error(
					(response.error.value as any).message || "Failed to delete app",
					{
						cause: response.error,
					},
				);
			}
			return response.data;
		},
		onSuccess: () => {
			toast.success("App deleted successfully!");
			navigate({ to: "/organizations/$orgId", params: { orgId } });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		updateAppMutation.mutate({ title, slug, saveDownloadStatistics });
	};

	if (isLoading) {
		return (
			<div className="container mx-auto max-w-4xl p-6">
				<div className="animate-pulse space-y-6">
					<div className="h-8 w-1/3 rounded bg-muted" />
					<div className="h-4 w-1/2 rounded bg-muted" />
					<div className="grid gap-6">
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-48 rounded bg-muted" />
						))}
					</div>
				</div>
			</div>
		);
	}

	if (!app) {
		return (
			<div className="container mx-auto max-w-4xl p-6">
				<div className="py-12 text-center">
					<h2 className="font-semibold text-lg">App not found</h2>
					<p className="mt-2 text-muted-foreground">
						The app you're looking for doesn't exist or you don't have access to
						it.
					</p>
					<Button asChild className="mt-4">
						<Link to={"/organizations/$orgId"} params={{ orgId }}>
							Back to Organization
						</Link>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-4xl space-y-8 p-6">
			<div className="flex items-center gap-4">
				<div>
					<h1 className="font-bold text-3xl tracking-tight">App Settings</h1>
					<p className="mt-2 text-muted-foreground">
						Manage settings for {app.title}
					</p>
				</div>
			</div>

			<div className="grid gap-6">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Settings className="h-5 w-5" />
							General Settings
						</CardTitle>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-6">
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label>App Title</Label>
									<Input
										value={title}
										onChange={(e) => setTitle(e.target.value)}
										disabled={updateAppMutation.isPending}
									/>
								</div>
								<div className="space-y-2">
									<Label>App Slug</Label>
									<Input
										value={slug}
										onChange={(e) => setSlug(e.target.value)}
										disabled={updateAppMutation.isPending}
									/>
									<p className="text-muted-foreground text-sm">
										Used in API endpoints and URLs
									</p>
								</div>
							</div>
							<div className="flex items-center justify-between rounded-lg border p-4">
								<div className="space-y-1">
									<Label>Usage Statistics</Label>
									<p className="text-muted-foreground text-sm">
										Track app opens and version distribution across your user
										base
									</p>
								</div>
								<Switch
									checked={saveDownloadStatistics}
									onCheckedChange={setSaveDownloadStatistics}
									disabled={updateAppMutation.isPending}
								/>
							</div>
							<Button
								type="submit"
								disabled={updateAppMutation.isPending}
								className="w-full md:w-auto"
							>
								{updateAppMutation.isPending ? "Saving..." : "Save Changes"}
							</Button>
						</form>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<ArrowRightLeft className="h-5 w-5" />
							Transfer App
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div className="rounded-lg border p-4">
								<div className="space-y-4">
									<div>
										<h3 className="font-semibold">
											Transfer to another organization
										</h3>
										<p className="text-muted-foreground text-sm">
											Move this app to a different organization where you have
											admin access.
										</p>
									</div>
									<div className="space-y-2">
										<Label>Target Organization</Label>
										<Select value={targetOrgId} onValueChange={setTargetOrgId}>
											<SelectTrigger>
												<SelectValue placeholder="Select organization" />
											</SelectTrigger>
											<SelectContent>
												{organizations
													?.filter((org) => org.id !== orgId)
													.map((org) => (
														<SelectItem key={org.id} value={org.id}>
															{org.name}
														</SelectItem>
													))}
											</SelectContent>
										</Select>
									</div>
									<AlertDialog>
										<AlertDialogTrigger asChild>
											<Button
												disabled={!targetOrgId || transferAppMutation.isPending}
												className="w-full"
											>
												<ArrowRightLeft className="mr-2 h-4 w-4" />
												Transfer App
											</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>Transfer App</AlertDialogTitle>
												<AlertDialogDescription>
													Are you sure you want to transfer "{app.title}" to{" "}
													{
														organizations?.find((o) => o.id === targetOrgId)
															?.name
													}
													? All builds, tokens, and settings will be moved with
													the app.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>Cancel</AlertDialogCancel>
												<AlertDialogAction
													onClick={() =>
														transferAppMutation.mutate(targetOrgId)
													}
													disabled={transferAppMutation.isPending}
												>
													{transferAppMutation.isPending
														? "Transferring..."
														: "Transfer"}
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className="border-destructive">
					<CardHeader>
						<CardTitle className="text-destructive">Danger Zone</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between rounded-lg border border-destructive p-4">
							<div>
								<h3 className="font-semibold">Delete App</h3>
								<p className="text-muted-foreground text-sm">
									Permanently delete this app and all its data. This action
									cannot be undone.
								</p>
							</div>
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button variant="destructive">Delete App</Button>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Delete App</AlertDialogTitle>
										<AlertDialogDescription>
											Are you sure you want to delete "{app.title}"? This will
											permanently delete the app, all its builds, tokens, and
											other associated data. This action cannot be undone.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction
											onClick={() => deleteAppMutation.mutate()}
											className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
										>
											Delete App
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
