import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import z from "zod";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import Loader from "./loader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export default function SignInForm({
	invitationToken,
	registerIsEnabled = true,
}: {
	invitationToken?: string;
	registerIsEnabled: boolean;
}) {
	const navigate = useNavigate({
		from: "/",
	});
	const { isPending } = authClient.useSession();

	const { data: invitation } = useQuery({
		queryKey: ["invitation", invitationToken],
		queryFn: async () => {
			if (!invitationToken) return null;
			const response = await api.api
				.invitations({ token: invitationToken })
				.get();
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
		enabled: !!invitationToken,
	});

	const acceptInvitationMutation = useMutation({
		mutationFn: async () => {
			if (!invitationToken) return;
			const response = await authClient.organization.acceptInvitation({
				invitationId: invitationToken,
			});

			if (response.error) {
				throw new Error(
					response.error.message || "Failed to accept invitation",
					{
						cause: response.error,
					},
				);
			}
			return response.data;
		},
	});

	const form = useForm({
		defaultValues: {
			email: invitation?.email || "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{
					email: value.email,
					password: value.password,
				},
				{
					onSuccess: async () => {
						if (invitationToken) {
							try {
								const member = await acceptInvitationMutation.mutateAsync();
								if (member) {
									toast.success(
										`Welcome back! You've joined ${invitation?.organization.name}!`,
									);
									navigate({
										to: `/organizations/${member.member.organizationId}`,
									});
								}
							} catch (_error) {
								toast.warning(
									"Signed in successfully, but failed to join organization. Please try accepting the invitation again.",
								);
								navigate({ to: "/dashboard" });
							}
						} else {
							navigate({ to: "/dashboard" });
							toast.success("Sign in successful");
						}
					},
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
				},
			);
		},
		validators: {
			onSubmit: z.object({
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	useEffect(() => {
		if (invitation?.email) {
			form.setFieldValue("email", invitation.email);
		}
	}, [invitation?.email, form.setFieldValue]);

	if (isPending) {
		return <Loader />;
	}

	return (
		<div className="mx-auto mt-10 w-full max-w-md p-6">
			<h1 className="mb-6 text-center font-bold text-3xl">
				{invitation ? `Join ${invitation.organization.name}` : "Welcome Back"}
			</h1>
			{invitation && (
				<div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
					<p className="text-blue-800 text-sm">
						Sign in to join <strong>{invitation.organization.name}</strong> as a{" "}
						{invitation.role.toLowerCase()}.
					</p>
				</div>
			)}

			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				className="space-y-4"
			>
				<div>
					<form.Field name="email">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Email</Label>
								<Input
									id={field.name}
									name={field.name}
									type="email"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									disabled={!!invitation}
									className={invitation ? "bg-muted" : ""}
								/>
								{invitation && (
									<p className="text-muted-foreground text-xs">
										Email address is pre-filled from your invitation
									</p>
								)}
								{field.state.meta.errors.map((error) => (
									<p key={error?.message} className="text-red-500">
										{error?.message}
									</p>
								))}
							</div>
						)}
					</form.Field>
				</div>

				<div>
					<form.Field name="password">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Password</Label>
								<Input
									id={field.name}
									name={field.name}
									type="password"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								{field.state.meta.errors.map((error) => (
									<p key={error?.message} className="text-red-500">
										{error?.message}
									</p>
								))}
							</div>
						)}
					</form.Field>
				</div>

				<form.Subscribe>
					{(state) => (
						<Button
							type="submit"
							className="w-full"
							disabled={!state.canSubmit || state.isSubmitting}
						>
							{state.isSubmitting ? "Submitting..." : "Sign In"}
						</Button>
					)}
				</form.Subscribe>
			</form>

			{registerIsEnabled && (
				<div className="mt-4 text-center">
					<Link to="/register">
						<Button
							variant="link"
							className="text-indigo-600 hover:text-indigo-800"
						>
							Need an account? Sign Up
						</Button>
					</Link>
				</div>
			)}
		</div>
	);
}
