import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Clock, Mail, Plus, Smartphone, Users, XCircle } from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/organizations/$orgId/")({
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
	const { session } = Route.useRouteContext();
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState("apps");

	useEffect(() => {
		const hash = window.location.hash.replace("#", "");
		if (hash === "members") {
			setActiveTab("members");
		} else {
			setActiveTab("apps");
		}
	}, []);

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

	const deleteInvitationMutation = useMutation({
		mutationFn: async (invitationId: string) => {
			const response = await authClient.organization.cancelInvitation({
				invitationId,
			});
			if (response.error) {
				throw new Error(
					response.error.message || "Failed to delete invitation",
					{
						cause: response.error,
					},
				);
			}
			return response.data;
		},
		onSuccess: () => {
			toast.success("Invitation deleted successfully!");
			queryClient.invalidateQueries({ queryKey: ["organisations", orgId] });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	if (isLoading) {
		return (
			<div className="animate-pulse space-y-6">
				<div className="grid gap-4 md:grid-cols-4">
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="h-24 rounded bg-muted" />
					))}
				</div>
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

	return (
		<div className="space-y-8">
			<div className="grid gap-6 md:grid-cols-2">
				<Card className="border border-border/50 bg-card/80 shadow-sm backdrop-blur transition-shadow hover:shadow-md">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-muted-foreground text-sm">
							Total Apps
						</CardTitle>
						<Smartphone className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{(apps || []).length}</div>
					</CardContent>
				</Card>
				<Card className="border border-border/50 bg-card/80 shadow-sm backdrop-blur transition-shadow hover:shadow-md">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-muted-foreground text-sm">
							Team Members
						</CardTitle>
						<Users className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">
							{organization.members.length}
						</div>
					</CardContent>
				</Card>
			</div>

			<Tabs
				value={activeTab}
				onValueChange={setActiveTab}
				className="space-y-6"
			>
				<TabsList>
					<TabsTrigger value="apps">Apps</TabsTrigger>
					<TabsTrigger value="members">Members</TabsTrigger>
				</TabsList>

				<TabsContent value="apps" className="space-y-6">
					<div className="flex items-center justify-between">
						<h2 className="font-bold text-2xl">Apps</h2>
						<Button asChild>
							<Link
								to={"/organizations/$orgId/apps/new"}
								params={{ orgId: organization.id }}
							>
								<Plus className="mr-2 h-4 w-4" />
								New App
							</Link>
						</Button>
					</div>

					{(apps || []).length === 0 ? (
						<Card>
							<CardContent className="py-12 text-center">
								<Smartphone className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
								<h3 className="font-semibold text-lg">No apps yet</h3>
								<p className="mt-2 text-muted-foreground">
									Get started by creating your first Expo app in this
									organization.
								</p>
								<Button asChild className="mt-4">
									<Link
										to={"/organizations/$orgId/apps/new"}
										params={{ orgId: organization.id }}
									>
										<Plus className="mr-2 h-4 w-4" />
										Create App
									</Link>
								</Button>
							</CardContent>
						</Card>
					) : (
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{(apps || []).map((app) => (
								<Card
									key={app.id}
									className="group transition-shadow hover:shadow-lg"
								>
									<CardHeader>
										<div className="flex items-center justify-between">
											<CardTitle className="transition-colors group-hover:text-primary">
												{app.title}
											</CardTitle>
											<Badge variant="secondary">@{app.slug}</Badge>
										</div>
										<p className="text-muted-foreground text-sm">
											Created {new Date(app.createdAt).toLocaleDateString()}
										</p>
									</CardHeader>
									<CardContent className="space-y-4">
										<Button asChild className="w-full" size="sm">
											<Link
												to={"/organizations/$orgId/apps/$appId"}
												params={{ orgId: organization.id, appId: app.id }}
											>
												View App
											</Link>
										</Button>
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</TabsContent>

				<TabsContent value="members" className="space-y-6">
					<div className="flex items-center justify-between">
						<h2 className="font-bold text-2xl">Members</h2>
						{["admin", "owner"].includes(currentUserMember?.role || "") && (
							<Button asChild>
								<Link
									to={"/organizations/$orgId/members/invite"}
									params={{ orgId: organization.id }}
								>
									<Plus className="mr-2 h-4 w-4" />
									Invite Member
								</Link>
							</Button>
						)}
					</div>

					{["admin", "owner"].includes(currentUserMember?.role || "") &&
						organization &&
						organization.invitations.filter((i) => i.status === "pending")
							.length > 0 && (
							<div className="space-y-4">
								<div className="flex items-center gap-2">
									<Clock className="h-5 w-5 text-muted-foreground" />
									<h3 className="font-semibold text-lg">Pending Invitations</h3>
									<Badge variant="secondary">
										{
											organization.invitations.filter(
												(i) => i.status === "pending",
											).length
										}
									</Badge>
								</div>
								<div className="grid gap-3">
									{organization.invitations
										.filter((i) => i.status === "pending")
										.map((invitation) => (
											<Card key={invitation.id} className="border-dashed">
												<CardContent className="flex items-center justify-between p-4">
													<div className="flex items-center gap-3">
														<div className="rounded-full bg-muted p-2">
															<Mail className="h-4 w-4 text-muted-foreground" />
														</div>
														<div>
															<p className="font-medium">{invitation.email}</p>
															<p className="text-muted-foreground text-sm">
																Expires{" "}
																{new Date(
																	invitation.expiresAt,
																).toLocaleDateString()}
															</p>
														</div>
													</div>
													<div className="flex items-center gap-2">
														<Badge
															variant={
																["admin", "owner"].includes(invitation.role)
																	? "default"
																	: "secondary"
															}
														>
															{invitation.role}
														</Badge>
														<AlertDialog>
															<AlertDialogTrigger asChild>
																<Button
																	variant="ghost"
																	size="icon"
																	className="text-destructive hover:bg-destructive/10 hover:text-destructive"
																>
																	<XCircle className="h-4 w-4" />
																</Button>
															</AlertDialogTrigger>
															<AlertDialogContent>
																<AlertDialogHeader>
																	<AlertDialogTitle>
																		Delete Invitation
																	</AlertDialogTitle>
																	<AlertDialogDescription>
																		Are you sure you want to delete the
																		invitation for "{invitation.email}"? This
																		action cannot be undone and the person will
																		no longer be able to join using this
																		invitation.
																	</AlertDialogDescription>
																</AlertDialogHeader>
																<AlertDialogFooter>
																	<AlertDialogCancel>Cancel</AlertDialogCancel>
																	<AlertDialogAction
																		onClick={() =>
																			deleteInvitationMutation.mutate(
																				invitation.id,
																			)
																		}
																		className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
																		disabled={
																			deleteInvitationMutation.isPending
																		}
																	>
																		{deleteInvitationMutation.isPending
																			? "Deleting..."
																			: "Delete Invitation"}
																	</AlertDialogAction>
																</AlertDialogFooter>
															</AlertDialogContent>
														</AlertDialog>
													</div>
												</CardContent>
											</Card>
										))}
								</div>
							</div>
						)}

					<div className="space-y-4">
						<h3 className="font-semibold text-lg">Team Members</h3>
						<div className="grid gap-4">
							{organization.members.map((member) => (
								<Card key={member.id}>
									<CardContent className="flex items-center justify-between p-6">
										<div className="flex items-center gap-4">
											<Avatar>
												<AvatarFallback>
													{member.user.name.charAt(0).toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<div>
												<p className="font-medium">{member.user.name}</p>
												<p className="text-muted-foreground text-sm">
													{member.user.email}
												</p>
											</div>
										</div>
										<div className="flex items-center gap-2">
											<Badge
												variant={
													["admin", "owner"].includes(member.role)
														? "default"
														: "secondary"
												}
											>
												{member.role}
											</Badge>
											<p className="text-muted-foreground text-sm">
												Joined {new Date(member.createdAt).toLocaleDateString()}
											</p>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
