import { cookies } from 'next/headers';
import {
  PLATFORM_ADMIN_SESSION_COOKIE,
  readPlatformAdminSessionToken,
} from '@/lib/platform-admin-auth';

export async function requirePlatformAdmin() {
  const cookieStore = await cookies();
  return readPlatformAdminSessionToken(
    cookieStore.get(PLATFORM_ADMIN_SESSION_COOKIE)?.value
  );
}
