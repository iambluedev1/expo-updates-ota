import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AppSidebar } from "@/components/app-sidebar";
import Loader from "@/components/loader";
import { ModeToggle } from "@/components/mode-toggle";
import { ThemeProvider } from "@/components/theme-provider";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import "../index.css";
import { authClient } from "@/lib/auth-client";

export type RouterAppContext = {};

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	head: () => ({
		meta: [
			{
				title: "expo-updates-server",
			},
			{
				name: "description",
				content: "expo-updates-server is a web application",
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.ico",
			},
		],
	}),
});

function RootComponent() {
	const isFetching = useRouterState({
		select: (s) => s.isLoading,
	});

	const session = authClient.useSession();
	const showSidebar = session.data != null;

	return (
		<>
			<HeadContent />
			<ThemeProvider
				attribute="class"
				defaultTheme="dark"
				disableTransitionOnChange
				storageKey="vite-ui-theme"
			>
				<SidebarProvider>
					{showSidebar && <AppSidebar />}
					<SidebarInset>
						<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
							{showSidebar && <SidebarTrigger className="-ml-1" />}
							<div className="ml-auto flex items-center gap-2">
								<ModeToggle />
							</div>
						</header>
						<div className="flex flex-1 flex-col gap-4 p-4">
							{isFetching ? <Loader /> : <Outlet />}
						</div>
					</SidebarInset>
				</SidebarProvider>
				<Toaster richColors />
			</ThemeProvider>
			<TanStackRouterDevtools position="bottom-right" />
		</>
	);
}
