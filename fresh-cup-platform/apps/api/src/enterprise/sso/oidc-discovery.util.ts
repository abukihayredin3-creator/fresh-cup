export interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
}

/**
 * Fetches `${issuer}/.well-known/openid-configuration` — this one
 * discovery call is how Google Workspace, Microsoft Entra ID, Okta, and
 * any other spec-compliant IdP all resolve to the same shape, so one
 * `SsoOidcProvider` implementation drives all four `SsoProviderType`
 * OIDC variants; only the configured `issuer` differs between them.
 */
export async function discoverOidc(issuer: string): Promise<OidcDiscoveryDocument> {
  const url = `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OIDC discovery failed for issuer '${issuer}': HTTP ${res.status}`);
  }
  return (await res.json()) as OidcDiscoveryDocument;
}
