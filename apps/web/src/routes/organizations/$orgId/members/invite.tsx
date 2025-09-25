import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { Mail, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/organizations/$orgId/members/invite")({
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

type Role = "member" | "admin" | "owner";

function RouteComponent() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { orgId } = Route.useParams();
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<Role>("member");

	const inviteMemberMutation = useMutation({
		mutationFn: async ({ email, role }: { email: string; role: Role }) => {
			const response = await authClient.organization.inviteMember({
				email,
				role: role as Role,
				organizationId: orgId,
			});

			if (response.error) {
				throw new Error(response.error.message || "Failed to invite member", {
					cause: response.error,
				});
			}

			return response.data;
		},
		onSuccess: (invitation) => {
			toast.success(`Invitation sent to ${invitation.email}!`);
			queryClient.invalidateQueries({ queryKey: ["organization", orgId] });
			navigate({ to: `/organizations/${orgId}`, hash: "members" });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!email.trim()) {
			toast.error("Email is required");
			return;
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			toast.error("Please enter a valid email address");
			return;
		}

		inviteMemberMutation.mutate({ email, role });
	};

	return (
		<div className="mx-auto max-w-2xl space-y-8">
			<div className="flex items-center gap-4">
				<div>
					<h1 className="font-bold text-3xl tracking-tight">Invite Member</h1>
					<p className="mt-2 text-muted-foreground">
						Add a new team member to this organization by inviting them via
						email.
					</p>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<UserPlus className="h-5 w-5" />
						Member Information
					</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-6">
						<div className="space-y-2">
							<Label htmlFor="email">Email Address</Label>
							<div className="relative">
								<Mail className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-muted-foreground" />
								<Input
									type="email"
									placeholder="colleague@example.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									disabled={inviteMemberMutation.isPending}
									className="pl-10"
								/>
							</div>
							<p className="text-muted-foreground text-sm">
								We'll send an invitation email to this address. If they don't
								have an account, they can create one when accepting the
								invitation.
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="role">Role</Label>
							<Select
								value={role}
								onValueChange={(value: string) => setRole(value as Role)}
								disabled={inviteMemberMutation.isPending}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select a role" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="member">Member</SelectItem>
									<SelectItem value="admin">Admin</SelectItem>
								</SelectContent>
							</Select>
							<p className="text-muted-foreground text-sm">
								Choose the appropriate role for this team member.
							</p>
						</div>

						<Alert>
							<AlertDescription>
								<div className="space-y-2">
									<p className="font-medium">Role Permissions:</p>
									<div className="space-y-1 text-sm">
										<p>
											<strong>Member:</strong> Can upload builds and view app
											information
										</p>
										<p>
											<strong>Admin:</strong> Full access including member
											management, app creation, and build activation
										</p>
									</div>
								</div>
							</AlertDescription>
						</Alert>

						<div className="flex gap-3 pt-4">
							<Button
								type="submit"
								disabled={inviteMemberMutation.isPending}
								className="flex-1"
							>
								{inviteMemberMutation.isPending
									? "Inviting..."
									: "Invite Member"}
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

			<Card>
				<CardHeader>
					<CardTitle>How Invitations Work</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-muted-foreground text-sm">
					<p>• An invitation email will be sent to the provided address</p>
					<p>
						• If they don't have an account, they can create one when accepting
					</p>
					<p>
						• You can change their role later from the organization members page
					</p>
					<p>• Only organization admins can invite new members</p>
				</CardContent>
			</Card>
		</div>
	);
}
