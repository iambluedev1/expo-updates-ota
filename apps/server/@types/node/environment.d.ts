declare global {
	namespace NodeJS {
		interface ProcessEnv {
			NODE_ENV: "development" | "production";
			DATABASE_URL: string;

			SMTP_HOST: string;
			SMTP_PORT: number;
			SMTP_USER: string;
			SMTP_PASS: string;
			SMTP_FROM: string;
			SMTP_SECURE?: string;

			ADMIN_WEB_URL: string;
			SERVER_URL: string;
			DISABLE_REGISTER?: string;

			APP_PK_SECRET: string;
			BETTER_AUTH_SECRET: string;

			SERVICE_PASSWORD_ADMIN?: string;

			S3_ENDPOINT?: string;
			S3_BUCKET?: string;
			S3_REGION?: string;
			S3_ACCESS_KEY?: string;
			S3_SECRET_KEY?: string;

			UPLOAD_PROVIDER: "s3" | "local";
		}
	}
}

export {};
