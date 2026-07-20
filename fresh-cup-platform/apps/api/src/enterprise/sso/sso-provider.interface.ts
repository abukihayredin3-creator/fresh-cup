import type { SsoConnection } from "@prisma/client";

export interface SsoIdentity {
  externalId: string;
  email: string;
  fullName: string;
  /** false for SAML until this platform adds real XML-DSig verification — see saml.sso-provider.ts. */
  signatureVerified: boolean;
}

export interface OidcConnectionConfig {
  issuer: string;
  clientId: string;
  scope?: string;
}

export interface SamlConnectionConfig {
  idpSsoUrl: string;
  spEntityId: string;
  acsUrl: string;
}

export interface SsoProvider {
  getAuthorizationUrl(
    connection: SsoConnection,
    redirectUri: string,
    state: string,
  ): Promise<string> | string;

  handleCallback(
    connection: SsoConnection,
    params: Record<string, string>,
    redirectUri: string,
  ): Promise<SsoIdentity>;
}
