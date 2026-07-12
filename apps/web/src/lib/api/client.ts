import { client } from "./generated/client.gen";
import { getApiUrl } from "../api";

client.setConfig({
	baseUrl: getApiUrl(),
	credentials: "include",
});

export { client };
export * from "./generated";
