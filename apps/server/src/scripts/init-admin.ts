import "dotenv/config";
import prisma from "../db";
import { auth } from "../lib/auth";

export async function initAdminUser() {
	const adminPassword = process.env.SERVICE_PASSWORD_ADMIN;

	try {
		const userCount = await prisma.user.count();

		if (userCount === 0 && !adminPassword) {
			console.log(
				"SERVICE_PASSWORD_ADMIN not set, skipping admin user creation",
			);
			return;
		}

		if (userCount > 0) {
			console.log(
				"Users already exist in database, skipping admin user creation",
			);
			return;
		}

		const adminEmail = "admin@gmail.com";
		const adminName = "Admin";

		await auth.api.signUpEmail({
			body: {
				email: adminEmail,
				password: adminPassword!,
				name: adminName,
			},
		});

		console.log(`Admin user created successfully: ${adminEmail}`);
	} catch (error) {
		console.error("Failed to create admin user:", error);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}
