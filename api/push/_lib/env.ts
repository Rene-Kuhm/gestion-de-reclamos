export function getRequiredEnv(name: string): string {
  const value = process.env[name] || process.env[`VITE_${name}`];
  if (!value) {
    throw new Error(`Missing env var: ${name} (checked with and without VITE_ prefix)`);
  }
  return value.trim();
}
