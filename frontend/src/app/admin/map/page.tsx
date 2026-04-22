'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  BookCopy,
  FileQuestion,
  PenSquare,
  Plus,
  SendToBack,
  TestTube2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMapHubStats } from '@/hooks/use-map';

function KpiSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="border-[#C9A656]/10">
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-20" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function MapHubPage() {
  const { t } = useTranslation('admin');
  const { data: stats, isLoading } = useMapHubStats();

  const gradeHint = stats?.passagesByGrade
    ?.map((g) => `${g.label} ${g.count}`)
    .join(' · ') ?? '';

  const cards = [
    {
      title: t('map.hub.card-passage-title'),
      subtitle: t('map.hub.card-passage-subtitle'),
      description: t('map.hub.card-passage-desc'),
      href: '/admin/map/passages',
      icon: BookCopy,
    },
    {
      title: t('map.hub.card-item-title'),
      subtitle: t('map.hub.card-item-subtitle'),
      description: t('map.hub.card-item-desc'),
      href: '/admin/map/items',
      icon: FileQuestion,
    },
    {
      title: t('map.hub.card-testset-title'),
      subtitle: t('map.hub.card-testset-subtitle'),
      description: t('map.hub.card-testset-desc'),
      href: '/admin/map/testsets',
      icon: PenSquare,
    },
    {
      title: t('map.hub.card-assign-title'),
      subtitle: t('map.hub.card-assign-subtitle'),
      description: t('map.hub.card-assign-desc'),
      href: '/admin/map/assignments',
      icon: SendToBack,
    },
    {
      title: t('map.hub.card-grading-title'),
      subtitle: t('map.hub.card-grading-subtitle'),
      description: t('map.hub.card-grading-desc'),
      href: '/admin/map/grading',
      icon: TestTube2,
    },
    {
      title: t('map.hub.card-analytics-title'),
      subtitle: t('map.hub.card-analytics-subtitle'),
      description: t('map.hub.card-analytics-desc'),
      href: '#',
      icon: BarChart3,
    },
  ];

  return (
    <div className="space-y-8">
      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0E1E3A] px-8 py-10 text-white">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-[#C9A656]/10 to-transparent" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C9A656]">
          {t('map.hub.hero-eyebrow')}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold">
          {t('map.hub.hero-title')}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">
          {t('map.hub.hero-lead')}
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/admin/map/passages"
            className={buttonVariants({ className: "bg-[#C9A656] text-[#0E1E3A] hover:bg-[#C9A656]/90 font-semibold" })}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {t('map.hub.add-passage')}
          </Link>
          <Link
            href="/admin/map/testsets"
            className={buttonVariants({ variant: "outline", className: "border-[#C9A656]/50 text-[#C9A656] hover:bg-[#C9A656]/10" })}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {t('map.hub.add-testset')}
          </Link>
        </div>
      </div>

      {/* ── KPI Row ── */}
      {isLoading ? (
        <KpiSkeleton />
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-[#C9A656]/10">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-widest">
                {t('map.hub.kpi-passages')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-[#0E1E3A]">
                {stats.passages.toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{gradeHint}</p>
            </CardContent>
          </Card>

          <Card className="border-[#C9A656]/10">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-widest">
                {t('map.hub.kpi-items')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-[#0E1E3A]">
                {stats.items.toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('map.hub.kpi-part-breakdown', { partA: stats.partAItems, partB: stats.partBItems })}
              </p>
            </CardContent>
          </Card>

          <Card className="border-[#C9A656]/10">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-widest">
                {t('map.hub.kpi-testsets')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-[#0E1E3A]">
                {stats.testSets.toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('map.hub.kpi-testsets-breakdown', { published: stats.publishedTestSets, draft: stats.draftTestSets })}
              </p>
            </CardContent>
          </Card>

          <Card className="border-[#C9A656]/10">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-widest">
                {t('map.hub.kpi-month-assignments')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-[#0E1E3A]">
                {stats.monthAssignments.toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {stats.monthAverageScore != null
                  ? t('map.hub.kpi-avg-score', { score: stats.monthAverageScore })
                  : t('map.hub.kpi-avg-empty')}
                {stats.pendingGrading > 0 && t('map.hub.kpi-pending', { count: stats.pendingGrading })}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ── Navigation Cards (6-grid) ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const clickable = card.href !== '#';
          const content = (
            <Card
              className={`h-full border-[#C9A656]/20 transition-all hover:shadow-md hover:ring-1 hover:ring-[#C9A656]/30 ${
                !clickable ? 'opacity-60' : ''
              }`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-[#0E1E3A]">{card.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C9A656]/10">
                    <Icon className="h-5 w-5 text-[#C9A656]" />
                  </div>
                </div>
                <CardDescription className="mt-1">{card.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-xs font-medium text-[#C9A656]">
                {clickable ? t('map.hub.card-action-go') : t('map.hub.card-action-coming')}
              </CardContent>
            </Card>
          );

          return clickable ? (
            <Link key={card.title} href={card.href}>
              {content}
            </Link>
          ) : (
            <div key={card.title}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
