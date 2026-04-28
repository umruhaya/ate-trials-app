import { SmartCoercionPlugin } from "@orpc/json-schema";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, ValidationError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ResponseHeadersPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { formatValidationErrorCauseForLog } from "~/orpc/format-validation-error-log";
import router from "~/orpc/router";

function logOrcError(error: unknown) {
	if (error instanceof ORPCError && error.cause instanceof ValidationError) {
		const phase = error.message.includes("Output validation")
			? "output"
			: "input";
		console.error(
			formatValidationErrorCauseForLog({
				phase,
				label: error.message,
				issues: error.cause.issues,
				data: error.cause.data,
			}),
		);
		return;
	}
	console.error(error);
}

export const rpcHandler = new RPCHandler(router, {
	interceptors: [
		onError((error) => {
			logOrcError(error);
		}),
	],
	plugins: [new ResponseHeadersPlugin()],
});

export const openapiHandler = new OpenAPIHandler(router, {
	interceptors: [
		onError((error) => {
			logOrcError(error);
		}),
	],
	plugins: [
		new ResponseHeadersPlugin(),
		new SmartCoercionPlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
			specGenerateOptions: {
				info: {
					title: "Trials App API",
					version: "1.0.0",
				},
				commonSchemas: {
					UndefinedError: { error: "UndefinedError" },
				},
				security: [{ bearerAuth: [] }],
				components: {
					securitySchemes: {
						bearerAuth: {
							type: "http",
							scheme: "bearer",
						},
					},
				},
			},
			docsConfig: {
				authentication: {
					securitySchemes: {
						bearerAuth: {
							token: "default-token",
						},
					},
				},
			},
		}),
	],
});
