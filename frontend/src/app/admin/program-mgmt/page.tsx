'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { usePrograms, useCreateProgram } from '@/hooks/use-programs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, BookOpen } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  ACTIVE: 'default',
  PUBLISHED: 'default',
  ARCHIVED: 'outline',
};

export default function ProgramsPage() {
  const { t } = useTranslation('admin');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: programs = [], isLoading } = usePrograms({
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
    search: search || undefined,
  });

  const handleSearch = () => {
    setSearch(searchInput);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0E1E3A]">{t('programs.title')}</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('programs.new')}
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('programs.new')}</DialogTitle>
            </DialogHeader>
            <CreateProgramForm onSuccess={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(!v || v === 'ALL' ? '' : v)}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t('programs.filter.status-placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('programs.filter.all')}</SelectItem>
            <SelectItem value="DRAFT">{t('programs.status.DRAFT')}</SelectItem>
            <SelectItem value="ACTIVE">{t('programs.status.ACTIVE')}</SelectItem>
            <SelectItem value="PUBLISHED">{t('programs.status.PUBLISHED')}</SelectItem>
            <SelectItem value="ARCHIVED">{t('programs.status.ARCHIVED')}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(!v || v === 'ALL' ? '' : v)}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t('programs.filter.category-placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('programs.filter.all')}</SelectItem>
            <SelectItem value="ENGLISH">{t('programs.category.ENGLISH')}</SelectItem>
            <SelectItem value="MATH">{t('programs.category.MATH')}</SelectItem>
            <SelectItem value="SCIENCE">{t('programs.category.SCIENCE')}</SelectItem>
            <SelectItem value="OTHER">{t('programs.category.OTHER')}</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto">
          <Input
            placeholder={t('programs.search-placeholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-[200px]"
          />
          <Button variant="outline" size="icon" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">{t('programs.loading')}</div>
      ) : programs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{t('programs.empty')}</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">{t('programs.table.id')}</TableHead>
                <TableHead>{t('programs.table.name')}</TableHead>
                <TableHead className="w-[80px]">{t('programs.table.category')}</TableHead>
                <TableHead className="w-[80px]">{t('programs.table.level')}</TableHead>
                <TableHead className="w-[80px]">{t('programs.table.duration')}</TableHead>
                <TableHead className="w-[120px]">{t('programs.table.fee')}</TableHead>
                <TableHead className="w-[80px]">{t('programs.table.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map((program) => {
                const variant = STATUS_VARIANT[program.status] ?? ('secondary' as const);
                return (
                  <TableRow key={program.id}>
                    <TableCell className="text-muted-foreground">{program.id}</TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/program-mgmt/${program.id}`}
                        className="font-medium text-[#0E1E3A] hover:text-[#C9A656] hover:underline"
                      >
                        {program.name}
                      </Link>
                    </TableCell>
                    <TableCell>{t(`programs.category.${program.category}`, { defaultValue: program.category })}</TableCell>
                    <TableCell>{program.level ? t(`programs.level.${program.level}`, { defaultValue: program.level }) : '-'}</TableCell>
                    <TableCell>{program.durationWeeks ? t('programs.weeks-suffix', { weeks: program.durationWeeks }) : '-'}</TableCell>
                    <TableCell>
                      {program.setting?.feeAmount
                        ? t('programs.fee-krw', { amount: Number(program.setting.feeAmount).toLocaleString() })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={variant}>{t(`programs.status.${program.status}`, { defaultValue: program.status })}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ──────── Create Program Form ──────── */
function CreateProgramForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation('admin');
  const createProgram = useCreateProgram();
  const [form, setForm] = useState({
    name: '',
    category: 'ENGLISH',
    description: '',
    durationWeeks: '',
    targetAgeMin: '',
    targetAgeMax: '',
    level: '',
    feeAmount: '',
    capacityMax: '',
    sessionCount: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProgram.mutateAsync({
      name: form.name,
      category: form.category,
      description: form.description || undefined,
      durationWeeks: form.durationWeeks ? parseInt(form.durationWeeks) : undefined,
      targetAgeMin: form.targetAgeMin ? parseInt(form.targetAgeMin) : undefined,
      targetAgeMax: form.targetAgeMax ? parseInt(form.targetAgeMax) : undefined,
      level: form.level || undefined,
      setting:
        form.feeAmount || form.capacityMax || form.sessionCount
          ? {
              feeAmount: form.feeAmount || undefined,
              capacityMax: form.capacityMax ? parseInt(form.capacityMax) : undefined,
              sessionCount: form.sessionCount ? parseInt(form.sessionCount) : undefined,
            }
          : undefined,
    });
    onSuccess();
  };

  return (
    <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); handleSubmit(e); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">{t('programs.form.name')}</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })}
            placeholder={t('programs.form.name-placeholder')}
            required
          />
        </div>

        <div>
          <Label htmlFor="category">{t('programs.form.category')}</Label>
          <Select
            value={form.category}
            onValueChange={(v) => v && setForm({ ...form, category: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ENGLISH">{t('programs.category.ENGLISH')}</SelectItem>
              <SelectItem value="MATH">{t('programs.category.MATH')}</SelectItem>
              <SelectItem value="SCIENCE">{t('programs.category.SCIENCE')}</SelectItem>
              <SelectItem value="OTHER">{t('programs.category.OTHER')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="level">{t('programs.form.level')}</Label>
          <Select
            value={form.level}
            onValueChange={(v) => v && setForm({ ...form, level: v === 'NONE' ? '' : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('programs.form.level-placeholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">{t('programs.form.level-none')}</SelectItem>
              <SelectItem value="BEGINNER">{t('programs.level.BEGINNER')}</SelectItem>
              <SelectItem value="INTERMEDIATE">{t('programs.level.INTERMEDIATE')}</SelectItem>
              <SelectItem value="ADVANCED">{t('programs.level.ADVANCED')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="durationWeeks">{t('programs.form.duration-weeks')}</Label>
          <Input
            id="durationWeeks"
            type="number"
            min="1"
            value={form.durationWeeks}
            onChange={(e) => setForm({ ...form, durationWeeks: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="feeAmount">{t('programs.form.fee')}</Label>
          <Input
            id="feeAmount"
            type="number"
            min="0"
            value={form.feeAmount}
            onChange={(e) => setForm({ ...form, feeAmount: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="targetAgeMin">{t('programs.form.age-min')}</Label>
          <Input
            id="targetAgeMin"
            type="number"
            min="1"
            max="99"
            value={form.targetAgeMin}
            onChange={(e) => setForm({ ...form, targetAgeMin: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="targetAgeMax">{t('programs.form.age-max')}</Label>
          <Input
            id="targetAgeMax"
            type="number"
            min="1"
            max="99"
            value={form.targetAgeMax}
            onChange={(e) => setForm({ ...form, targetAgeMax: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="capacityMax">{t('programs.form.capacity')}</Label>
          <Input
            id="capacityMax"
            type="number"
            min="1"
            value={form.capacityMax}
            onChange={(e) => setForm({ ...form, capacityMax: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="sessionCount">{t('programs.form.session-count')}</Label>
          <Input
            id="sessionCount"
            type="number"
            min="1"
            value={form.sessionCount}
            onChange={(e) => setForm({ ...form, sessionCount: e.target.value })}
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="description">{t('programs.form.description')}</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, description: e.target.value })}
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={createProgram.isPending}>
          {createProgram.isPending ? t('programs.form.submitting') : t('programs.form.submit')}
        </Button>
      </div>
    </form>
  );
}
