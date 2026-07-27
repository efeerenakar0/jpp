import { NextResponse } from 'next/server';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import prisma from '@/lib/prisma';

export async function DELETE(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID gerekli.' }, { status: 400 });
    }
    const deleted = await prisma.huntedListing.deleteMany({
      where: { id, companyAccountId: principal.account.id },
    });
    if (deleted.count === 0) {
      return NextResponse.json(
        { error: 'Avcı ilanı bulunamadı.' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json(
        { error: 'Fabrika oturumu gerekli.' },
        { status: 401 }
      );
    }
    console.error('Error deleting listing:', error);
    return NextResponse.json(
      { error: 'Silme işlemi başarısız.' },
      { status: 500 }
    );
  }
}
