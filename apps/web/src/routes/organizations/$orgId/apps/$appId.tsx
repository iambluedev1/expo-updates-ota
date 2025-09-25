import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useMatches,
} from "@tanstack/react-router";
import {
	Activity,
	BarChart3,
	CheckCircle,
	ChevronDown,
	ChevronRight,
	Key,
	MoreVertical,
	Plus,
	RotateCcw,
	Settings,
	Upload,
	XCircle,
} from "lucide-react";
import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/organizations/$orgId/apps/$appId")({
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
	const { orgId, appId } = Route.useParams();
	const queryClient = useQueryClient();
	const matches = useMatches();
	const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

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

	const { data: stats } = useQuery({
		queryKey: ["app-stats", appId, 7],
		queryFn: async () => {
			if (!app?.saveDownloadStatistics) return null;
			const response = await api.api.stats.app({ appId }).get({
				query: { days: 7 },
			});
			if (response.error) return null;
			return response.data;
		},
		enabled: !!app?.saveDownloadStatistics,
	});

	const activateBuildMutation = useMutation({
		mutationFn: async (buildId: string) => {
			const response = await api.api.builds({ id: buildId }).activate.patch();
			if (response.error) {
				throw new Error(
					(response.error.value as any).message || "Failed to activate build",
					{
						cause: response.error,
					},
				);
			}
			return response.data;
		},
		onSuccess: () => {
			toast.success("Build activated successfully!");
			queryClient.invalidateQueries({ queryKey: ["app", appId] });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const rollbackBuildMutation = useMutation({
		mutationFn: async (buildId: string) => {
			const response = await api.api.builds({ id: buildId }).rollback.patch();
			if (response.error) {
				throw new Error(
					(response.error.value as any).message || "Failed to rollback build",
					{
						cause: response.error,
					},
				);
			}
			return response.data;
		},
		onSuccess: () => {
			toast.success("Build marked for rollback!");
			queryClient.invalidateQueries({ queryKey: ["app", appId] });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const deleteBuildMutation = useMutation({
		mutationFn: async (buildId: string) => {
			const response = await api.api.builds({ id: buildId }).delete();
			if (response.error) {
				throw new Error(
					(response.error.value as any).message || "Failed to delete build",
					{
						cause: response.error,
					},
				);
			}
			return response.data;
		},
		onSuccess: () => {
			toast.success("Build deleted successfully!");
			queryClient.invalidateQueries({ queryKey: ["app", appId] });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const deleteTokenMutation = useMutation({
		mutationFn: async (tokenId: string) => {
			const response = await api.api.tokens({ id: tokenId }).delete();
			if (response.error) {
				throw new Error(
					(response.error.value as any).message || "Failed to delete token",
					{
						cause: response.error,
					},
				);
			}
			return response.data;
		},
		onSuccess: () => {
			toast.success("Token deleted successfully!");
			queryClient.invalidateQueries({ queryKey: ["app", appId] });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	if (isLoading) {
		return (
			<div className="container mx-auto p-6">
				<div className="animate-pulse space-y-6">
					<div className="h-8 w-1/3 rounded bg-muted" />
					<div className="h-4 w-1/2 rounded bg-muted" />
					<div className="grid gap-6 md:grid-cols-4">
						{[1, 2, 3, 4].map((i) => (
							<div key={i} className="h-24 rounded bg-muted" />
						))}
					</div>
				</div>
			</div>
		);
	}

	if (!app) {
		return (
			<div className="container mx-auto p-6">
				<div className="py-12 text-center">
					<h2 className="font-semibold text-lg">App not found</h2>
					<p className="mt-2 text-muted-foreground">
						The app you're looking for doesn't exist or you don't have access to
						it.
					</p>
					<Button asChild className="mt-4">
						<Link to="/organizations/$orgId" params={{ orgId }}>
							Back to Organization
						</Link>
					</Button>
				</div>
			</div>
		);
	}

	const toggleGroup = (groupId: string) => {
		const newOpenGroups = new Set(openGroups);
		if (newOpenGroups.has(groupId)) {
			newOpenGroups.delete(groupId);
		} else {
			newOpenGroups.add(groupId);
		}
		setOpenGroups(newOpenGroups);
	};

	const _allBuilds = app.buildGroups.flatMap((runtime) => runtime.builds);
	const _activeRuntime = app.buildGroups.find(
		(runtime) => runtime.activeBuild && !runtime.isRollback,
	);

	const platformData = app.buildGroups.reduce(
		(acc, runtime) => {
			const platform = runtime.platform;
			const channel = runtime.channel;

			if (!acc[platform]) {
				acc[platform] = {};
			}
			if (!acc[platform][channel]) {
				acc[platform][channel] = [];
			}

			acc[platform][channel].push(runtime);
			return acc;
		},
		{} as Record<string, Record<string, typeof app.buildGroups>>,
	);

	const shortenId = (id: string) => {
		return id.split("-")[0];
	};

	const currentMatch = matches[matches.length - 1];
	const isChildRoute =
		currentMatch?.routeId !== "/organizations/$orgId/apps/$appId";

	if (isChildRoute) {
		return <Outlet />;
	}

	return (
		<div className="space-y-6">
			<Tabs defaultValue="builds" className="space-y-6">
				<div className="flex items-center justify-between">
					<TabsList className="grid w-full grid-cols-3 lg:w-[480px]">
						<TabsTrigger value="builds">Builds</TabsTrigger>
						<TabsTrigger value="tokens">Access Tokens</TabsTrigger>
						<TabsTrigger value="stats">Statistics</TabsTrigger>
					</TabsList>

					<Button variant="outline" asChild>
						<Link
							to="/organizations/$orgId/apps/$appId/settings"
							params={{ orgId, appId }}
						>
							<Settings className="mr-2 h-4 w-4" />
							Settings
						</Link>
					</Button>
				</div>

				<TabsContent value="builds" className="space-y-6">
					<div className="flex items-center justify-between">
						<h2 className="font-bold text-2xl">Builds</h2>
					</div>

					{app.buildGroups.length === 0 ? (
						<Card className="border-2 border-muted-foreground/25 border-dashed bg-muted/10">
							<CardContent className="py-16 text-center">
								<div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30">
									<Upload className="h-8 w-8 text-blue-600 dark:text-blue-400" />
								</div>
								<h3 className="mb-3 font-semibold text-xl">No builds yet</h3>
								<p className="mx-auto max-w-md text-muted-foreground leading-relaxed">
									Run{" "}
									<code className="rounded bg-muted px-2 py-1 font-mono text-sm">
										npx expo-updates-ota@latest init
									</code>{" "}
									then{" "}
									<code className="rounded bg-muted px-2 py-1 font-mono text-sm">
										npx expo-updates-ota@latest publish
									</code>{" "}
									to publish your first build
								</p>
							</CardContent>
						</Card>
					) : (
						<Tabs
							defaultValue={Object.keys(platformData)[0]}
							className="w-full"
						>
							<TabsList className="grid w-full grid-cols-2">
								{Object.keys(platformData)
									.sort()
									.map((platform) => (
										<TabsTrigger
											key={platform}
											value={platform}
											className="capitalize"
										>
											{platform}
										</TabsTrigger>
									))}
							</TabsList>

							{Object.entries(platformData).map(([platform, channels]) => (
								<TabsContent
									key={platform}
									value={platform}
									className="space-y-4"
								>
									<Tabs
										defaultValue={Object.keys(channels)[0]}
										className="w-full"
									>
										<TabsList
											className="grid w-full"
											style={{
												gridTemplateColumns: `repeat(${Object.keys(channels).length}, minmax(0, 1fr))`,
											}}
										>
											{Object.keys(channels)
												.sort()
												.map((channel) => (
													<TabsTrigger
														key={channel}
														value={channel}
														className="capitalize"
													>
														{channel}
													</TabsTrigger>
												))}
										</TabsList>

										{Object.entries(channels).map(([channel, runtimes]) => (
											<TabsContent key={channel} value={channel}>
												{runtimes.map((runtime) => {
													const groupId = `${runtime.runtimeVersion}-${runtime.platform}-${runtime.channel}`;
													const isOpen = openGroups.has(groupId);
													const activeBuild = runtime.activeBuild;
													const hasBuilds = runtime.builds.length > 0;

													const runtimeStats =
														stats?.byRuntimeVersion?.[runtime.runtimeVersion];
													const runtimeActiveUsers = runtimeStats?.count || 0;

													return (
														<Collapsible
															key={groupId}
															className="border-0 bg-card/50 shadow-md backdrop-blur"
															open={isOpen}
															onOpenChange={() => toggleGroup(groupId)}
														>
															<CollapsibleTrigger asChild>
																<CardHeader className="cursor-pointer border-b bg-muted/20 pt-2 transition-colors hover:bg-muted/30">
																	<div className="flex items-center justify-between">
																		<div className="flex items-center gap-4">
																			<div className="flex items-center gap-2">
																				{hasBuilds &&
																					(isOpen ? (
																						<ChevronDown className="h-4 w-4" />
																					) : (
																						<ChevronRight className="h-4 w-4" />
																					))}
																				<div>
																					<CardTitle className="font-mono font-semibold text-lg">
																						{runtime.runtimeVersion}
																					</CardTitle>
																					<div className="mt-1 flex items-center gap-2">
																						{runtime.isRollback ? (
																							<Badge variant="destructive">
																								Rollback to Embedded
																							</Badge>
																						) : activeBuild ? (
																							<Badge variant="default">
																								Active
																							</Badge>
																						) : (
																							<Badge variant="secondary">
																								No Update Available
																							</Badge>
																						)}
																						<Badge variant="secondary">
																							{runtime.builds.length} builds
																						</Badge>
																						{stats &&
																							runtimeActiveUsers > 0 && (
																								<Badge
																									variant="outline"
																									className="gap-1"
																								>
																									<Activity className="h-3 w-3" />
																									{runtimeActiveUsers} active
																									(7d)
																								</Badge>
																							)}
																					</div>
																				</div>
																			</div>
																		</div>
																		<div className="flex items-center gap-2">
																			{activeBuild && (
																				<div className="text-muted-foreground text-sm">
																					{new Date(
																						activeBuild.createdAt,
																					).toLocaleString()}
																				</div>
																			)}
																			{activeBuild && (
																				<DropdownMenu>
																					<DropdownMenuTrigger asChild>
																						<Button
																							variant="ghost"
																							size="icon"
																							onClick={(e) =>
																								e.stopPropagation()
																							}
																						>
																							<MoreVertical className="h-4 w-4" />
																						</Button>
																					</DropdownMenuTrigger>
																					<DropdownMenuContent align="end">
																						{runtime.isRollback && (
																							<DropdownMenuItem
																								onClick={() =>
																									activateBuildMutation.mutate(
																										activeBuild.id,
																									)
																								}
																								disabled={
																									activateBuildMutation.isPending
																								}
																							>
																								<CheckCircle className="mr-2 h-4 w-4" />
																								Restore Updates
																							</DropdownMenuItem>
																						)}
																						{!runtime.isRollback && (
																							<DropdownMenuItem
																								onClick={() =>
																									rollbackBuildMutation.mutate(
																										activeBuild.id,
																									)
																								}
																								disabled={
																									rollbackBuildMutation.isPending
																								}
																							>
																								<RotateCcw className="mr-2 h-4 w-4" />
																								Rollback to Embedded
																							</DropdownMenuItem>
																						)}
																					</DropdownMenuContent>
																				</DropdownMenu>
																			)}
																		</div>
																	</div>
																</CardHeader>
															</CollapsibleTrigger>
															{hasBuilds && (
																<CollapsibleContent>
																	<CardContent className="p-0">
																		<Table>
																			<TableHeader>
																				<TableRow>
																					<TableHead>Build ID</TableHead>
																					<TableHead>Message</TableHead>
																					<TableHead>Author</TableHead>
																					<TableHead>Created</TableHead>
																					{stats && (
																						<TableHead>Active Users</TableHead>
																					)}
																					<TableHead className="text-right">
																						Actions
																					</TableHead>
																				</TableRow>
																			</TableHeader>
																			<TableBody>
																				{runtime.builds.map((build) => {
																					const buildStats =
																						stats?.byBuild?.find(
																							(b) => b.buildId === build.id,
																						);
																					const buildActiveUsers =
																						buildStats?.count || 0;

																					return (
																						<TableRow key={build.id}>
																							<TableCell>
																								<div className="flex items-center gap-2">
																									{runtime.activeBuild?.id ===
																										build.id && (
																										<Badge
																											variant="default"
																											className="text-xs"
																										>
																											Active
																										</Badge>
																									)}
																									<code className="rounded bg-muted px-2 py-1 font-mono text-sm">
																										{shortenId(build.id)}
																									</code>
																								</div>
																							</TableCell>
																							<TableCell>
																								<span className="text-sm">
																									{build.message ||
																										"No message"}
																								</span>
																							</TableCell>
																							<TableCell>
																								<div className="flex items-center gap-2">
																									<span className="text-sm">
																										{build.author?.name ||
																											"Unknown"}
																									</span>
																									<span className="text-muted-foreground text-xs">
																										(
																										{build.author?.email ||
																											"no email"}
																										)
																									</span>
																								</div>
																							</TableCell>
																							<TableCell>
																								<span className="text-sm">
																									{new Date(
																										build.createdAt,
																									).toLocaleString()}
																								</span>
																							</TableCell>
																							{stats && (
																								<TableCell>
																									{buildActiveUsers > 0 ? (
																										<div className="flex items-center gap-1">
																											<Activity className="h-3 w-3 text-muted-foreground" />
																											<span className="text-sm">
																												{buildActiveUsers}
																											</span>
																											<span className="text-muted-foreground text-xs">
																												(7d)
																											</span>
																										</div>
																									) : (
																										<span className="text-muted-foreground text-sm">
																											-
																										</span>
																									)}
																								</TableCell>
																							)}
																							<TableCell className="text-right">
																								<div className="flex items-center justify-end gap-2">
																									{runtime.activeBuild?.id !==
																										build.id && (
																										<Button
																											variant="outline"
																											size="sm"
																											onClick={() =>
																												activateBuildMutation.mutate(
																													build.id,
																												)
																											}
																											disabled={
																												activateBuildMutation.isPending
																											}
																										>
																											<CheckCircle className="mr-1 h-3 w-3" />
																											Activate
																										</Button>
																									)}
																									<AlertDialog>
																										<AlertDialogTrigger asChild>
																											<Button
																												variant="ghost"
																												size="icon"
																												className="text-destructive hover:bg-destructive/10"
																											>
																												<XCircle className="h-4 w-4" />
																											</Button>
																										</AlertDialogTrigger>
																										<AlertDialogContent>
																											<AlertDialogHeader>
																												<AlertDialogTitle>
																													Delete Build
																												</AlertDialogTitle>
																												<AlertDialogDescription>
																													Are you sure you want
																													to delete build{" "}
																													{shortenId(build.id)}?
																													This action cannot be
																													undone and will remove
																													all associated files.
																												</AlertDialogDescription>
																											</AlertDialogHeader>
																											<AlertDialogFooter>
																												<AlertDialogCancel>
																													Cancel
																												</AlertDialogCancel>
																												<AlertDialogAction
																													onClick={() =>
																														deleteBuildMutation.mutate(
																															build.id,
																														)
																													}
																													className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
																												>
																													Delete
																												</AlertDialogAction>
																											</AlertDialogFooter>
																										</AlertDialogContent>
																									</AlertDialog>
																								</div>
																							</TableCell>
																						</TableRow>
																					);
																				})}
																			</TableBody>
																		</Table>
																	</CardContent>
																</CollapsibleContent>
															)}
														</Collapsible>
													);
												})}
											</TabsContent>
										))}
									</Tabs>
								</TabsContent>
							))}
						</Tabs>
					)}
				</TabsContent>

				<TabsContent value="tokens" className="space-y-6">
					<div className="flex items-center justify-between">
						<h2 className="font-bold text-2xl">Access Tokens</h2>
						<Button
							asChild
							className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
						>
							<Link
								to="/organizations/$orgId/apps/$appId/tokens/new"
								params={{ orgId, appId }}
							>
								<Plus className="mr-2 h-4 w-4" />
								New Token
							</Link>
						</Button>
					</div>

					{app.tokens.length === 0 ? (
						<Card className="border-2 border-muted-foreground/25 border-dashed bg-muted/10">
							<CardContent className="py-16 text-center">
								<div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30">
									<Key className="h-8 w-8 text-purple-600 dark:text-purple-400" />
								</div>
								<h3 className="mb-3 font-semibold text-xl">
									No access tokens yet
								</h3>
								<p className="mx-auto mb-6 max-w-md text-muted-foreground leading-relaxed">
									Create access tokens to allow external tools and CLI clients
									to interact with your app.
								</p>
								<Button
									asChild
									className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
								>
									<Link
										to="/organizations/$orgId/apps/$appId/tokens/new"
										params={{ orgId, appId }}
									>
										<Plus className="mr-2 h-4 w-4" />
										Create Token
									</Link>
								</Button>
							</CardContent>
						</Card>
					) : (
						<Card className="border-0 bg-card/50 shadow-md backdrop-blur">
							<CardHeader className="border-b bg-muted/20">
								<CardTitle className="font-semibold text-lg">
									Active Tokens
								</CardTitle>
							</CardHeader>
							<CardContent className="p-0">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Name</TableHead>
											<TableHead>Last Used</TableHead>
											<TableHead>Created</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{app.tokens.map((token) => (
											<TableRow key={token.id}>
												<TableCell className="font-medium">
													{token.name}
												</TableCell>
												<TableCell>
													{token.lastUsedAt
														? new Date(token.lastUsedAt).toLocaleString()
														: "Never"}
												</TableCell>
												<TableCell>
													{new Date(token.createdAt).toLocaleString()}
												</TableCell>
												<TableCell className="text-right">
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
																	Delete Access Token
																</AlertDialogTitle>
																<AlertDialogDescription>
																	Are you sure you want to delete the token "
																	{token.name}"? This action cannot be undone
																	and will immediately revoke access for any
																	applications using this token.
																</AlertDialogDescription>
															</AlertDialogHeader>
															<AlertDialogFooter>
																<AlertDialogCancel>Cancel</AlertDialogCancel>
																<AlertDialogAction
																	onClick={() =>
																		deleteTokenMutation.mutate(token.id)
																	}
																	className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
																	disabled={deleteTokenMutation.isPending}
																>
																	{deleteTokenMutation.isPending
																		? "Deleting..."
																		: "Delete Token"}
																</AlertDialogAction>
															</AlertDialogFooter>
														</AlertDialogContent>
													</AlertDialog>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				<TabsContent value="stats" className="space-y-6">
					<div className="flex items-center justify-between">
						<h2 className="font-bold text-2xl">Usage Statistics</h2>
					</div>

					{!app.saveDownloadStatistics ? (
						<Card className="border-2 border-muted-foreground/25 border-dashed bg-muted/10">
							<CardContent className="py-16 text-center">
								<div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30">
									<BarChart3 className="h-8 w-8 text-green-600 dark:text-green-400" />
								</div>
								<h3 className="mb-3 font-semibold text-xl">
									Statistics disabled
								</h3>
								<p className="mx-auto max-w-md text-muted-foreground leading-relaxed">
									Enable usage statistics in the app settings to start tracking
									your app's active installations and version distribution.
								</p>
								<Button variant="outline" asChild className="mt-4">
									<Link
										to="/organizations/$orgId/apps/$appId/settings"
										params={{ orgId, appId }}
									>
										<Settings className="mr-2 h-4 w-4" />
										Go to Settings
									</Link>
								</Button>
							</CardContent>
						</Card>
					) : (
						<StatsOverview appId={appId} />
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}

function StatsOverview({ appId }: { appId: string }) {
	const [days, setDays] = useState(30);

	const { data: stats, isLoading } = useQuery({
		queryKey: ["app-stats", appId, days],
		queryFn: async () => {
			const response = await api.api.stats.app({ appId }).get({
				query: { days },
			});
			if (response.error) {
				throw new Error(
					(response.error.value as any).message || "Failed to fetch statistics",
					{
						cause: response.error,
					},
				);
			}
			return response.data;
		},
	});

	if (isLoading) {
		return (
			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
				{[1, 2, 3, 4].map((i) => (
					<Card key={i}>
						<CardHeader>
							<div className="h-4 w-24 animate-pulse rounded bg-muted" />
						</CardHeader>
						<CardContent>
							<div className="h-8 w-16 animate-pulse rounded bg-muted" />
						</CardContent>
					</Card>
				))}
			</div>
		);
	}

	if (!stats) {
		return (
			<Card>
				<CardContent className="py-8 text-center">
					<p className="text-muted-foreground">No statistics available yet.</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex gap-2">
					<Button
						variant={days === 7 ? "default" : "outline"}
						size="sm"
						onClick={() => setDays(7)}
					>
						7 days
					</Button>
					<Button
						variant={days === 30 ? "default" : "outline"}
						size="sm"
						onClick={() => setDays(30)}
					>
						30 days
					</Button>
					<Button
						variant={days === 90 ? "default" : "outline"}
						size="sm"
						onClick={() => setDays(90)}
					>
						90 days
					</Button>
				</div>
			</div>

			<div className="grid gap-6 md:grid-cols-3">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="font-medium text-muted-foreground text-sm">
							App Opens
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-3xl">{stats.totalDownloads}</div>
						<p className="mt-1 text-muted-foreground text-xs">
							Total manifest checks
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="font-medium text-muted-foreground text-sm">
							Native Version
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-3xl">
							{stats.totalDownloads > 0
								? `${Math.round((stats.updateTypeDistribution.native / stats.totalDownloads) * 100)}%`
								: "0%"}
						</div>
						<p className="mt-1 text-muted-foreground text-xs">
							{stats.updateTypeDistribution.native} running embedded build
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="font-medium text-muted-foreground text-sm">
							OTA Version
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-3xl">
							{stats.totalDownloads > 0
								? `${Math.round((stats.updateTypeDistribution.ota / stats.totalDownloads) * 100)}%`
								: "0%"}
						</div>
						<p className="mt-1 text-muted-foreground text-xs">
							{stats.updateTypeDistribution.ota} running OTA update
						</p>
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Platform Distribution</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{Object.entries(stats.byPlatform)
								.sort(([, a], [, b]) => b - a)
								.map(([platform, count]) => {
									const percentage =
										stats.totalDownloads > 0
											? Math.round((count / stats.totalDownloads) * 100)
											: 0;
									return (
										<div key={platform} className="space-y-1">
											<div className="flex items-center justify-between text-sm">
												<span className="font-medium capitalize">
													{platform}
												</span>
												<span className="text-muted-foreground">
													{count} ({percentage}%)
												</span>
											</div>
											<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
												<div
													className="h-full bg-primary transition-all"
													style={{ width: `${percentage}%` }}
												/>
											</div>
										</div>
									);
								})}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Channel Distribution</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{Object.entries(stats.byChannel)
								.sort(([, a], [, b]) => b - a)
								.map(([channel, count]) => {
									const percentage =
										stats.totalDownloads > 0
											? Math.round((count / stats.totalDownloads) * 100)
											: 0;
									return (
										<div key={channel} className="space-y-1">
											<div className="flex items-center justify-between text-sm">
												<span className="font-medium capitalize">
													{channel}
												</span>
												<span className="text-muted-foreground">
													{count} ({percentage}%)
												</span>
											</div>
											<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
												<div
													className="h-full bg-primary transition-all"
													style={{ width: `${percentage}%` }}
												/>
											</div>
										</div>
									);
								})}
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Runtime Version Distribution</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{Object.entries(stats.byRuntimeVersion)
							.sort(([, a], [, b]) => b.count - a.count)
							.map(([version, data]) => {
								const percentage =
									stats.totalDownloads > 0
										? Math.round((data.count / stats.totalDownloads) * 100)
										: 0;
								const iosPercentage =
									data.count > 0
										? Math.round((data.platforms.ios / data.count) * 100)
										: 0;
								const androidPercentage =
									data.count > 0
										? Math.round((data.platforms.android / data.count) * 100)
										: 0;
								return (
									<div key={version} className="space-y-2">
										<div className="flex items-center justify-between">
											<code className="rounded bg-muted px-2 py-1 font-mono text-sm">
												{version}
											</code>
											<span className="text-muted-foreground text-sm">
												{data.count} ({percentage}%)
											</span>
										</div>
										<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
											<div
												className="h-full bg-primary transition-all"
												style={{ width: `${percentage}%` }}
											/>
										</div>
										<div className="flex gap-4 pl-4 text-muted-foreground text-xs">
											<span>
												iOS: {data.platforms.ios} ({iosPercentage}%)
											</span>
											<span>
												Android: {data.platforms.android} ({androidPercentage}%)
											</span>
										</div>
									</div>
								);
							})}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Build Distribution</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{stats.byBuild && stats.byBuild.length > 0 ? (
							stats.byBuild
								.sort((a, b) => b.count - a.count)
								.map((build) => {
									const percentage =
										stats.totalDownloads > 0
											? Math.round((build.count / stats.totalDownloads) * 100)
											: 0;
									const iosPercentage =
										build.count > 0
											? Math.round((build.platforms.ios / build.count) * 100)
											: 0;
									const androidPercentage =
										build.count > 0
											? Math.round(
													(build.platforms.android / build.count) * 100,
												)
											: 0;
									const shortId = build.buildId.split("-")[0];
									return (
										<div key={build.buildId} className="space-y-2">
											<div className="flex items-center justify-between gap-2">
												<div className="flex min-w-0 flex-1 items-center gap-2">
													<code className="shrink-0 rounded bg-muted px-2 py-1 font-mono text-xs">
														{shortId}
													</code>
													<span className="truncate text-muted-foreground text-sm">
														{build.message || "No message"}
													</span>
												</div>
												<span className="shrink-0 text-muted-foreground text-sm">
													{build.count} ({percentage}%)
												</span>
											</div>
											<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
												<div
													className="h-full bg-primary transition-all"
													style={{ width: `${percentage}%` }}
												/>
											</div>
											<div className="flex gap-4 pl-4 text-muted-foreground text-xs">
												<span className="capitalize">{build.platform}</span>
												<span>{build.runtimeVersion}</span>
												<span className="capitalize">{build.channel}</span>
												<span>
													iOS: {build.platforms.ios} ({iosPercentage}%)
												</span>
												<span>
													Android: {build.platforms.android} (
													{androidPercentage}%)
												</span>
											</div>
										</div>
									);
								})
						) : (
							<p className="py-4 text-center text-muted-foreground text-sm">
								No build data available
							</p>
						)}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Daily Activity</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						{Object.entries(stats.timeline)
							.sort(([a], [b]) => b.localeCompare(a))
							.slice(0, 10)
							.map(([date, count]) => (
								<div key={date} className="flex items-center justify-between">
									<span>{new Date(date).toLocaleDateString()}</span>
									<span className="font-semibold">{count} opens</span>
								</div>
							))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
