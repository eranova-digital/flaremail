import { describe, expect, it } from "vitest";

import { parseDohTxtData } from "../src/lib/dns/doh-resolver";
import {
	bimiCandidateDomains,
	bimiTxtName,
	parseBimiTxt,
} from "../src/lib/bimi/lookup";
import {
	computeBimiEligibility,
	isEnforcingPolicy,
} from "../src/lib/bimi/eligibility";

describe("parseBimiTxt", () => {
	it("parses emag.ro BIMI TXT from DNS", () => {
		expect(
			parseBimiTxt(
				"v=BIMI1; l=https://s13emagst.akamaized.net/layout/all/images/logo/logo-square.svg; a=; avp=brand;",
			),
		).toEqual({
			version: "BIMI1",
			location:
				"https://s13emagst.akamaized.net/layout/all/images/logo/logo-square.svg",
			authority: null,
		});
	});

	it("accepts optional authority URL", () => {
		expect(
			parseBimiTxt(
				"v=BIMI1; l=https://example.com/b.svg; a=https://example.com/vmc.pem",
			),
		).toMatchObject({
			location: "https://example.com/b.svg",
			authority: "https://example.com/vmc.pem",
		});
	});

	it("rejects http logo locations", () => {
		expect(parseBimiTxt("v=BIMI1; l=http://example.com/logo.svg")).toBeNull();
	});

	it("rejects missing or wrong version", () => {
		expect(parseBimiTxt("l=https://example.com/logo.svg")).toBeNull();
		expect(parseBimiTxt("v=BIMI2; l=https://example.com/logo.svg")).toBeNull();
	});
});

describe("bimiCandidateDomains", () => {
	it("walks subdomain to organizational domain", () => {
		expect(bimiCandidateDomains("mail.example.com")).toEqual([
			"mail.example.com",
			"example.com",
		]);
	});

	it("returns a single entry for an org domain", () => {
		expect(bimiCandidateDomains("example.com")).toEqual(["example.com"]);
	});

	it("builds the default selector TXT name", () => {
		expect(bimiTxtName("Example.COM")).toBe("default._bimi.example.com");
	});
});

describe("BIMI eligibility", () => {
	it("requires pass + enforcing policy + aligned domain", () => {
		expect(
			computeBimiEligibility({
				dmarcResult: "pass",
				policy: "reject",
				alignedDomain: "example.com",
			}),
		).toBe(true);
		expect(
			computeBimiEligibility({
				dmarcResult: "pass",
				policy: "quarantine",
				alignedDomain: "example.com",
			}),
		).toBe(true);
	});

	it("rejects pass with p=none", () => {
		expect(
			computeBimiEligibility({
				dmarcResult: "pass",
				policy: "none",
				alignedDomain: "example.com",
			}),
		).toBe(false);
		expect(isEnforcingPolicy("none")).toBe(false);
	});

	it("rejects fail even with reject policy", () => {
		expect(
			computeBimiEligibility({
				dmarcResult: "fail",
				policy: "reject",
				alignedDomain: "example.com",
			}),
		).toBe(false);
	});

	it("rejects when aligned domain is missing", () => {
		expect(
			computeBimiEligibility({
				dmarcResult: "pass",
				policy: "reject",
				alignedDomain: null,
			}),
		).toBe(false);
	});
});

describe("DoH TXT chunk parsing", () => {
	it("splits quoted TXT chunks like Cloudflare DoH", () => {
		expect(parseDohTxtData('"v=BIMI1; " "l=https://example.com/a.svg"')).toEqual([
			"v=BIMI1; ",
			"l=https://example.com/a.svg",
		]);
	});

	it("handles a single quoted string", () => {
		expect(parseDohTxtData('"v=BIMI1; l=https://example.com/a.svg"')).toEqual([
			"v=BIMI1; l=https://example.com/a.svg",
		]);
	});
});

describe("trusted Authentication-Results", () => {
	it("parses emag.ro Cloudflare DMARC pass", async () => {
		const { parseTrustedDmarcFromAuthResults } = await import(
			"../src/lib/mail-auth/parse-authentication-results"
		);
		const header =
			"mx.cloudflare.net; dkim=pass header.d=emag.ro header.s=s1 header.b=Hc1thAY6; dmarc=pass header.from=emag.ro policy.dmarc=reject; spf=pass smtp.mailfrom=bounces+6270107-fd64-patrick=eranova.ro@e2.emag.ro; arc=none smtp.remote-ip=149.72.32.26";
		const parsed = parseTrustedDmarcFromAuthResults(header);
		expect(parsed).toEqual({
			dmarcResult: "pass",
			alignedDomain: "emag.ro",
			policy: "reject",
			eligibleForBimi: true,
		});
	});
});
