import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { fetchOwnedMediaBytes } from '@/lib/media-storage';
import prisma from '@/lib/prisma';
import { getWahaContactProfilePicture } from '@/lib/waha-client';

const conversationIdSchema = z.string().trim().min(1).max(191);
const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

function notFound() {
  return NextResponse.json(
    { error: 'WhatsApp profil fotoğrafı bulunamadı.' },
    { status: 404 }
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const parsedId = conversationIdSchema.safeParse((await params).conversationId);
  if (!parsedId.success) return notFound();

  try {
    const principal = await requireFabrikaPrincipal();
    const conversation = await prisma.customerConversation.findFirst({
      where: {
        id: parsedId.data,
        companyAccountId: principal.account.id,
        channel: 'WHATSAPP',
        isActive: true,
      },
      select: { customerPhone: true },
    });
    if (!conversation?.customerPhone) return notFound();

    const config = await prisma.whatsAppConfig.findUnique({
      where: { companyAccountId: principal.account.id },
      select: {
        connectionStatus: true,
        evolutionInstanceName: true,
      },
    });
    if (
      config?.connectionStatus !== 'CONNECTED' ||
      !config.evolutionInstanceName
    ) {
      return notFound();
    }

    const profilePictureUrl = await getWahaContactProfilePicture({
      sessionName: config.evolutionInstanceName,
      contactId: conversation.customerPhone,
    });
    if (!profilePictureUrl) return notFound();

    const image = await fetchOwnedMediaBytes(profilePictureUrl, {
      maxBytes: PROFILE_PHOTO_MAX_BYTES,
    });
    return new NextResponse(new Uint8Array(image.bytes), {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=300, stale-if-error=3600',
        'Content-Type': image.mimeType,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof FabrikaForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    // Profile photos are optional and WhatsApp privacy settings can hide them.
    // Do not log phone numbers or provider URLs; the UI will retain initials.
    return notFound();
  }
}
