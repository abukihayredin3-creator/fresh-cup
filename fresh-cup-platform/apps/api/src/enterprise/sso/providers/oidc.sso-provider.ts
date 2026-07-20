import type { SsoConnection } from "@prisma/client";
import { discoverOidc } from "../oidc-discovery.util";
import { verifyIdToken } from "../jwt-verify.util";
import type { OidcConnectionConfig, SsoIdentity, SsoProvider } from "../sso-provider.interface";

/**
 * Drives Google Workspace, Microsoft Entra ID, Okta, and generic OIDC —
 * all four `SsoProviderType` OIDC variants speak the same discovery +
 * authorization-code + JWKS-verified id_token protocol, so one class
 * handles all of them; only `connection.config.issuer` differs.
 */
export class SsoOidcProvider implements SsoProvider {
  async getAuthorizationUrl(
    connection: SsoConnection,
    redirectUri: string,
    state: string,
  ): Promise<string> {
    const config = connection.config as unknown as OidcConnectionConfig;
    const discovery = await discoverOidc(config.issuer);
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: config.scope ?? "openid email profile",
      state,
    });
    return `${discovery.authorization_endpoint}?${params.toString()}`;
  }

  async handleCallback(
    connection: SsoConnection,
    params: Record<string, string>,
    redirectUri: string,
  ): Promise<SsoIdentity> {
    const code = params.code;
    if (!code) {
      throw new Error("Missing 'code' parameter in OIDC callback");
    }

    const config = connection.config as unknown as OidcConnectionConfig;
    const discovery = await discoverOidc(config.issuer);
    const clientSecret = connection.clientSecretEnvVar
      ? process.env[connection.clientSecretEnvVar]
      : undefined;

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    });

    const tokenRes = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!tokenRes.ok) {
      throw new Error(`OIDC token exchange failed: HTTP ${tokenRes.status}`);
    }
    const tokens = (await tokenRes.json()) as { id_token?: string };
    if (!tokens.id_token) {
      throw new Error("OIDC token response did not include an id_token");
    }

    const payload = await verifyIdToken(
      tokens.id_token,
      discovery.jwks_uri,
      discovery.issuer,
      config.clientId,
    );

    const email = typeof payload.email === "string" ? payload.email : "";
    const name = typeof payload.name === "string" ? payload.name : email;

    return {
      externalId: payload.sub,
      email,
      fullName: name || email,
      signatureVerified: true,
    };
  }
}
