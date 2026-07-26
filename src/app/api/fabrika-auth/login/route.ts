import { NextResponse } from 'next/server';
import {
  createFabrikaSessionToken,
  FABRIKA_SESSION_COOKIE,
  FABRIKA_SESSION_MAX_AGE,
  isFabrikaAuthConfigured,
} from '@/lib/fabrika-auth';
import { authenticateCompanyAccount } from '@/lib/company-accounts';

export async function POST(request: Request) {
  if (!isFabrikaAuthConfigured()) {
    return NextResponse.json(
      { error: 'Fabrika girişi sunucuda henüz yapılandırılmamış.' },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as {
      accessKey?: unknown;
      verificationCode?: unknown;
    };
    const accessKey = typeof body.accessKey === 'string' ? body.accessKey : '';
    const verificationCode =
      typeof body.verificationCode === 'string' ? body.verificationCode : '';

    const authentication = await authenticateCompanyAccount(
      accessKey,
      verificationCode
    );

    if (!authentication.ok) {
      const messages = {
        invalid: 'Giriş anahtarı veya doğrulama kodu hatalı.',
        account_disabled:
          'Şirket hesabınız yönetici tarafından askıya alınmış veya kapatılmış.',
        subscription_inactive:
          'Aboneliğiniz durdurulmuş ya da sona ermiş. Yöneticinizle iletişime geçin.',
        workspace_pending:
          'Şirket çalışma alanınız hazırlanıyor. Etkinleştirildiğinde giriş yapabilirsiniz.',
      } as const;
      return NextResponse.json(
        { error: messages[authentication.reason] },
        { status: authentication.reason === 'invalid' ? 401 : 403 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: FABRIKA_SESSION_COOKIE,
      value: createFabrikaSessionToken(authentication.account),
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
