import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	AlertTriangle,
	Building,
	CheckCircle,
	Clock,
	Mail,
	UserPlus,
	XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/invitations/$token")({
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { token } = Route.useParams();

	const { data: session } = useQuery({
		queryKey: ["session"],
		queryFn: () => authClient.getSession(),
		staleTime: 1000 * 60 * 5,
	});

	const {
		data: invitation,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["invitation", token],
		queryFn: async () => {
			const response = await api.api.invitations({ token }).get();
			if (response.error) {
				throw new Error(
					(response.error.value as any).message || "Failed to fetch invitation",
					{
						cause: response.error,
					},
				);
			}
			return response.data;
		},
		retry: false,
	});

	const acceptMutation = useMutation({
		mutationFn: async () => {
			const response = await api.api.invitations({ token }).accept.post();

			if (response.error) {
				throw new Error(
					(response.error.value as any).message ||
						"Failed to accept invitation",
					{
						cause: response.error,
					},
				);
			}

			return response.data;
		},
		onSuccess: (member) => {
			toast.success(`Welcome to ${invitation?.organization.name}!`);
			queryClient.invalidateQueries({ queryKey: ["organizations"] });
			navigate({ to: `/organizations/${member.organization.id}` });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const declineMutation = useMutation({
		mutationFn: async () => {
			const response = await api.api.invitations({ token }).decline.post();

			if (response.error) {
				throw new Error(
					(response.error.value as any).message ||
						"Failed to decline invitation",
					{
						cause: response.error,
					},
				);
			}

			return response.data;
		},
		onSuccess: () => {
			toast.success("Invitation declined");
			navigate({ to: "/dashboard" });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	if (isLoading) {
		return (
			<div className="container mx-auto max-w-2xl p-6">
				<Card>
					<CardHeader>
						<Skeleton className="h-8 w-3/4" />
						<Skeleton className="h-4 w-1/2" />
					</CardHeader>
					<CardContent className="space-y-4">
						<Skeleton className="h-20 w-full" />
						<Skeleton className="h-10 w-full" />
					</CardContent>
				</Card>
			</div>
		);
	}

	if (error || !invitation) {
		return (
			<div className="container mx-auto max-w-2xl p-6">
				<Card className="border-destructive">
					<CardContent className="py-12 text-center">
						<AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
						<h2 className="mb-2 font-semibold text-lg">Invalid Invitation</h2>
						<p className="mb-6 text-muted-foreground">
							{error?.message ||
								"This invitation link is invalid or has expired."}
						</p>
						<Button asChild>
							<Link to="/dashboard">Go to Dashboard</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!session?.data) {
		return (
			<div className="container mx-auto max-w-2xl p-6">
				<Card>
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
							<UserPlus className="h-6 w-6 text-primary" />
						</div>
						<CardTitle className="text-2xl">
							Join {invitation.organization.name}
						</CardTitle>
						{invitation.inviter && (
							<p className="text-muted-foreground">
								You've been invited by {invitation.inviter.name}
							</p>
						)}
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="space-y-2 rounded-lg bg-muted/50 p-4">
							<div className="flex items-center gap-2">
								<Building className="h-4 w-4 text-muted-foreground" />
								<span className="font-medium">
									{invitation.organization.name}
								</span>
								<Badge variant="outline">@{invitation.organization.slug}</Badge>
							</div>
							<div className="flex items-center gap-2">
								<UserPlus className="h-4 w-4 text-muted-foreground" />
								<span>Role: </span>
								<Badge
									variant={
										["admin", "owner"].includes(invitation.role)
											? "default"
											: "secondary"
									}
								>
									{invitation.role}
								</Badge>
							</div>
							<div className="flex items-center gap-2">
								<Clock className="h-4 w-4 text-muted-foreground" />
								<span className="text-muted-foreground text-sm">
									Expires {new Date(invitation.expiresAt).toLocaleDateString()}
								</span>
							</div>
						</div>

						<Alert>
							<Mail className="h-4 w-4" />
							<AlertDescription>
								Please sign in or create an account with{" "}
								<strong>{invitation.email}</strong> to accept this invitation.
							</AlertDescription>
						</Alert>

						<div className="flex gap-3">
							<Button asChild className="flex-1">
								<Link to="/login" search={{ invitation: token }}>
									Sign In
								</Link>
							</Button>
							<Button variant="outline" asChild className="flex-1">
								<Link to="/register" search={{ invitation: token }}>
									Create Account
								</Link>
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	const emailMismatch = session.data.user.email !== invitation.email;

	if (emailMismatch) {
		return (
			<div className="container mx-auto max-w-2xl p-6">
				<Card className="border-destructive">
					<CardContent className="py-12 text-center">
						<XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
						<h2 className="mb-2 font-semibold text-lg">Email Mismatch</h2>
						<p className="mb-6 text-muted-foreground">
							This invitation was sent to <strong>{invitation.email}</strong>,
							but you're signed in as <strong>{session.data.user.email}</strong>
							.
						</p>
						<div className="flex justify-center gap-3">
							<Button variant="outline" asChild>
								<Link to="/dashboard">Go to Dashboard</Link>
							</Button>
							<Button onClick={() => authClient.signOut()}>
								Sign Out & Try Again
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-2xl p-6">
			<Card>
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
						<UserPlus className="h-6 w-6 text-primary" />
					</div>
					<CardTitle className="text-2xl">
						Join {invitation.organization.name}
					</CardTitle>
					{invitation.inviter && (
						<p className="text-muted-foreground">
							You've been invited by {invitation.inviter.name}
						</p>
					)}
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="space-y-3 rounded-lg bg-muted/50 p-4">
						<div className="flex items-center gap-2">
							<Building className="h-4 w-4 text-muted-foreground" />
							<span className="font-medium">
								{invitation.organization.name}
							</span>
							<Badge variant="outline">@{invitation.organization.slug}</Badge>
						</div>
						<div className="flex items-center gap-2">
							<UserPlus className="h-4 w-4 text-muted-foreground" />
							<span>Role: </span>
							<Badge
								variant={
									["admin", "owner"].includes(invitation.role)
										? "default"
										: "secondary"
								}
							>
								{invitation.role}
							</Badge>
						</div>
						<div className="flex items-center gap-2">
							<Clock className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground text-sm">
								Expires {new Date(invitation.expiresAt).toLocaleDateString()}
							</span>
						</div>
					</div>

					<div className="space-y-2">
						<h4 className="font-medium">
							As a {invitation.role.toLowerCase()}, you'll be able to:
						</h4>
						<ul className="ml-4 space-y-1 text-muted-foreground text-sm">
							{["admin", "owner"].includes(invitation.role) ? (
								<>
									<li>• Manage organization settings and members</li>
									<li>• Create and manage applications</li>
									<li>• Upload and activate builds</li>
									<li>• Full access to all features</li>
								</>
							) : (
								<>
									<li>• View organization applications</li>
									<li>• Upload builds to applications</li>
									<li>• View build history and status</li>
								</>
							)}
						</ul>
					</div>

					<div className="flex gap-3 pt-4">
						<Button
							onClick={() => acceptMutation.mutate()}
							disabled={acceptMutation.isPending || declineMutation.isPending}
							className="flex-1"
						>
							<CheckCircle className="mr-2 h-4 w-4" />
							{acceptMutation.isPending ? "Accepting..." : "Accept Invitation"}
						</Button>
						<Button
							variant="outline"
							onClick={() => declineMutation.mutate()}
							disabled={acceptMutation.isPending || declineMutation.isPending}
						>
							<XCircle className="mr-2 h-4 w-4" />
							{declineMutation.isPending ? "Declining..." : "Decline"}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
