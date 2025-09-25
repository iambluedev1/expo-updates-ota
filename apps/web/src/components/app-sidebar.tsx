import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
	ChevronDown,
	ChevronUp,
	Home,
	Plus,
	Settings,
	Smartphone,
	User2,
	Users,
} from "lucide-react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function AppSidebar() {
	const navigate = useNavigate();
	const location = useLocation();

	const { data: organizations, isPending: isLoading } =
		authClient.useListOrganizations();
	const { data: currentOrg } = authClient.useActiveOrganization();
	const { data: session } = authClient.useSession();

	const currentMember = currentOrg?.members.find(
		(d) => d.userId === session?.user.id,
	);

	const { data: apps } = useQuery({
		queryKey: currentOrg ? ["apps", currentOrg.id] : [],
		queryFn: async () => {
			const response = await api.api.apps.get({
				query: {
					organizationId: currentOrg!.id,
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
		enabled: currentOrg != null,
	});

	const handleOrgChange = async (newOrgId: string) => {
		await authClient.organization.setActive({
			organizationId: newOrgId,
		});
		navigate({ to: `/organizations/${newOrgId}` });
	};

	return (
		<Sidebar variant="inset">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<Link to="/dashboard">
								<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
									<Home className="size-4" />
								</div>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">
										expo-updates-server
									</span>
									<span className="truncate text-xs">Dashboard</span>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				{!isLoading && organizations && organizations.length > 0 && (
					<SidebarGroup>
						<SidebarGroupLabel>Organization</SidebarGroupLabel>
						<SidebarGroupContent>
							<Select
								value={currentOrg?.id || ""}
								onValueChange={handleOrgChange}
							>
								<SelectTrigger className="w-full">
									<SelectValue
										placeholder="Select organization"
										className="text-left"
									>
										{currentOrg ? currentOrg.name : "Select organization"}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{organizations.map((org) => (
										<SelectItem key={org.id} value={org.id}>
											{org.name}
										</SelectItem>
									))}
									<div className="mt-1 border-t pt-1">
										<Link
											to="/organizations/new"
											className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
										>
											<Plus className="size-4" />
											Create organization
										</Link>
									</div>
								</SelectContent>
							</Select>
						</SidebarGroupContent>
					</SidebarGroup>
				)}

				{currentOrg && (
					<SidebarGroup>
						<SidebarGroupLabel>Navigation</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								<Collapsible
									defaultOpen={location.pathname.includes("/apps/")}
									className="group/collapsible"
								>
									<SidebarMenuItem>
										<CollapsibleTrigger asChild>
											<SidebarMenuButton tooltip="Applications">
												<Smartphone className="size-4" />
												<span>Applications</span>
												<ChevronDown className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
											</SidebarMenuButton>
										</CollapsibleTrigger>
										<CollapsibleContent>
											<SidebarMenuSub>
												{(apps || []).map((app) => (
													<SidebarMenuSubItem key={app.id}>
														<SidebarMenuSubButton
															asChild
															isActive={location.pathname.includes(
																`/apps/${app.id}`,
															)}
														>
															<Link
																to={"/organizations/$orgId/apps/$appId"}
																params={{
																	orgId: currentOrg!.id,
																	appId: app.id,
																}}
															>
																<span>{app.title}</span>
															</Link>
														</SidebarMenuSubButton>
													</SidebarMenuSubItem>
												))}
												<SidebarMenuSubItem>
													<SidebarMenuSubButton asChild>
														<Link
															to={"/organizations/$orgId/apps/new"}
															params={{
																orgId: currentOrg!.id,
															}}
														>
															<Plus className="size-4" />
															<span>Create Application</span>
														</Link>
													</SidebarMenuSubButton>
												</SidebarMenuSubItem>
											</SidebarMenuSub>
										</CollapsibleContent>
									</SidebarMenuItem>
								</Collapsible>

								<SidebarMenuItem>
									<SidebarMenuButton
										asChild
										isActive={location.pathname.includes("/members")}
										tooltip="Members"
									>
										<Link
											to={"/organizations/$orgId"}
											hash="members"
											params={{
												orgId: currentOrg!.id,
											}}
										>
											<Users className="size-4" />
											<span>Members</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>

								{["admin", "owner"].includes(currentMember?.role || "") && (
									<SidebarMenuItem>
										<SidebarMenuButton
											asChild
											isActive={location.pathname.includes("/settings")}
											tooltip="Settings"
										>
											<Link
												to={"/organizations/$orgId/settings"}
												params={{ orgId: currentOrg!.id }}
											>
												<Settings className="size-4" />
												<span>Settings</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								)}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				)}
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						{session && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<SidebarMenuButton>
										<User2 /> {session.user.name}
										<ChevronUp className="ml-auto" />
									</SidebarMenuButton>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									side="top"
									className="w-[--radix-popper-anchor-width]"
								>
									<DropdownMenuItem
										onClick={() => {
											navigate({ to: "/change-password" });
										}}
									>
										<span>Account</span>
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() => {
											authClient.signOut({
												fetchOptions: {
													onSuccess: () => {
														navigate({
															to: "/",
														});
													},
												},
											});
										}}
									>
										<span>Sign out</span>
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
