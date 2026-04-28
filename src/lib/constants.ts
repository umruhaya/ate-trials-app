export const ROUTES = {
	HOME: "/",
	LOGIN: "/",
	DEFAULT_ADMIN: "/trials",
	DEFAULT_DATA_ANNOTATOR: "/events",
	DEFAULT: (role: "admin" | "data-annotator"): "/trials" | "/events" =>
		role === "admin" ? "/trials" : "/events",
};
