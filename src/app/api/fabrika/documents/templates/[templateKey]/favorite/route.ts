import { NextRequest, NextResponse } from 'next/server';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { documentCenterHttpError } from '@/lib/document-center/http';
import { setTemplateFavorite } from '@/lib/document-center/repository';
import { favoriteDocumentTemplateSchema } from '@/lib/document-center/schemas';

type Context = {
  params: Promise<{ templateKey: string }>;
};

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { templateKey } = await context.params;
    const { favorite } = favoriteDocumentTemplateSchema.parse(
      await request.json()
    );
    await setTemplateFavorite(principal, templateKey, favorite);
    return NextResponse.json({ success: true });
  } catch (error) {
    return documentCenterHttpError(error);
  }
}
