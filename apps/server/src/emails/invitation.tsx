import {
	Button,
	Heading,
	Hr,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";

interface InvitationEmailProps {
	organizationName: string;
	inviterName: string;
	role: string;
	inviteUrl: string;
}

export default function InvitationEmail({
	organizationName,
	inviterName,
	role,
	inviteUrl,
}: InvitationEmailProps) {
	return (
		<Tailwind>
			<Section className="flex min-h-screen w-full items-center justify-center font-sans">
				<Section className="mx-4 flex w-full max-w-md flex-col rounded-2xl bg-white px-8 py-8 shadow-lg">
					<Heading className="mb-0 text-center font-bold text-2xl text-gray-900">
						You're Invited!
					</Heading>
					<Text className="mt-2 mb-6 text-center text-gray-600">
						Join {organizationName} on Expo Updates Server
					</Text>

					<Hr className="my-4 border-gray-200" />

					<Text className="mb-4 text-gray-700">
						<strong>{inviterName}</strong> has invited you to join{" "}
						<strong>{organizationName}</strong> as a{" "}
						<strong>{role.toLowerCase()}</strong>.
					</Text>

					<Text className="mb-6 text-gray-600 text-sm">
						As a {role.toLowerCase()}, you'll be able to:
						{["admin", "owner"].includes(role.toLowerCase()) ? (
							<>
								<br />• Manage organization settings and members
								<br />• Create and manage applications
								<br />• Upload and activate builds
								<br />• Full access to all features
							</>
						) : (
							<>
								<br />• View organization applications
								<br />• Upload builds to applications
								<br />• View build history and status
							</>
						)}
					</Text>

					<Button
						href={inviteUrl}
						className="mb-4 block rounded-lg bg-blue-600 px-6 py-3 text-center font-semibold text-white"
					>
						Accept Invitation
					</Button>

					<Text className="mb-0 text-center text-gray-500 text-xs">
						If you don't have an account yet, you'll be able to create one when
						accepting this invitation.
					</Text>

					<Text className="mt-4 text-center text-gray-400 text-xs">
						This invitation will expire in 7 days.
					</Text>
				</Section>
			</Section>
		</Tailwind>
	);
}

InvitationEmail.PreviewProps = {
	organizationName: "Acme Corp",
	inviterName: "John Doe",
	role: "member",
	inviteUrl: "https://expo-updates.example.com/invitations/abc123",
} as InvitationEmailProps;
