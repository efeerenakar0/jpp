import { NextResponse } from "next/server";
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from "@/lib/fabrika-session";
import { isPlatformStudioAiReady } from "@/lib/platform-ai-readiness";

function authError(error: unknown) {
  if (error instanceof FabrikaSessionError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof FabrikaForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  return null;
}

export async function GET() {
  try {
    await requireFabrikaPrincipal();
    return NextResponse.json({
      managedByPlatform: true,
      ready: isPlatformStudioAiReady(),
      service: "Business CEO AI",
    });
  } catch (error) {
    return (
      authError(error) ||
      NextResponse.json({ error: "Stüdyo durumu alınamadı." }, { status: 500 })
    );
  }
}

export async function PUT(request: Request) {
  void request;
  try {
    await requireFabrikaPrincipal();
    return NextResponse.json(
      {
        error:
          "Yapay zekâ servisleri Business CEO AI tarafından yönetilir; müşteri anahtarı kabul edilmez.",
      },
      { status: 405, headers: { Allow: "GET" } },
    );
  } catch (error) {
    return (
      authError(error) ||
      NextResponse.json({ error: "İstek tamamlanamadı." }, { status: 500 })
    );
  }
}
