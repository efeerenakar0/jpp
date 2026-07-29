import { NextRequest, NextResponse } from 'next/server';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { documentCenterHttpError } from '@/lib/document-center/http';
import {
  getDocument,
  softDeleteDocument,
  updateDocument,
} from '@/lib/document-center/repository';
import { updateDocumentSchema } from '@/lib/document-center/schemas';

type Context = {
  params: Promise<{ publicId: string }>;
};

export async function GET(_request: NextRequest, context: Context) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { publicId } = await context.params;
    const document = await getDocument(principal, publicId, {
      includeDeleted: principal.type === 'OWNER',
      auditView: true,
    });
    return NextResponse.json({ success: true, data: { document } });
  } catch (error) {
    return documentCenterHttpError(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { publicId } = await context.params;
    const input = updateDocumentSchema.parse(await request.json());
    const document = await updateDocument(principal, publicId, input);
    return NextResponse.json({ success: true, data: { document } });
  } catch (error) {
    return documentCenterHttpError(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { publicId } = await context.params;
    await softDeleteDocument(principal, publicId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return documentCenterHttpError(error);
  }
}
