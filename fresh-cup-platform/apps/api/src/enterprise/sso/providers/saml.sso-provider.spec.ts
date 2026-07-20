import { inflateRawSync } from "node:zlib";
import type { SsoConnection } from "@prisma/client";
import { SsoSamlProvider } from "./saml.sso-provider";

const CONNECTION = {
  id: "conn-1",
  config: {
    idpSsoUrl: "https://idp.example.com/sso",
    spEntityId: "https://freshcup.example.com/sp",
    acsUrl: "https://freshcup.example.com/acs",
  },
} as unknown as SsoConnection;

function buildSamlResponse(nameId: string): string {
  const xml =
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">` +
    `<saml:Assertion><saml:Subject><saml:NameID>${nameId}</saml:NameID></saml:Subject>` +
    `<saml:AttributeStatement>` +
    `<saml:Attribute Name="email"><saml:AttributeValue>${nameId}</saml:AttributeValue></saml:Attribute>` +
    `<saml:Attribute Name="name"><saml:AttributeValue>Test User</saml:AttributeValue></saml:Attribute>` +
    `</saml:AttributeStatement></saml:Assertion></samlp:Response>`;
  return Buffer.from(xml, "utf8").toString("base64");
}

describe("SsoSamlProvider", () => {
  it("builds a redirect-binding authorization URL with a deflated AuthnRequest", () => {
    const provider = new SsoSamlProvider();
    const url = provider.getAuthorizationUrl(
      CONNECTION,
      "https://freshcup.example.com/acs",
      "state123",
    );

    expect(url.startsWith("https://idp.example.com/sso?")).toBe(true);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("RelayState")).toBe("state123");

    const samlRequest = parsed.searchParams.get("SAMLRequest")!;
    const inflated = inflateRawSync(Buffer.from(samlRequest, "base64")).toString("utf8");
    expect(inflated).toContain("AuthnRequest");
    expect(inflated).toContain(CONNECTION.config!["spEntityId" as never]);
  });

  it("parses NameID and attributes from a Response, marking it unverified", () => {
    const provider = new SsoSamlProvider();
    const response = buildSamlResponse("user@example.com");
    const identity = provider.parseResponse(response);

    expect(identity).toEqual({
      externalId: "user@example.com",
      email: "user@example.com",
      fullName: "Test User",
      signatureVerified: false,
    });
  });

  it("throws when the Response has no NameID", () => {
    const provider = new SsoSamlProvider();
    const xml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"></samlp:Response>`;
    const response = Buffer.from(xml, "utf8").toString("base64");
    expect(() => provider.parseResponse(response)).toThrow("NameID");
  });
});
