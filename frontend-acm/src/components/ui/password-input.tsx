import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input, type InputProps } from './input';

/**
 * REQ-261017 — 비밀번호 입력 + 보기/숨기기 토글(로그인·비밀번호 변경·마이페이지 공용).
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(
  ({ className, ...props }, ref) => {
    const { t } = useTranslation('auth');
    const [show, setShow] = React.useState(false);
    return (
      <div className="relative">
        <Input ref={ref} type={show ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? t('password.hide') : t('password.show')}
          aria-pressed={show}
          title={show ? t('password.hide') : t('password.show')}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-secondary hover:text-primary"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';
