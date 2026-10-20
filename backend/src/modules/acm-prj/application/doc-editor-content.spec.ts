import { BadRequestException } from '@nestjs/common';
import { validateContent } from './document-content';
import { assetToken, assetTokenValid, assetUrl } from './doc-asset.service';

/** PLN-261020C — 편집기 새 기능(이미지·체크리스트·글자색·형광펜·첨부 링크) 저장 검증. */
const doc = (...content: unknown[]) => ({ type: 'doc', content });
const p = (...content: unknown[]) => ({ type: 'paragraph', content });
const text = (t: string, marks?: unknown[]) => ({
  type: 'text',
  text: t,
  ...(marks ? { marks } : {}),
});
const ID = '3f0c2c4e-1b2a-4c3d-9e8f-0a1b2c3d4e5f';

describe('document content — editor toolbar', () => {
  it('accepts color, highlight, underline and a checklist', () => {
    expect(() =>
      validateContent(
        doc(
          p(
            text('a', [{ type: 'textStyle', attrs: { color: '#dc2626' } }]),
            text('b', [
              { type: 'highlight', attrs: { color: 'rgb(254, 240, 138)' } },
            ]),
            text('c', [{ type: 'underline' }]),
          ),
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: true },
                content: [p(text('done'))],
              },
            ],
          },
        ),
        'MEMO',
      ),
    ).not.toThrow();
  });

  it('accepts an ACM asset image and attachment link in a DOC', () => {
    const url = assetUrl(ID);
    expect(() =>
      validateContent(
        doc(
          {
            type: 'image',
            attrs: {
              src: url,
              alt: 'x.png',
              title: null,
              width: null,
              height: null,
            },
          },
          p(
            text('file.pdf', [
              {
                type: 'link',
                attrs: { href: url, target: '_blank', rel: null, class: null },
              },
            ]),
          ),
        ),
        'DOC',
      ),
    ).not.toThrow();
  });

  it.each([
    [
      'script color',
      doc(
        p(
          text('a', [
            { type: 'textStyle', attrs: { color: 'red;background:url(x)' } },
          ]),
        ),
      ),
    ],
    [
      'javascript image',
      doc({ type: 'image', attrs: { src: 'javascript:alert(1)' } }),
    ],
    [
      'data image',
      doc({ type: 'image', attrs: { src: 'data:image/png;base64,AAAA' } }),
    ],
    [
      'http image',
      doc({ type: 'image', attrs: { src: 'http://example.com/a.png' } }),
    ],
    [
      'non-boolean checked',
      doc({
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: 'yes' },
            content: [p(text('a'))],
          },
        ],
      }),
    ],
  ])('rejects %s', (_name, value) => {
    expect(() => validateContent(value, 'DOC')).toThrow(BadRequestException);
  });

  it('does not allow images in a MEMO', () => {
    expect(() =>
      validateContent(
        doc({ type: 'image', attrs: { src: assetUrl(ID) } }),
        'MEMO',
      ),
    ).toThrow(BadRequestException);
  });

  it('signs asset links per id', () => {
    expect(assetTokenValid(ID, assetToken(ID))).toBe(true);
    expect(assetTokenValid(ID, 'x'.repeat(43))).toBe(false);
    expect(
      assetTokenValid('00000000-0000-4000-8000-000000000000', assetToken(ID)),
    ).toBe(false);
  });
});
