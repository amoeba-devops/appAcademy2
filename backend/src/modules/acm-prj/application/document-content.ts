import { BadRequestException } from '@nestjs/common';
const fail = (): never => {
  throw new BadRequestException('지원하지 않는 문서 내용입니다.');
};
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : fail();
export function googleUrl(value: string, type: string) {
  const path =
    type === 'SHEET' ? 'spreadsheets' : type === 'DOC' ? 'document' : fail();
  const match = value.match(
    new RegExp(
      `^https://docs\\.google\\.com/${path}/d/([a-zA-Z0-9_-]{1,200})(?:/[^\\s]*)?$`,
    ),
  );
  if (!match)
    throw new BadRequestException('올바른 Google 문서 링크를 입력하세요.');
  return `https://docs.google.com/${path}/d/${match[1]}/edit`;
}
export function validateContent(
  value: unknown,
  type: string,
): Record<string, unknown> {
  const root = object(value);
  if (Buffer.byteLength(JSON.stringify(root), 'utf8') > 60000)
    throw new BadRequestException(
      '본문이 너무 큽니다. 내용을 나누어 저장하세요.',
    );
  if (type === 'SHEET') {
    const rows = root.cells;
    if (!Array.isArray(rows) || !rows.length || rows.length > 200) fail();
    let cols = 0;
    for (const row of rows as unknown[]) {
      if (!Array.isArray(row) || !row.length || row.length > 50) fail();
      if (cols && cols !== (row as unknown[]).length) fail();
      cols = (row as unknown[]).length;
      for (const cell of row as unknown[]) {
        const c = object(cell);
        if (typeof c.value !== 'string' || c.value.length > 2000) fail();
        if (c.bold !== undefined && typeof c.bold !== 'boolean') fail();
        if (
          c.format !== undefined &&
          (typeof c.format !== 'string' ||
            !['text', 'number', 'auto'].includes(c.format))
        )
          fail();
        if (
          Object.keys(c).some((k) => !['value', 'bold', 'format'].includes(k))
        )
          fail();
      }
    }
    for (const [key, max, min, len] of [
      ['widths', 500, 60, cols],
      ['heights', 300, 24, (rows as unknown[]).length],
    ] as const) {
      const sizes = root[key];
      if (
        sizes !== undefined &&
        (!Array.isArray(sizes) ||
          sizes.length !== len ||
          sizes.some((x) => !Number.isInteger(x) || x < min || x > max))
      )
        fail();
    }
    if (
      Object.keys(root).some((k) => !['cells', 'widths', 'heights'].includes(k))
    )
      fail();
    return root;
  }
  const nodes = new Set([
    'doc',
    'paragraph',
    'text',
    'heading',
    'bulletList',
    'orderedList',
    'listItem',
    'blockquote',
    'hardBreak',
    'horizontalRule',
    'codeBlock',
    ...(type === 'DOC'
      ? ['table', 'tableRow', 'tableCell', 'tableHeader']
      : []),
  ]);
  let count = 0;
  const walk = (v: unknown, depth: number) => {
    const n = object(v);
    if (++count > 15000 || depth > 30 || !nodes.has(String(n.type))) fail();
    if (
      Object.keys(n).some(
        (k) => !['type', 'text', 'content', 'marks', 'attrs'].includes(k),
      )
    )
      fail();
    if (n.text !== undefined && typeof n.text !== 'string') fail();
    if (n.type === 'text' && (typeof n.text !== 'string' || !n.text)) fail();
    if (n.type !== 'text' && n.text !== undefined) fail();
    const children: Record<string, string[]> = {
      doc: [
        'paragraph',
        'heading',
        'bulletList',
        'orderedList',
        'blockquote',
        'horizontalRule',
        'codeBlock',
        ...(type === 'DOC' ? ['table'] : []),
      ],
      paragraph: ['text', 'hardBreak'],
      heading: ['text', 'hardBreak'],
      codeBlock: ['text'],
      bulletList: ['listItem'],
      orderedList: ['listItem'],
      listItem: ['paragraph', 'bulletList', 'orderedList', 'blockquote'],
      blockquote: [
        'paragraph',
        'heading',
        'bulletList',
        'orderedList',
        'blockquote',
      ],
      table: ['tableRow'],
      tableRow: ['tableCell', 'tableHeader'],
      tableCell: ['paragraph', 'heading', 'bulletList', 'orderedList'],
      tableHeader: ['paragraph', 'heading', 'bulletList', 'orderedList'],
    };
    if (
      Array.isArray(n.content) &&
      n.content.some(
        (child) =>
          !children[String(n.type)]?.includes(String(object(child).type)),
      )
    )
      fail();
    if (n.type === 'heading' && Number(object(n.attrs).level) > 6) fail();
    if (n.attrs) {
      const a = object(n.attrs);
      for (const [k, v] of Object.entries(a)) {
        if (['level', 'start', 'colspan', 'rowspan'].includes(k)) {
          if (
            typeof v !== 'number' ||
            !Number.isInteger(v) ||
            v < 1 ||
            v > 1000
          )
            fail();
        } else if (k === 'colwidth') {
          if (
            v !== null &&
            (!Array.isArray(v) ||
              v.length > 50 ||
              v.some((x) => !Number.isInteger(x) || x < 0 || x > 2000))
          )
            fail();
        } else if (k === 'align') {
          if (
            v !== null &&
            (typeof v !== 'string' || !['left', 'center', 'right'].includes(v))
          )
            fail();
        } else if (k === 'type' && n.type === 'orderedList') {
          if (
            v !== null &&
            (typeof v !== 'string' || !['1', 'a', 'A', 'i', 'I'].includes(v))
          )
            fail();
        } else if (k === 'language') {
          if (v !== null && typeof v !== 'string') fail();
        } else fail();
      }
    }
    if (n.marks !== undefined) {
      if (!Array.isArray(n.marks)) fail();
      for (const mark of n.marks as unknown[]) {
        const m = object(mark);
        if (
          !['bold', 'italic', 'strike', 'underline', 'code', 'link'].includes(
            String(m.type),
          )
        )
          fail();
        if (m.type === 'link') {
          const a = object(m.attrs);
          if (
            typeof a.href !== 'string' ||
            !/^https?:\/\/[^\s]+$/i.test(a.href)
          )
            fail();
          if (
            Object.keys(a).some(
              (k) => !['href', 'target', 'rel', 'class'].includes(k),
            )
          )
            fail();
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          delete a.class;
        } else if (m.attrs && Object.keys(object(m.attrs)).length) fail();
      }
    }
    if (n.content !== undefined) {
      if (!Array.isArray(n.content)) fail();
      for (const child of n.content as unknown[]) walk(child, depth + 1);
    }
  };
  if (root.type !== 'doc') fail();
  walk(root, 0);
  return root;
}
