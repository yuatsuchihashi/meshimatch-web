import { notFound } from 'next/navigation';
import { isLocalMode } from '@/lib/local-mode';
import { AreaPollFlow } from '@/components/area/AreaPollFlow';

export default async function AreaPollPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string; person?: string }> }) {
  if (!isLocalMode()) notFound();
  const query = await searchParams;
  return <AreaPollFlow id={(await params).id} view={query.view} person={query.person} />;
}
