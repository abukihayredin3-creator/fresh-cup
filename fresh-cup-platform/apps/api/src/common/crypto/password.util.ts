import * as argon2 from "argon2";

/** Staff/admin password hashing — see docs/ARCHITECTURE.md security section. */
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
