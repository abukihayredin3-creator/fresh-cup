import { SsoProviderType } from "@prisma/client";
import { SsoOidcProvider } from "./providers/oidc.sso-provider";
import { SsoSamlProvider } from "./providers/saml.sso-provider";
import type { SsoProvider } from "./sso-provider.interface";

export function createSsoProvider(providerType: SsoProviderType): SsoProvider {
  switch (providerType) {
    case SsoProviderType.GOOGLE_WORKSPACE:
    case SsoProviderType.MICROSOFT_ENTRA_ID:
    case SsoProviderType.OKTA:
    case SsoProviderType.GENERIC_OIDC:
      return new SsoOidcProvider();
    case SsoProviderType.SAML:
      return new SsoSamlProvider();
  }
}
