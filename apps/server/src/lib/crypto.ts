import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

export function encrypt(text: string): string {
	const secret = process.env.APP_PK_SECRET;
	if (!secret) {
		throw new Error("APP_PK_SECRET environment variable is not set");
	}

	const key = crypto.scryptSync(secret, "salt", 32);
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

	let encrypted = cipher.update(text, "utf8", "hex");
	encrypted += cipher.final("hex");

	const authTag = cipher.getAuthTag();

	return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
	const secret = process.env.APP_PK_SECRET;
	if (!secret) {
		throw new Error("APP_PK_SECRET environment variable is not set");
	}

	const parts = encryptedText.split(":");
	if (parts.length !== 3) {
		throw new Error("Invalid encrypted text format");
	}

	const [ivHex, authTagHex, encrypted] = parts;
	const key = crypto.scryptSync(secret, "salt", 32);
	const iv = Buffer.from(ivHex, "hex");
	const authTag = Buffer.from(authTagHex, "hex");

	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);

	let decrypted = decipher.update(encrypted, "hex", "utf8");
	decrypted += decipher.final("utf8");

	return decrypted;
}
