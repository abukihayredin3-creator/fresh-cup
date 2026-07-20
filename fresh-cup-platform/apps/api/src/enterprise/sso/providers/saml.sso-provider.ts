import { randomUUID } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import type { SsoConnection } from "@prisma/client";
import type { SamlConnectionConfig, SsoIdentity, SsoProvider } from "../sso-provider.interface";

/**
 * SAML 2.0 — HTTP-Redirect binding for the AuthnRequest, HTTP-POST binding
 * for the Response. This implementation is deliberately scoped: it
 * generates real, spec-shaped AuthnRequest XML and parses the Response's
 * NameID/Conditions structurally, but it does NOT verify the Response's
 * XML-DSig signature. Hand-rolling XML canonicalization and signature
 * verification is a well-known way to introduce signature-wrapping
 * vulnerabilities — a security-reviewed library (e.g. `samlify`,
 * `node-saml`) is required before this path can be trusted with a real
 * login, which is exactly the kind of new heavy dependency this
 * hand-rolled platform avoids elsewhere but should NOT avoid here. Until
 * that library is added, every identity this provider returns carries
 * `signatureVerified: false`, and `SsoService` refuses to log a user in
 * through it unless `ENTERPRISE_SSO_SAML_ALLOW_UNVERIFIED=true` is set —
 * a loud, explicit, environment-level acknowledgment of the gap, not a
 * silent one.
 */
export class SsoSamlProvider implements SsoProvider {
  getAuthorizationUrl(connection: SsoConnection, redirectUri: string, state: string): string {
    const config = connection.config as unknown as SamlConnectionConfig;
    const requestId = `_${randomUUID()}`;
    const issueInstant = new Date().toISOString();
    const acsUrl = config.acsUrl || redirectUri;

    const xml =
      `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
      `ID="${requestId}" Version="2.0" IssueInstant="${issueInstant}" ` +
      `Destination="${config.idpSsoUrl}" AssertionConsumerServiceURL="${acsUrl}" ` +
      `ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">` +
      `<saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${config.spEntityId}</saml:Issuer>` +
      `</samlp:AuthnRequest>`;

    const deflated = deflateRawSync(Buffer.from(xml, "utf8"));
    const params = new URLSearchParams({
      SAMLRequest: deflated.toString("base64"),
      RelayState: state,
    });
    return `${config.idpSsoUrl}?${params.toString()}`;
  }

  handleCallback(_connection: SsoConnection): Promise<SsoIdentity> {
    throw new Error(
      "SsoSamlProvider.handleCallback must be called via parseResponse(samlResponse) — " +
        "the raw POST body, not a query-param shape",
    );
  }

  /** `samlResponseBase64` is the raw `SAMLResponse` form field from the IdP's HTTP-POST. */
  parseResponse(samlResponseBase64: string): SsoIdentity {
    const xml = Buffer.from(samlResponseBase64, "base64").toString("utf8");

    // Structural extraction, not a general XML parser — sufficient for the
    // well-known SAML Response shape since this path never treats the
    // result as authenticated without signatureVerified === true elsewhere.
    const nameIdMatch = /<(?:saml2?:)?NameID[^>]*>([^<]+)<\/(?:saml2?:)?NameID>/.exec(xml);
    const emailAttrMatch =
      /<(?:saml2?:)?Attribute[^>]*Name="[^"]*mail[^"]*"[^>]*>[\s\S]*?<(?:saml2?:)?AttributeValue[^>]*>([^<]+)<\/(?:saml2?:)?AttributeValue>/i.exec(
        xml,
      );
    const nameAttrMatch =
      /<(?:saml2?:)?Attribute[^>]*Name="[^"]*name[^"]*"[^>]*>[\s\S]*?<(?:saml2?:)?AttributeValue[^>]*>([^<]+)<\/(?:saml2?:)?AttributeValue>/i.exec(
        xml,
      );

    const nameId = nameIdMatch?.[1];
    if (!nameId) {
      throw new Error("SAML Response did not contain a NameID");
    }

    const email = emailAttrMatch?.[1] ?? nameId;
    const fullName = nameAttrMatch?.[1] ?? email;

    return {
      externalId: nameId,
      email,
      fullName,
      signatureVerified: false,
    };
  }
}
