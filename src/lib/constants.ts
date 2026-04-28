export const ROUTES = {
	HOME: "/",
	LOGIN: "/",
	COMMUNITY_PORTALS: "/community-portals",
	DEFAULT_ADMIN: "/community-portals",
	DEFAULT_DATA_ANNOTATOR: "/community-portals",
	DEFAULT: (role: "admin" | "data-annotator"): "/community-portals" =>
		role === "admin" ? "/community-portals" : "/community-portals",
};

export const PAGINATION = {
	FIRST_PAGE: 1,
	DEFAULT_PAGE_SIZE: 10,
};
