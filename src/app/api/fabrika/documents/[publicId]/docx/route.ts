import { NextRequest } from 'next/server';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { documentCenterHttpError } from '@/lib/document-center/http';
import {
  getDocument,
  getRenderedSnapshot,
  writeAudit,
} from '@/lib/document-center/repository';
import {
  renderDocumentDocx,
  safeDocumentFilename,
} from '@/lib/document-center/docx';

type Context = {
  params: Promise<{ publicId: string }>;
};

export async function GET(_request: NextRequest, context: Context) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { publicId } = await context.params;
    const document = await getDocument(principal, publicId);
    const snapshot = getRenderedSnapshot(document);
    const contextSnapshot = document.contextSnapshot as {
      company?: { name?: string };
    };
    const buffer = await renderDocumentDocx({
      snapshot,
      companyName:
        contextSnapshot.company?.name || principal.account.companyName,
    });
    await writeAudit(principal, document.id, 'DOWNLOADED_DOCX', {
      publicId,
      documentNumber: document.documentNumber,
    });
    const filename = safeDocumentFilename(
      `${document.documentNumber}-${document.title}`
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}.docx"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return documentCenterHttpError(error);
  }
}
