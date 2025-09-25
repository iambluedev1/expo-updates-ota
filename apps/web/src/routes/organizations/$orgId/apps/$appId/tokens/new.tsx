import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { Copy, Eye, EyeOff, Key } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute(
	"/organizations/$orgId/apps/$appId/tokens/new",
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

type CreatedToken = Awaited<ReturnType<typeof api.api.tokens.post>>["data"];

function RouteComponent() {
	const navigate = useNavigate();
	const { orgId, appId } = Route.useParams();
	const [name, setName] = useState("");
	const [createdToken, setCreatedToken] = useState<CreatedToken | null>(null);
	const [showToken, setShowToken] = useState(true);
	const queryClient = useQueryClient();

	const createTokenMutation = useMutation({
		mutationFn: async (data: { name: string; appId: string }) => {
			const response = await api.api.tokens.post(data);

			if (response.error) {
				throw new Error(
					(response.error.value as any).message || "Failed to create token",
					{ cause: response.error },
				);
			}

			return response.data;
		},
		onSuccess: (token) => {
			toast.success("Access token created successfully!");
			queryClient.invalidateQueries({
				queryKey: ["app", appId],
			});
			setCreatedToken(token);
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) {
			toast.error("Token name is required");
			return;
		}

		createTokenMutation.mutate({ name, appId });
	};

	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success("Token copied to clipboard!");
		} catch (_error) {
			toast.error("Failed to copy token to clipboard");
		}
	};

	const handleDone = () => {
		navigate({
			to: "/organizations/$orgId/apps/$appId",
			params: { orgId, appId },
			hash: "tokens",
		});
	};

	if (createdToken) {
		return (
			<div className="container mx-auto max-w-2xl p-6">
				<div className="mb-8 flex items-center gap-4">
					<div>
						<h1 className="font-bold text-3xl tracking-tight">
							Access Token Created
						</h1>
						<p className="mt-2 text-muted-foreground">
							Your access token has been created successfully. Make sure to copy
							it now as you won't be able to see it again.
						</p>
					</div>
				</div>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Key className="h-5 w-5" />
							{createdToken.name}
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-6">
						<Alert>
							<AlertDescription>
								<strong>Important:</strong> Make sure to copy your access token
								now. You won't be able to see it again!
							</AlertDescription>
						</Alert>

						<div className="space-y-2">
							<Label>Access Token</Label>
							<div className="flex items-center gap-2">
								<div className="relative flex-1">
									<Input
										value={createdToken.token}
										type={showToken ? "text" : "password"}
										readOnly
										className="pr-20 font-mono text-sm"
									/>
									<div className="-translate-y-1/2 absolute top-1/2 right-2 flex gap-1">
										<Button
											variant="ghost"
											size="icon"
											onClick={() => setShowToken(!showToken)}
											className="h-8 w-8"
										>
											{showToken ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</Button>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => copyToClipboard(createdToken.token)}
											className="h-8 w-8"
										>
											<Copy className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</div>
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<Label>Token Name</Label>
								<div className="flex items-center gap-2">
									<Badge variant="outline">{createdToken.name}</Badge>
								</div>
							</div>
							<div className="space-y-2">
								<Label>Created</Label>
								<p className="text-muted-foreground text-sm">
									{new Date(createdToken.createdAt).toLocaleString()}
								</p>
							</div>
						</div>

						<div className="space-y-4 border-t pt-4">
							<h3 className="font-semibold text-lg">Using this token</h3>
							<div className="space-y-3 text-sm">
								<p className="text-muted-foreground">
									Use this token to authenticate API requests or CLI commands:
								</p>
								<div className="rounded-lg bg-muted p-3 font-mono text-sm">
									<p>npx expo-updates-ota@latest auth</p>
								</div>
							</div>
						</div>

						<div className="flex gap-3 pt-4">
							<Button onClick={handleDone} className="flex-1">
								Done
							</Button>
							<Button
								variant="outline"
								onClick={() => copyToClipboard(createdToken.token)}
							>
								<Copy className="mr-2 h-4 w-4" />
								Copy Token
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-2xl p-6">
			<div className="mb-8 flex items-center gap-4">
				<div>
					<h1 className="font-bold text-3xl tracking-tight">
						Create Access Token
					</h1>
					<p className="mt-2 text-muted-foreground">
						Create a new access token to allow external tools and CLI clients to
						upload builds.
					</p>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Token Details</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-6">
						<div className="space-y-2">
							<Label htmlFor="name">Token Name</Label>
							<Input
								placeholder="My CLI Token"
								value={name}
								onChange={(e) => setName(e.target.value)}
								disabled={createTokenMutation.isPending}
							/>
							<p className="text-muted-foreground text-sm">
								A descriptive name to help you identify this token later.
							</p>
						</div>

						<div className="space-y-4 rounded-lg border bg-muted/50 p-4">
							<h3 className="font-semibold text-sm">What can this token do?</h3>
							<ul className="space-y-1 text-muted-foreground text-sm">
								<li>• Upload new builds to this app</li>
								<li>• Read app information and build history</li>
								<li>• Access manifest and asset endpoints</li>
							</ul>
							<p className="text-muted-foreground text-xs">
								This token will have the same permissions as your user account
								for this specific app.
							</p>
						</div>

						<div className="flex gap-3 pt-4">
							<Button
								type="submit"
								disabled={createTokenMutation.isPending}
								className="flex-1"
							>
								{createTokenMutation.isPending ? "Creating..." : "Create Token"}
							</Button>
							<Button variant="outline" asChild>
								<Link
									to={"/organizations/$orgId/apps/$appId"}
									params={{ orgId, appId }}
								>
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
