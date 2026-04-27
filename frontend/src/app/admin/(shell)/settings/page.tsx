'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings, Building2, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#0E1E3A]">{t('settings.title')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5" />
              {t('settings.academy-info')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label={t('settings.info-rows.name')} value="—" />
            <InfoRow label={t('settings.info-rows.status')} value="ACTIVE" />
            <Separator />
            <p className="text-xs text-muted-foreground">
              {t('settings.hint-contact')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5" />
              {t('settings.system-info')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label={t('settings.info-rows.version')} value="v1.3.0" />
            <InfoRow label={t('settings.info-rows.env')} value="Development" />
            <Separator />
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {t('settings.integration-note')}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">{t('settings.feature-status')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <FeatureCard label={t('settings.feature.teachers')} status="active" />
              <FeatureCard label={t('settings.feature.students')} status="active" />
              <FeatureCard label={t('settings.feature.consultations')} status="active" />
              <FeatureCard label={t('settings.feature.programs')} status="planned" />
              <FeatureCard label={t('settings.feature.enrollments')} status="planned" />
              <FeatureCard label={t('settings.feature.timetable')} status="planned" />
              <FeatureCard label={t('settings.feature.payments')} status="planned" />
              <FeatureCard label={t('settings.feature.map')} status="planned" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function FeatureCard({ label, status }: { label: string; status: 'active' | 'planned' }) {
  const { t } = useTranslation('admin');
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <span className="text-sm">{label}</span>
      <Badge variant={status === 'active' ? 'default' : 'secondary'}>
        {status === 'active' ? t('settings.feature.active') : t('settings.feature.planned')}
      </Badge>
    </div>
  );
}
