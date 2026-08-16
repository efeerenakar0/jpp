import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { huntingApiError } from '@/lib/hunting-v2/api';

export const runtime = 'nodejs';

/**
 * ClearPath runs are immutable/billable attempts. Retrying a failed run by
 * flipping its status would bypass quota reservation and job-scoped dispatch.
 * The client must start a new guarded job instead.
 */
export async function POST(
  request: Request,
  context: RouteContext<'/api/fabrika/hunting/jobs/[id]/resume'>
) {
  try {
    void request;
    void context;
    const principal = await requireFabrikaPrincipal();
    if (principal.type !== 'OWNER') {
      throw new Error('Avcı taramasını yalnız patron yeniden başlatabilir.');
    }
    return Response.json(
      {
        error:
          'ClearPath taraması devam ettirilemez. Aynı filtrelerle yeni ve kota kontrollü bir tarama başlatın.',
      },
      { status: 409 }
    );
  } catch (error) {
    return huntingApiError(error);
  }
}
