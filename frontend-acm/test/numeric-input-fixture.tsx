import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Input } from '../src/components/ui/input';
import '../src/i18n';
import '../src/styles/globals.css';
function Fixture() {
  const { control, handleSubmit, reset, setFocus } = useForm({
    defaultValues: { amount: '', quantity: 0 },
  });
  const [decimal, setDecimal] = useState('');
  const [sent, setSent] = useState('');
  return (
    <main className="mx-auto max-w-xl space-y-4 p-8">
      <h1>금액·수량 입력 검증</h1>
      <form
        onSubmit={handleSubmit((data) => setSent(JSON.stringify(data)))}
        className="space-y-3"
      >
        <label>
          결제금액
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <Input
                {...field}
                aria-label="amount"
                type="number"
                min={0}
                max={50000000}
                required
              />
            )}
          />
        </label>
        <label>
          수량
          <Controller
            control={control}
            name="quantity"
            render={({ field }) => (
              <Input
                {...field}
                aria-label="quantity"
                type="number"
                min={0}
                step={1}
                value={Number.isNaN(field.value) ? '' : field.value}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === '' ? NaN : Number(e.target.value),
                  )
                }
              />
            )}
          />
        </label>
        <label>
          소수·음수
          <Input
            type="number"
            aria-label="decimal"
            step={0.01}
            value={decimal}
            onChange={(e) => setDecimal(e.target.value)}
          />
        </label>
        <button>저장</button>
        <button
          type="button"
          onClick={() => reset({ amount: '7654321', quantity: 1234 })}
        >
          초기화
        </button>
        <button type="button" onClick={() => setFocus('amount')}>
          포커스
        </button>
      </form>
      <output>{sent}</output>
      <div data-raw-decimal>{decimal}</div>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
