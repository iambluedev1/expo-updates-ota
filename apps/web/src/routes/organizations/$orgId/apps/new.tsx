import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/organizations/$orgId/apps/new")({
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
	const { orgId } = Route.useParams();
	const [title, setTitle] = useState("");
	const [slug, setSlug] = useState("");
	const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
	const queryClient = useQueryClient();

	const createAppMutation = useMutation({
		mutationFn: async (data: {
			title: string;
			slug: string;
			organizationId: string;
		}) => {
			const response = await api.api.apps.post(data);

			if (response.error) {
				throw new Error(
					(response.error.value as any).message || "Failed to create app",
					{ cause: response.error },
				);
			}

			return response.data;
		},
		onSuccess: (app) => {
			toast.success("App created successfully!");
			queryClient.invalidateQueries({
				queryKey: ["apps", orgId],
			});
			navigate({ to: `/organizations/${orgId}/apps/${app.id}` });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim() || !slug.trim()) {
			toast.error("Please fill in all fields");
			return;
		}

		if (!/^[a-z0-9-]+$/.test(slug)) {
			toast.error(
				"Slug can only contain lowercase letters, numbers, and hyphens",
			);
			return;
		}

		createAppMutation.mutate({ title, slug, organizationId: orgId });
	};

	const handleTitleChange = (value: string) => {
		setTitle(value);

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

	return (
		<div className="container mx-auto max-w-2xl p-6">
			<div className="mb-8 flex items-center gap-4">
				<div>
					<h1 className="font-bold text-3xl tracking-tight">Create App</h1>
					<p className="mt-2 text-muted-foreground">
						Create a new Expo app to start managing your updates and builds.
					</p>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>App Details</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-6">
						<div className="space-y-2">
							<Label htmlFor="title">App Title</Label>
							<Input
								placeholder="My Awesome App"
								value={title}
								onChange={(e) => handleTitleChange(e.target.value)}
								disabled={createAppMutation.isPending}
							/>
							<p className="text-muted-foreground text-sm">
								The display name of your app as it will appear in the dashboard.
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="slug">App Slug</Label>
							<div className="flex items-center gap-2">
								<span className="text-muted-foreground text-sm">@</span>
								<Input
									placeholder="my-awesome-app"
									value={slug}
									onChange={(e) => handleSlugChange(e.target.value)}
									disabled={createAppMutation.isPending}
								/>
							</div>
							<p className="text-muted-foreground text-sm">
								A unique identifier for your app within this organization. Only
								lowercase letters, numbers, and hyphens are allowed.
							</p>
						</div>

						<div className="flex gap-3 pt-4">
							<Button
								type="submit"
								disabled={createAppMutation.isPending}
								className="flex-1"
							>
								{createAppMutation.isPending ? "Creating..." : "Create App"}
							</Button>
							<Button variant="outline" asChild>
								<Link to={"/organizations/$orgId"} params={{ orgId }}>
									Cancel
								</Link>
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
