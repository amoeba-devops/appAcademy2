'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';

interface NotificationTemplate {
  id: number;
  event: string;
  channel: string;
  title: string;
  body: string;
  variables: string[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const EVENT_KEYS = ['ENROLLMENT_CONFIRMED', 'PAYMENT_DONE', 'MAP_SCORE', 'CLASS_ABSENT', 'CONSULTATION_RECEIVED'] as const;
const CHANNEL_KEYS = ['TALK', 'SMS', 'EMAIL'] as const;

export default function NotificationTemplatesPage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('admin');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    event: 'ENROLLMENT_CONFIRMED',
    channel: 'TALK',
    title: '',
    body: '',
    variables: '',
    isActive: true,
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: async () => {
      const res = await api.get<NotificationTemplate[]>('/notification-templates');
      return res.data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { id?: number; payload: Record<string, unknown> }) => {
      if (data.id) {
        return api.put(`/notification-templates/${data.id}`, data.payload);
      }
      return api.post('/notification-templates', data.payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      setEditingId(null);
      setShowCreate(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete(`/notification-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
    },
  });

  const openEdit = useCallback((tpl: NotificationTemplate) => {
    setEditingId(tpl.id);
    setShowCreate(false);
    setForm({
      event: tpl.event,
      channel: tpl.channel,
      title: tpl.title,
      body: tpl.body,
      variables: tpl.variables?.join(', ') ?? '',
      isActive: tpl.isActive,
    });
  }, []);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setShowCreate(true);
    setForm({
      event: 'ENROLLMENT_CONFIRMED',
      channel: 'TALK',
      title: '',
      body: '',
      variables: '',
      isActive: true,
    });
  }, []);

  const handleSave = useCallback(() => {
    const payload = {
      event: form.event,
      channel: form.channel,
      title: form.title,
      body: form.body,
      variables: form.variables
        ? form.variables.split(',').map((v) => v.trim()).filter(Boolean)
        : [],
      isActive: form.isActive,
    };

    saveMutation.mutate({
      id: editingId ?? undefined,
      payload,
    });
  }, [form, editingId, saveMutation]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('settings.notifications-page.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('settings.notifications-page.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          {t('settings.notifications-page.new-template')}
        </button>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm animate-pulse">{t('settings.notifications-page.loading')}</div>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-3">{t('settings.notifications-page.table.event')}</th>
                <th className="px-4 py-3">{t('settings.notifications-page.table.channel')}</th>
                <th className="px-4 py-3">{t('settings.notifications-page.table.title')}</th>
                <th className="px-4 py-3">{t('settings.notifications-page.table.status')}</th>
                <th className="px-4 py-3 text-right">{t('settings.notifications-page.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {templates.map((tpl) => (
                <tr key={tpl.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      {t(`settings.notifications-page.event.${tpl.event}`, { defaultValue: tpl.event })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {t(`settings.notifications-page.channel.${tpl.channel}`, { defaultValue: tpl.channel })}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{tpl.title}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-1 ${
                        tpl.isActive ? 'bg-emerald-500' : 'bg-gray-300'
                      }`}
                    />
                    <span className="text-xs text-gray-500">
                      {tpl.isActive ? t('settings.notifications-page.active') : t('settings.notifications-page.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => openEdit(tpl)}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                    >
                      {t('settings.notifications-page.edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t('settings.notifications-page.delete-confirm'))) {
                          deleteMutation.mutate(tpl.id);
                        }
                      }}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      {t('settings.notifications-page.delete')}
                    </button>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    {t('settings.notifications-page.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {(editingId !== null || showCreate) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              {editingId ? t('settings.notifications-page.dialog-edit') : t('settings.notifications-page.dialog-create')}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="tpl-event" className="block text-xs text-gray-500 mb-1">{t('settings.notifications-page.form.event')}</label>
                <select
                  id="tpl-event"
                  value={form.event}
                  onChange={(e) => setForm((f) => ({ ...f, event: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                >
                  {EVENT_KEYS.map((k) => (
                    <option key={k} value={k}>{t(`settings.notifications-page.event.${k}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tpl-channel" className="block text-xs text-gray-500 mb-1">{t('settings.notifications-page.form.channel')}</label>
                <select
                  id="tpl-channel"
                  value={form.channel}
                  onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                >
                  {CHANNEL_KEYS.map((k) => (
                    <option key={k} value={k}>{t(`settings.notifications-page.channel.${k}`)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="tpl-title" className="block text-xs text-gray-500 mb-1">{t('settings.notifications-page.form.title-label')}</label>
              <input
                id="tpl-title"
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder={t('settings.notifications-page.form.title-placeholder')}
              />
            </div>

            <div>
              <label htmlFor="tpl-body" className="block text-xs text-gray-500 mb-1">
                {t('settings.notifications-page.form.body-label')} <span className="text-gray-400">{t('settings.notifications-page.form.body-hint', { syntax: '{{var}}' })}</span>
              </label>
              <textarea
                id="tpl-body"
                rows={4}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm font-mono"
                placeholder={t('settings.notifications-page.form.body-placeholder')}
              />
            </div>

            <div>
              <label htmlFor="tpl-vars" className="block text-xs text-gray-500 mb-1">
                {t('settings.notifications-page.form.variables-label')} <span className="text-gray-400">{t('settings.notifications-page.form.variables-hint')}</span>
              </label>
              <input
                id="tpl-vars"
                type="text"
                value={form.variables}
                onChange={(e) => setForm((f) => ({ ...f, variables: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder={t('settings.notifications-page.form.variables-placeholder')}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="rounded"
              />
              {t('settings.notifications-page.form.is-active')}
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setShowCreate(false);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                {t('settings.notifications-page.form.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveMutation.isPending || !form.title || !form.body}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saveMutation.isPending ? t('settings.notifications-page.form.saving') : t('settings.notifications-page.form.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
