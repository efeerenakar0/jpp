import { NextResponse } from 'next/server';
import {
  createFabrikaSessionToken,
  FABRIKA_SESSION_COOKIE,
  FABRIKA_SESSION_MAX_AGE,
  isFabrikaAuthConfigured,
} from '@/lib/fabrika-auth';
import { authenticateCompanyMember } from '@/lib/company-members';

export async function POST(request: Request) {
  if (!isFabrikaAuthConfigured()) {
    return NextResponse.json(
      { error: 'Fabrika girişi sunucuda henüz yapılandırılmamış.' },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as {
      username?: unknown;
      temporaryCode?: unknown;
    };
    const username = typeof body.username === 'string' ? body.username : '';
    const temporaryCode =
      typeof body.temporaryCode === 'string' ? body.temporaryCode : '';
    const authentication = await authenticateCompanyMember(
      username,
      temporaryCode
    );

    if (!authentication.ok) {
      const messages = {
        invalid: 'Kullanıcı adı veya giriş kodu hatalı.',
        locked:
          'Çok fazla başarısız deneme yapıldı. 15 dakika sonra yeniden deneyin.',
        member_disabled:
          'Çalışan hesabınız patronunuz veya yönetici tarafından kapatılmış.',
        account_disabled:
          'Şirket hesabınız yönetici tarafından askıya alınmış veya kapatılmış.',
        subscription_inactive:
          'Şirket aboneliği durdurulmuş ya da sona ermiş.',
        workspace_pending:
          'Şirket çalışma alanı henüz etkinleştirilmemiş.',
      } as const;

      return NextResponse.json(
        { error: messages[authentication.reason] },
        {
          status:
            authentication.reason === 'invalid' ||
            authentication.reason === 'locked'
              ? 401
              : 403,
        }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: FABRIKA_SESSION_COOKIE,
      value: createFabrikaSessionToken({
        account: authentication.account,
        principal: {
          type: 'EMPLOYEE',
          id: authentication.member.id,
          name: authentication.member.name,
          sessionVersion: authentication.member.sessionVersion,
        },
      }),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: FABRIKA_SESSION_MAX_AGE,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Giriş isteği işlenemedi.' },
      { status: 400 }
    );
  }
}
