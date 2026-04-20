import 'i18next';

import type common from '../../public/locales/ko/common.json';
import type validation from '../../public/locales/ko/validation.json';
import type errors from '../../public/locales/ko/errors.json';
import type portal from '../../public/locales/ko/portal.json';
import type admin from '../../public/locales/ko/admin.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      validation: typeof validation;
      errors: typeof errors;
      portal: typeof portal;
      admin: typeof admin;
    };
  }
}
