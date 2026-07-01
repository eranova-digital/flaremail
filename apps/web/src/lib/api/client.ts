import { client } from "./generated/client.gen";
import { getApiBearerToken, getApiUrl } from "../api";

client.setConfig({
	baseUrl: getApiUrl(),
	auth: getApiBearerToken,
});

export { client };
export * from "./generated";
