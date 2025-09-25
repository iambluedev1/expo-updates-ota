import { useMutation } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/organizations/new")({
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
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

	const createOrganizationMutation = useMutation({
		mutationFn: async ({ name, slug }: { name: string; slug: string }) => {
			const { data: response, error } = await authClient.organization.create({
				name,
				slug,
				keepCurrentActiveOrganization: false,
			});

			if (error) {
				throw new Error(error.message || "Failed to create organization", {
					cause: error,
				});
			}

			return response;
		},
		onSuccess: (organization) => {
			toast.success("Organization created successfully!");
			navigate({ to: `/organizations/${organization.id}` });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
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

		createOrganizationMutation.mutate({ name, slug });
	};

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

	return (
		<div className="container mx-auto max-w-2xl p-6">
			<div className="mb-8 flex items-center gap-4">
				<Button variant="ghost" size="icon" asChild>
					<Link to="/dashboard">
						<ArrowLeft className="h-4 w-4" />
					</Link>
				</Button>
				<div>
					<h1 className="font-bold text-3xl tracking-tight">
						Create Organization
					</h1>
					<p className="mt-2 text-muted-foreground">
						Set up a new organization to manage your Expo apps and team members.
					</p>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Organization Details</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-6">
						<div className="space-y-2">
							<Label htmlFor="name">Organization Name</Label>
							<Input
								placeholder="My Awesome Company"
								value={name}
								onChange={(e) => handleNameChange(e.target.value)}
								disabled={createOrganizationMutation.isPending}
							/>
							<p className="text-muted-foreground text-sm">
								The name of your organization as it will appear in the
								dashboard.
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
									disabled={createOrganizationMutation.isPending}
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
								disabled={createOrganizationMutation.isPending}
								className="flex-1"
							>
								{createOrganizationMutation.isPending
									? "Creating..."
									: "Create Organization"}
							</Button>
							<Button variant="outline" asChild>
								<Link to="/dashboard">Cancel</Link>
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
