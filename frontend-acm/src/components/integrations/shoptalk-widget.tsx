import { useEffect } from 'react';

/**
 * 요구 260914C — SharpTalk(ShopTalk) 상담 위젯 로더.
 *
 * 랜딩페이지(`/`)에서만 띄운다. embed.js 는 한 번 실행되면 되돌릴 API(destroy)
 * 가 없고 iframe(`#ivy-talktalk-frame`)을 document 에 직접 붙이므로,
 *
 *   - 스크립트는 **세션당 한 번만** 주입하고
 *   - 다른 화면으로 이동하면 iframe 을 감췄다가 랜딩으로 돌아오면 다시 보인다
 *
 * 이렇게 하지 않으면 SPA 안에서 `/admin/*` 으로 이동해도 상담 위젯이 관리자
 * 콘솔 위에 남는다.
 *
 * 주의: 담당자가 준 스니펫의 `/v1/embed.js` 는 콘솔 SPA 의 index.html(text/html)
 * 을 돌려준다 — 실제 로더는 `/widget/embed.js` 다. 또 `widgetUrl` 을 넘기지
 * 않으면 기본값 `https://widget.ivyusa.app` 을 쓰는데 그 호스트는 응답하지
 * 않는다. 두 값 모두 확인 후 교정했다 (2026-09-14).
 */
const SCRIPT_ID = 'shoptalk-embed';
const FRAME_ID = 'ivy-talktalk-frame';
const EMBED_SRC = 'https://shoptalk.amoeba.site/widget/embed.js';

const SHOP = 'tpi.co.kr';
const WIDGET_URL = 'https://shoptalk.amoeba.site/widget';

type ShopTalkQueue = { q?: unknown[] };

declare global {
  interface Window {
    ShopTalk?: ShopTalkQueue;
  }
}

function setFrameVisible(visible: boolean): void {
  const frame = document.getElementById(FRAME_ID);
  if (frame) frame.style.display = visible ? '' : 'none';
}

export function ShopTalkWidget() {
  useEffect(() => {
    setFrameVisible(true);

    if (!document.getElementById(SCRIPT_ID)) {
      // 로더는 `q` 큐를 지원한다 — 스크립트보다 먼저 init 을 쌓아두면
      // 로드 직후 그대로 실행된다.
      window.ShopTalk = window.ShopTalk ?? { q: [] };
      window.ShopTalk.q = window.ShopTalk.q ?? [];
      window.ShopTalk.q.push(['init', { shop: SHOP, widgetUrl: WIDGET_URL }]);

      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = EMBED_SRC;
      script.defer = true;
      document.body.appendChild(script);
    }

    // 랜딩을 벗어나면 감춘다 (iframe 은 남지만 화면에는 보이지 않는다).
    return () => setFrameVisible(false);
  }, []);

  return null;
}
