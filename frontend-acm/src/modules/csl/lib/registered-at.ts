import { todayYmd } from "@/lib/tz";

/**
 * 신규상담 "등록일" 표시 — 날짜 + 등록 시:분.
 *
 * `registeredAt` 은 DATE 컬럼(`inq_registered_at`, YYYY-MM-DD)이라 시각 정보가
 * 없다. 실제 접수 시각은 행 생성 시각(`createdAt`, TIMESTAMPTZ)이므로 둘을
 * 합쳐 보여준다. 운영자가 등록일을 소급 입력하면 두 날짜가 어긋날 수 있는데,
 * 그때 접수 시각의 시:분만 붙이면 사실과 다른 값이 되므로 접수 일시를 따로
 * 표기한다.
 */
export interface RegisteredAtDisplay {
  /** 등록일 (로케일 날짜). */
  date: string;
  /** 등록(접수) 시:분 — 등록일과 접수일이 같은 날일 때만 채워진다. */
  time: string | null;
  /** 소급 입력이라 날짜가 어긋날 때의 접수 일시 (월/일 시:분). */
  receivedAt: string | null;
  /** 툴팁용 전체 접수 일시. */
  title: string | null;
}

/** 'YYYY-MM-DD' 는 로컬 필드로 파싱한다 — new Date('2026-09-12') 는 UTC 자정이라 TZ 에 따라 하루 밀린다. */
function parseYmd(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatRegisteredAt(
  registeredAt: string | null | undefined,
  createdAt: string | null | undefined,
  locale: string,
  tz?: string,
): RegisteredAtDisplay | null {
  if (!registeredAt) return null;
  const regDate = parseYmd(registeredAt);
  if (!regDate) return null;

  const display: RegisteredAtDisplay = {
    date: regDate.toLocaleDateString(locale),
    time: null,
    receivedAt: null,
    title: null,
  };

  if (!createdAt) return display;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return display;

  const hhmm = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: tz,
  }).format(created);

  display.title = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: tz,
  }).format(created);

  const regYmd = `${regDate.getFullYear()}-${String(regDate.getMonth() + 1).padStart(2, "0")}-${String(
    regDate.getDate(),
  ).padStart(2, "0")}`;
  const createdYmd = todayYmd(tz ?? "Asia/Seoul", created);

  if (regYmd === createdYmd) {
    display.time = hhmm;
  } else {
    // 로케일 날짜 포맷은 뒤에 구두점이 붙어("09. 12.") 표 안에서 지저분하다.
    // MM/DD 로 고정해 시각과 붙여 쓴다.
    const parts = new Intl.DateTimeFormat("en-CA", {
      month: "2-digit",
      day: "2-digit",
      timeZone: tz,
    }).formatToParts(created);
    const pick = (type: string) =>
      parts.find((x) => x.type === type)?.value ?? "";
    display.receivedAt = `${pick("month")}/${pick("day")} ${hhmm}`;
  }
  return display;
}
