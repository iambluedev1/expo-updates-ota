import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { AlertTriangle, Building, Save, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/organizations/$orgId/settings")({
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
	const queryClient = useQueryClient();
	const { orgId } = Route.useParams();
	const { session } = Route.useRouteContext();

	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

	const { data: organization, isPending: isLoading } =
		authClient.useActiveOrganization();

	const { data: apps } = useQuery({
		queryKey: ["apps", orgId],
		queryFn: async () => {
			const response = await api.api.apps.get({
				query: {
					organizationId: organization!.id,
				},
			});
			if (response.error) {
				throw new Error(
					(response.error.value as any).message ||
						"Failed to fetch organization",
					{
						cause: response.error,
					},
				);
			}
			return response.data;
		},
		enabled: organization != null,
	});

	useEffect(() => {
		if (organization) {
			setName(organization.name);
			setSlug(organization.slug);
		}
	}, [organization]);

	const updateOrganizationMutation = useMutation({
		mutationFn: async ({
			name,
			slug,
			orgId,
		}: {
			name: string;
			slug: string;
			orgId: string;
		}) => {
			const response = await authClient.organization.update({
				data: {
					name,
					slug,
				},
				organizationId: orgId,
			});

			if (response.error) {
				throw new Error(
					response.error.message || "Failed to update organization",
					{
						cause: response.error,
					},
				);
			}

			return response.data;
		},
		onSuccess: () => {
			toast.success("Organization updated successfully!");
			queryClient.invalidateQueries({ queryKey: ["organization", orgId] });
			queryClient.invalidateQueries({ queryKey: ["organizations"] });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const deleteOrganizationMutation = useMutation({
		mutationFn: async ({ orgId }: { orgId: string }) => {
			const response = await authClient.organization.delete({
				organizationId: orgId,
			});

			if (response.error) {
				throw new Error(
					response.error.message || "Failed to delete organization",
					{
						cause: response.error,
					},
				);
			}

			return response.data;
		},
		onSuccess: () => {
			toast.success("Organization deleted successfully!");
			queryClient.invalidateQueries({ queryKey: ["organizations"] });
			navigate({ to: "/dashboard" });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const handleNameChange = (value: string) => {
		setName(value);

		if (!isSlugManuallyEdited) {
			const generatedSlug = value
				.toLowerCase()
				.replace(/[^a-z0-9\s-]/g, "")
				.replace(/\s+/g, "-")
				.replace(/-+/g, "-")
				.replace(/^-+|-+$/g, "")
				.trim();
			setSlug(generatedSlug);
		}
	};

	const handleSlugChange = (value: string) => {
		setSlug(value);
		setIsSlugManuallyEdited(true);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!organization) return;

		if (!name.trim() || !slug.trim()) {
			toast.error("Please fill in all fields");
			return;
		}

		if (!/^[a-z0-9-]+$/.test(slug)) {
			toast.error(
				"Slug can only contain lowercase letters, numbers, and hyphens",
			);
			return;
		}

		updateOrganizationMutation.mutate({ name, slug, orgId: organization.id });
	};

	const handleDelete = () => {
		if (!organization) return;

		deleteOrganizationMutation.mutate({
			orgId: organization.id,
		});
	};

	if (isLoading) {
		return (
			<div className="animate-pulse space-y-6">
				<div className="h-8 w-1/3 rounded bg-muted" />
				<div className="h-48 rounded bg-muted" />
			</div>
		);
	}

	if (!organization) {
		return (
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
		);
	}

	const currentUserMember = organization.members.find(
		(member) => member.user.id === session.data?.user.id,
	);

	const isAdmin = ["admin", "owner"].includes(currentUserMember?.role || "");

	if (!isAdmin) {
		return (
			<div className="py-12 text-center">
				<AlertTriangle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
				<h2 className="font-semibold text-lg">Access Denied</h2>
				<p className="mt-2 text-muted-foreground">
					You need admin permissions to access organization settings.
				</p>
				<Button asChild className="mt-4">
					<Link to={"/organizations/$orgId"} params={{ orgId }}>
						Back to Organization
					</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-4xl space-y-8">
			<div className="flex items-center gap-4">
				<div>
					<h1 className="font-bold text-3xl tracking-tight">
						Organization Settings
					</h1>
					<p className="mt-2 text-muted-foreground">
						Manage your organization's information and preferences.
					</p>
				</div>
			</div>

			<Tabs defaultValue="general" className="space-y-6">
				<TabsList>
					<TabsTrigger value="general">General</TabsTrigger>
					<TabsTrigger value="danger">Danger Zone</TabsTrigger>
				</TabsList>

				<TabsContent value="general" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Building className="h-5 w-5" />
								Organization Information
							</CardTitle>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleSubmit} className="space-y-6">
								<div className="space-y-2">
									<Label htmlFor="name">Organization Name</Label>
									<Input
										placeholder="My Awesome Company"
										value={name}
										onChange={(e) => handleNameChange(e.target.value)}
										disabled={updateOrganizationMutation.isPending}
									/>
									<p className="text-muted-foreground text-sm">
										The display name of your organization.
									</p>
								</div>

								<div className="space-y-2">
									<Label htmlFor="slug">Organization Slug</Label>
									<div className="flex items-center gap-2">
										<span className="text-muted-foreground text-sm">@</span>
										<Input
											placeholder="my-awesome-company"
											value={slug}
											onChange={(e) => handleSlugChange(e.target.value)}
											disabled={updateOrganizationMutation.isPending}
										/>
									</div>
									<p className="text-muted-foreground text-sm">
										A unique identifier for your organization. Only lowercase
										letters, numbers, and hyphens are allowed.
									</p>
								</div>

								<div className="flex gap-3 pt-4">
									<Button
										type="submit"
										disabled={updateOrganizationMutation.isPending}
									>
										<Save className="mr-2 h-4 w-4" />
										{updateOrganizationMutation.isPending
											? "Saving..."
											: "Save Changes"}
									</Button>
									<Button
										variant="outline"
										type="button"
										onClick={() => {
											setName(organization.name);
											setSlug(organization.slug);
											setIsSlugManuallyEdited(false);
										}}
										disabled={updateOrganizationMutation.isPending}
									>
										Reset
									</Button>
								</div>
							</form>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Users className="h-5 w-5" />
								Organization Overview
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-4 md:grid-cols-3">
							<div className="rounded-lg border p-4 text-center">
								<div className="font-bold text-2xl">
									{organization.members.length}
								</div>
								<div className="text-muted-foreground text-sm">
									Team Members
								</div>
							</div>
							<div className="rounded-lg border p-4 text-center">
								<div className="font-bold text-2xl">{(apps || []).length}</div>
								<div className="text-muted-foreground text-sm">
									Applications
								</div>
							</div>
							<div className="rounded-lg border p-4 text-center">
								<div className="font-bold text-2xl">
									{
										organization.members.filter((m) =>
											["admin", "owner"].includes(m.role),
										).length
									}
								</div>
								<div className="text-muted-foreground text-sm">
									Administrators
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Organization Details</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center justify-between">
								<span className="font-medium text-sm">Organization ID</span>
								<code className="rounded bg-muted px-2 py-1 text-xs">
									{organization.id}
								</code>
							</div>
							<div className="flex items-center justify-between">
								<span className="font-medium text-sm">Created</span>
								<span className="text-muted-foreground text-sm">
									{new Date(organization.createdAt).toLocaleDateString()}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="font-medium text-sm">Your Role</span>
								<Badge
									variant={
										["admin", "owner"].includes(currentUserMember?.role || "")
											? "default"
											: "secondary"
									}
								>
									{currentUserMember?.role}
								</Badge>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="danger" className="space-y-6">
					<Card className="border-destructive">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-destructive">
								<AlertTriangle className="h-5 w-5" />
								Danger Zone
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							<Alert className="border-destructive">
								<AlertTriangle className="h-4 w-4" />
								<AlertDescription>
									<strong>Warning:</strong> These actions cannot be undone.
									Please proceed with caution.
								</AlertDescription>
							</Alert>

							<div className="space-y-4">
								<div>
									<h3 className="font-semibold text-destructive text-lg">
										Delete Organization
									</h3>
									<p className="mt-1 text-muted-foreground text-sm">
										Permanently delete this organization and all associated data
										including apps, builds, and member associations.
									</p>
								</div>

								<div className="space-y-2 rounded-lg bg-muted/50 p-4">
									<p className="font-medium text-sm">
										This will permanently delete:
									</p>
									<ul className="ml-4 space-y-1 text-muted-foreground text-sm">
										<li>• {(apps || []).length} application(s)</li>
										<li>• All builds and assets</li>
										<li>
											• {organization.members.length} member association(s)
										</li>
										<li>• All access tokens</li>
										<li>• Organization settings and history</li>
									</ul>
								</div>

								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button
											variant="destructive"
											disabled={deleteOrganizationMutation.isPending}
										>
											<Trash2 className="mr-2 h-4 w-4" />
											{deleteOrganizationMutation.isPending
												? "Deleting..."
												: "Delete Organization"}
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>Delete Organization</AlertDialogTitle>
											<AlertDialogDescription>
												Are you absolutely sure you want to delete{" "}
												<strong>{organization.name}</strong>? This action cannot
												be undone and will permanently remove all associated
												data.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<AlertDialogAction
												onClick={handleDelete}
												className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
											>
												Yes, Delete Organization
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
