import { NextRequest, NextResponse } from 'next/server';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { documentCenterHttpError } from '@/lib/document-center/http';
import {
  createDocument,
  getDocumentContext,
  listDocuments,
  listDocumentTemplates,
} from '@/lib/document-center/repository';
import {
  createDocumentSchema,
  documentListQuerySchema,
} from '@/lib/document-center/schemas';

export async function GET(request: NextRequest) {
  try {
    const principal = await requireFabrikaPrincipal();
    const searchParams = request.nextUrl.searchParams;
    const filters = documentListQuerySchema.parse({
      query: searchParams.get('query') || undefined,
      status: searchParams.get('status') || undefined,
      category: searchParams.get('category') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
    });
    const [templates, documents, context] = await Promise.all([
      listDocumentTemplates(principal),
      listDocuments(principal, filters),
      getDocumentContext(principal),
    ]);
    return NextResponse.json({
      success: true,
      data: { templates, documents, context },
    });
  } catch (error) {
    return documentCenterHttpError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const principal = await requireFabrikaPrincipal();
    const input = createDocumentSchema.parse(await request.json());
    const document = await createDocument(principal, input);
    return NextResponse.json(
      { success: true, data: { document } },
      { status: 201 }
    );
  } catch (error) {
    return documentCenterHttpError(error);
  }
}
