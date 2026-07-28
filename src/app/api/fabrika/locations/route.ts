import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';

const querySchema = z.discriminatedUnion('level', [
  z.object({ level: z.literal('provinces') }),
  z.object({
    level: z.literal('districts'),
    parentId: z.coerce.number().int().positive(),
  }),
  z.object({
    level: z.literal('neighborhoods'),
    parentId: z.coerce.number().int().positive(),
  }),
]);

const locationItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
});

const responseSchema = z.object({
  data: z.array(locationItemSchema),
});

function endpointFor(input: z.infer<typeof querySchema>) {
  const fields = 'fields=id,name';
  if (input.level === 'provinces') {
    return `https://api.turkiyeapi.dev/v2/provinces?${fields}&limit=100`;
  }
  if (input.level === 'districts') {
    return `https://api.turkiyeapi.dev/v2/provinces/${input.parentId}/districts?${fields}&limit=100`;
  }
  return `https://api.turkiyeapi.dev/v2/districts/${input.parentId}/neighborhoods?${fields}&limit=1000`;
}

export async function GET(request: Request) {
  try {
    await requireFabrikaPrincipal();
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      level: url.searchParams.get('level'),
      parentId: url.searchParams.get('parentId') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Konum isteği geçersiz.' },
        { status: 400 }
      );
    }

    const response = await fetch(endpointFor(parsed.data), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error('Konum servisine ulaşılamadı.');
    }

    const payload = responseSchema.safeParse(await response.json());
    if (!payload.success) {
      throw new Error('Konum servisinin yanıtı doğrulanamadı.');
    }

    return NextResponse.json({
      success: true,
      items: payload.data.data.sort((a, b) =>
        a.name.localeCompare(b.name, 'tr-TR')
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Konumlar yüklenemedi.',
      },
      { status: 500 }
    );
  }
}
