import { notFound } from 'next/navigation';
import { isLocalMode } from '@/lib/local-mode';
import { ScheduleDetail } from '@/components/schedule/ScheduleFlow';

export default async function SchedulePollPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string; person?: string }> }) {
  if (!isLocalMode()) notFound();
  const query = await searchParams;
  const { id } = await params;
  return <ScheduleDetail key={id + (query.view ?? '')} id={id} view={query.view} />;
}
