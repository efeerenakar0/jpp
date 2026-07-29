export const FABRIKA_ENTRY_PATH = '/fabrika-giris';

export function resolveRootRedirect(pathname: string): string | null {
  return pathname === '/' ? FABRIKA_ENTRY_PATH : null;
}
