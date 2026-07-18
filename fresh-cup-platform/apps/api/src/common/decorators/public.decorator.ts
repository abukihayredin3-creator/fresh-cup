import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Marks an endpoint as not requiring authentication (opts out of the global JwtAuthGuard). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
