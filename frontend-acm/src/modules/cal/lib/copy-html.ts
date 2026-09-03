/**
 * REQ-260902 — 피드백 내용 복사 (메신저 전달용).
 * text/html + text/plain 동시 복사, 미지원 브라우저는 평문 fallback.
 */
export function htmlToPlainText(html: string): string {
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.innerText || el.textContent || '').trim();
}

export async function copyHtmlToClipboard(html: string): Promise<void> {
  const text = htmlToPlainText(html);
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
      return;
    } catch {
      // fall through to plain text
    }
  }
  await navigator.clipboard.writeText(text);
}
