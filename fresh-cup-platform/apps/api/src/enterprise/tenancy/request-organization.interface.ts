declare module "express" {
  interface Request {
    /** Set by TenantContextGuard — the resolved Organization id for this request. */
    organizationId?: string;
  }
}
