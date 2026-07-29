import { NextRequest } from 'next/server';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { documentCenterHttpError } from '@/lib/document-center/http';
import {
  getDocument,
  getRenderedSnapshot,
  writeAudit,
} from '@/lib/document-center/repository';
import { safeDocumentFilename } from '@/lib/document-center/docx';
import { renderDocumentPdf } from '@/lib/document-center/pdf';

type Context = {
  params: Promise<{ publicId: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { publicId } = await context.params;
    const document = await getDocument(principal, publicId);
    const snapshot = getRenderedSnapshot(document);
    const contextSnapshot = document.contextSnapshot as {
      company?: { name?: string; logo?: string | null };
    };
    const companyName =
      contextSnapshot.company?.name || principal.account.companyName;
    const buffer = await renderDocumentPdf({
      snapshot,
      companyName,
      logo: contextSnapshot.company?.logo || null,
    });
    await writeAudit(principal, document.id, 'DOWNLOADED_PDF', {
      publicId,
      documentNumber: document.documentNumber,
    });
    const filename = safeDocumentFilename(
      `${document.documentNumber}-${document.title}`
    );
    const disposition =
      request.nextUrl.searchParams.get('inline') === '1'
        ? 'inline'
        : 'attachment';
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return documentCenterHttpError(error);
  }
}
