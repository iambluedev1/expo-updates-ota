import { existsSync, unlink } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	DeleteObjectsCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface UploadService {
	upload(file: File, appId: string, buildId: string): Promise<string>;
	delete(filePath: string): Promise<void>;
	getUrl(path: string): Promise<string>;
}

class LocalUploadService implements UploadService {
	private baseDir = process.env.UPLOAD_DIR || "uploads";

	async upload(file: File, appId: string, buildId: string): Promise<string> {
		const baseDir = join(this.baseDir, appId, buildId);
		await this.ensureDir(baseDir);

		const filePath = join(baseDir, file.name);
		const fileDir = join(filePath, "..");
		await this.ensureDir(fileDir);
		await writeFile(filePath, new Uint8Array(await file.arrayBuffer()));

		return filePath;
	}

	async delete(filePath: string): Promise<void> {
		const baseFilePath = join(this.baseDir, filePath);

		if (existsSync(baseFilePath)) {
			unlink(baseFilePath, (err) => {
				console.error("Unable to delete file", err);
			});
		}
	}

	getUrl(): Promise<string> {
		throw new Error("Not Implemented Exception");
	}

	private async ensureDir(dir: string): Promise<void> {
		if (!existsSync(dir)) {
			await mkdir(dir, { recursive: true });
		}
	}
}

class S3UploadService implements UploadService {
	private client: S3Client;
	private bucket = process.env.S3_BUCKET!;

	constructor() {
		this.client = new S3Client({
			endpoint: process.env.S3_ENDPOINT,
			region: process.env.S3_BUCKET,
			credentials: {
				accessKeyId: process.env.S3_ACCESS_KEY!,
				secretAccessKey: process.env.S3_SECRET_KEY!,
			},
		});
	}

	async upload(file: File, appId: string, buildId: string): Promise<string> {
		const key = `${appId}/${buildId}/${file.name}`;

		await this.client.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				Body: new Uint8Array(await file.arrayBuffer()),
				ContentType: file.type || "application/octet-stream",
			}),
		);

		return key;
	}

	async delete(filePath: string): Promise<void> {
		const command = new DeleteObjectsCommand({
			Bucket: this.bucket,
			Delete: {
				Objects: [{ Key: filePath }],
				Quiet: false,
			},
		});

		try {
			const response = await this.client.send(command);
			console.debug("File successfully deleted:", response.Deleted);
		} catch (error) {
			console.error("unable to delete file:", error);
		}
	}

	async getUrl(path: string): Promise<string> {
		const command = new GetObjectCommand({
			Bucket: this.bucket,
			Key: path,
		});

		const signedUrl = await getSignedUrl(this.client, command, {
			expiresIn: 3600,
		});
		console.log("URL pré-signée:", signedUrl);

		return signedUrl;
	}
}

export const uploadService: UploadService =
	process.env.UPLOAD_PROVIDER === "s3"
		? new S3UploadService()
		: new LocalUploadService();
