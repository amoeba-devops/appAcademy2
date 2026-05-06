import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateMpq, useMpq, useUpdateMpq } from '../hooks/use-mpq';
import type { CreateMpqInput, MpqGrade } from '../types';

interface MpqFormModalProps {
  open: boolean;
  onClose: () => void;
  editId?: string | null;
}

interface FormValues {
  mpqGrade: MpqGrade;
  mpqExternalNo: string;
  mpgBody: string;
  mpgGlossary: string;
  mpgPairBody: string;
  mpqQuestion: string;
  choices: { value: string }[];
  mpqAnswerIndex: string; // '' | '0' | '1' | '2' | '3'
  mpqExplanation: string;
  mpqDifficulty: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
}

const inputClass =
  'w-full h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';
const textareaClass =
  'w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';
const labelClass = 'block text-xs text-secondary mb-1';

const empty: FormValues = {
  mpqGrade: 'G3',
  mpqExternalNo: '',
  mpgBody: '',
  mpgGlossary: '',
  mpgPairBody: '',
  mpqQuestion: '',
  choices: [{ value: '' }, { value: '' }, { value: '' }, { value: '' }],
  mpqAnswerIndex: '',
  mpqExplanation: '',
  mpqDifficulty: 'INTERMEDIATE',
};

export function MpqFormModal({ open, onClose, editId }: MpqFormModalProps) {
  const { t } = useTranslation('mpq');
  const isEdit = !!editId;
  const { data: detail } = useMpq(editId ?? undefined);

  const { register, handleSubmit, reset, control } = useForm<FormValues>({
    defaultValues: empty,
  });
  const { fields } = useFieldArray({ control, name: 'choices' });

  useEffect(() => {
    if (!open) return;
    if (isEdit && detail) {
      reset({
        mpqGrade: detail.grade,
        mpqExternalNo: String(detail.externalNo),
        mpgBody: detail.passage.body,
        mpgGlossary: detail.passage.glossary ?? '',
        mpgPairBody: detail.pairedPassage?.body ?? '',
        mpqQuestion: detail.question,
        choices: [0, 1, 2, 3].map((i) => ({ value: detail.choices[i] ?? '' })),
        mpqAnswerIndex: detail.answerIndex == null ? '' : String(detail.answerIndex),
        mpqExplanation: detail.explanation ?? '',
        mpqDifficulty: detail.difficulty,
      });
    } else if (!isEdit) {
      reset(empty);
    }
  }, [open, isEdit, detail, reset]);

  const createMut = useCreateMpq();
  const updateMut = useUpdateMpq(editId ?? '');
  const isLoading = createMut.isPending || updateMut.isPending;

  const onSubmit = async (values: FormValues) => {
    const dto: CreateMpqInput = {
      mpqGrade: values.mpqGrade,
      mpgBody: values.mpgBody.trim(),
      mpqQuestion: values.mpqQuestion.trim(),
      mpqChoices: values.choices.map((c) => c.value.trim()),
      mpqDifficulty: values.mpqDifficulty,
    };
    if (values.mpqExternalNo.trim()) dto.mpqExternalNo = Number(values.mpqExternalNo);
    if (values.mpgGlossary.trim()) dto.mpgGlossary = values.mpgGlossary;
    if (values.mpgPairBody.trim()) dto.mpgPairBody = values.mpgPairBody;
    if (values.mpqExplanation.trim()) dto.mpqExplanation = values.mpqExplanation;
    if (values.mpqAnswerIndex !== '') dto.mpqAnswerIndex = Number(values.mpqAnswerIndex);
    else dto.mpqAnswerIndex = null;

    if (isEdit) {
      const updateDto: Record<string, unknown> = { ...dto };
      updateDto.mpgPairBody = values.mpgPairBody.trim() ? values.mpgPairBody : null;
      updateDto.mpgGlossary = values.mpgGlossary.trim() ? values.mpgGlossary : null;
      await updateMut.mutateAsync(updateDto);
    } else {
      await createMut.mutateAsync(dto);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('form.titleEdit') : t('form.titleCreate')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>{t('form.grade')}</label>
              <select className={inputClass} {...register('mpqGrade', { required: true })}>
                <option value="G2">G2</option>
                <option value="G3">G3</option>
                <option value="G4">G4</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('form.externalNo')}</label>
              <input
                type="number"
                min={1}
                className={inputClass}
                placeholder={t('form.externalNoHint')}
                {...register('mpqExternalNo')}
              />
            </div>
            <div>
              <label className={labelClass}>{t('form.difficulty')}</label>
              <select className={inputClass} {...register('mpqDifficulty')}>
                <option value="BASIC">{t('difficulty.BASIC')}</option>
                <option value="INTERMEDIATE">{t('difficulty.INTERMEDIATE')}</option>
                <option value="ADVANCED">{t('difficulty.ADVANCED')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>{t('form.passage1')}</label>
            <textarea
              rows={5}
              className={textareaClass}
              {...register('mpgBody', { required: true })}
            />
          </div>

          <div>
            <label className={labelClass}>{t('form.passage2')}</label>
            <textarea
              rows={3}
              className={textareaClass}
              placeholder={t('form.passage2Hint')}
              {...register('mpgPairBody')}
            />
          </div>

          <div>
            <label className={labelClass}>{t('form.glossary')}</label>
            <textarea
              rows={2}
              className={textareaClass}
              {...register('mpgGlossary')}
            />
          </div>

          <div>
            <label className={labelClass}>{t('form.question')}</label>
            <textarea
              rows={2}
              className={textareaClass}
              {...register('mpqQuestion', { required: true })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {fields.map((f, i) => (
              <div key={f.id}>
                <label className={labelClass}>
                  {t('form.choice', { n: i + 1 })}
                </label>
                <input
                  className={inputClass}
                  {...register(`choices.${i}.value`, { required: true })}
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('form.answer')}</label>
              <select className={inputClass} {...register('mpqAnswerIndex')}>
                <option value="">{t('form.answerNone')}</option>
                <option value="0">1</option>
                <option value="1">2</option>
                <option value="2">3</option>
                <option value="3">4</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>{t('form.explanation')}</label>
            <textarea
              rows={2}
              className={textareaClass}
              {...register('mpqExplanation')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('common:actions.saving') : t('common:actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
