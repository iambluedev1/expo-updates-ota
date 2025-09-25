import { Link } from "@tanstack/react-router";

export function NotFound() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center">
			<h1 className="mb-4 font-bold text-4xl">404</h1>
			<p className="mb-4 text-lg">Page non trouvée</p>
			<Link to="/" className="text-blue-500 hover:underline">
				Retour à l'accueil
			</Link>
		</div>
	);
}
