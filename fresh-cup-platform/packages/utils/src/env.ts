/** Reads a required environment variable, throwing early with a clear message if it's missing. */
export function requireEnv(name: string, source: NodeJS.ProcessEnv = process.env): string {
  const value = source[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
