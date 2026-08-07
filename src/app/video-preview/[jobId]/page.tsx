import { notFound } from 'next/navigation';
import GeneratedVideoPreviewClient from '@/components/fabrika/GeneratedVideoPreviewClient';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { getAiBrowserVideoJob } from '@/lib/studio-video/ai-browser-jobs';
import { studioVideoActor } from '@/app/api/fabrika/studio/video/jobs/route-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadPreviewJob(params: Promise<{ jobId: string }>) {
  try {
    const [principal, routeParams] = await Promise.all([requireFabrikaPrincipal(), params]);
    return await getAiBrowserVideoJob(studioVideoActor(principal), routeParams.jobId);
  } catch {
    notFound();
  }
}

export default async function VideoPreviewPage({ params }: { params: Promise<{ jobId: string }> }) {
  const job = await loadPreviewJob(params);

  return (
    <main style={{ width: '100vw', height: '100vh', margin: 0, overflow: 'hidden', background: '#020817' }}>
      <GeneratedVideoPreviewClient plan={job.plan} facts={job.facts} />
    </main>
  );
}
