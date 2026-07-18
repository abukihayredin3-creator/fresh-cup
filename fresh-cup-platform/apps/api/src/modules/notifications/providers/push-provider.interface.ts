export const PUSH_PROVIDER = Symbol("PUSH_PROVIDER");

/** Dependency-inverted so Firebase Cloud Messaging (per docs/ARCHITECTURE.md) can be dropped in later. */
export interface PushProvider {
  send(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void>;
}
