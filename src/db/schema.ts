import { sql } from "drizzle-orm";
import {
	blob,
	integer,
	real,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import type { EventMeta, StructuredAnnotation } from "~/schemas";

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	username: text().unique().notNull(),
	role: text({ enum: ["admin", "data-annotator"] }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.notNull(),
});

export const communityPortals = sqliteTable("community_portals", {
	id: text("id").primaryKey(),
	name: text().notNull(),
	logo: blob({ mode: "buffer" }),
	slug: text().notNull().unique(),
	description: text().notNull(),
	createdBy: text("created_by")
		.references(() => users.username)
		.notNull(),
	isActive: integer("enabled", { mode: "boolean" }).notNull().default(true),
	createdAt: integer("created_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.notNull(),
});

export const deployments = sqliteTable("deployments", {
	id: text("id").primaryKey(),

	// Macro Geography
	city: text("city").notNull(),
	state: text("state").notNull(),
	countryCode: text("country_code").notNull(),

	// Micro Geography
	latitude: real("latitude").notNull(),
	longitude: real("longitude").notNull(),
	locationName: text("location_name").notNull(), // e.g., "Intersection of 5th and Main"
	directionFacing: text("direction_facing", {
		enum: ["N", "S", "E", "W", "NE", "NW", "SE", "SW"],
	}).notNull(),
	zoneType: text("zone_type", {
		enum: ["intersection", "crosswalk", "mid-block", "school-zone"],
	}).notNull(),

	// Infrastructure
	mountingPoint: text("mounting_point", {
		enum: [
			"mast-arm",
			"streetlight",
			"utility-pole",
			"pedestrian-beacon",
			"mobile-trailer",
		],
	}).notNull(),

	// Hardware Context
	deviceId: text("device_id").notNull(),
});

export const trials = sqliteTable("trials", {
	id: text("id").primaryKey(),
	title: text().notNull(),
	description: text().notNull(),
	createdBy: text("created_by")
		.references(() => users.username)
		.notNull(),
	isActive: integer("enabled", { mode: "boolean" }).notNull().default(true),
	communityPortalId: text("community_portal_id")
		.references(() => communityPortals.id)
		.notNull(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.notNull(),
});

export const events = sqliteTable("events", {
	id: text("id").primaryKey(),
	// reference to external blob storage for raw video data
	externalBlobRef: text().notNull(),
	// timestamp of the event
	timestamp: integer("timestamp", { mode: "timestamp" }).notNull(), // Date
	deploymentId: text("deployment_id")
		.references(() => deployments.id)
		.notNull(),
	metadata: text("metadata", { mode: "json" }).$type<EventMeta>().notNull(),
});

export const structuredAnnotations = sqliteTable("structured_annotations", {
	id: text("id").primaryKey(),
	eventId: text("event_id")
		.references(() => events.id)
		.notNull(),
	isViolation: integer("is_violation", { mode: "boolean" }).notNull(),
	annotation: text("annotation", { mode: "json" })
		.$type<StructuredAnnotation>()
		.notNull(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.notNull(),
	createdBy: text("created_by")
		.references(() => users.username)
		.notNull(),
});