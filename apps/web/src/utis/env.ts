type Env = {
	SERVER_URL: string;
	DISABLE_REGISTER: boolean;
};

export const getEnv: () => Env = () => {
	if (typeof window === "undefined") {
		return {
			SERVER_URL: process.env.VITE_SERVER_URL || "http://localhost:3000",
			DISABLE_REGISTER: process.env.VITE_DISABLE_REGISTER === "true" || false,
		};
	}

	return (
		((window as any).__ENV__ as Env) || {
			SERVER_URL: import.meta.env.VITE_SERVER_URL,
			DISABLE_REGISTER:
				import.meta.env.VITE_DISABLE_REGISTER === "true" || false,
		}
	);
};
