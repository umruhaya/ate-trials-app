export const ROUTES = {
	HOME: "/",
	LOGIN: "/",
	DEFAULT_ADMIN: "/trials",
	DEFAULT_DATA_ANNOTATOR: "/events",
	DEFAULT: (role: "admin" | "data-annotator"): "/trials" | "/events" =>
		role === "admin" ? "/trials" : "/events",
};

export const PAGINATION = {
	FIRST_PAGE: 1,
	DEFAULT_PAGE_SIZE: 10,
};
