import nodemailer from "nodemailer";
import { renderToStaticMarkup } from "react-dom/server";
import InvitationEmail from "../emails/invitation";

const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST || "smtp.gmail.com",
	port: Number.parseInt(process.env.SMTP_PORT || "587", 10),
	secure: process.env.SMTP_SECURE === "true",
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS,
	},
});

interface SendInvitationEmailProps {
	to: string;
	organizationName: string;
	inviterName: string;
	role: string;
	inviteToken: string;
}

export async function sendInvitationEmail({
	to,
	organizationName,
	inviterName,
	role,
	inviteToken,
}: SendInvitationEmailProps) {
	const inviteUrl = `${process.env.CORS_ORIGIN || "http://localhost:3000"}/invitations/${inviteToken}`;

	const html = renderToStaticMarkup(
		InvitationEmail({
			organizationName,
			inviterName,
			role,
			inviteUrl,
		}),
	);

	const info = await transporter.sendMail({
		from: process.env.SMTP_FROM,
		to,
		subject: `Invitation to join ${organizationName} - Expo Updates Server`,
		html,
	});

	console.log("Invitation email sent:", info.messageId);
	return info;
}
