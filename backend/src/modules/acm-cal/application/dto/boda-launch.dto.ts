import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import type { BodaRoomStatus } from '../../infrastructure/typeorm/boda-room.typeorm-entity';

/**
 * BODA 입장 런처 페이지 (`/portal/classroom/:evtId`) 가 백엔드에서 받아오는
 * 모든 정보. 비밀값 (`authKey` · webhook secret) 은 절대 포함하지 않는다
 * (FR-LAUNCH-8 / AC-LAUNCH-7).
 *
 * `bodaOpen()` (강사) 또는 `bodaJoin()` (학생) 의 입력 파라미터로 그대로
 * 변환되도록 vendor 표기 (`UTy`, `UId`, `UNm`) 를 그대로 사용.
 */
export class BodaLaunchContextResponseDto {
  @ApiProperty({ description: 'tac-{evtId hex 32}' })
  meetKey!: string;

  @ApiProperty({ description: 'BODA roomCode (기본값은 vendor 발급)' })
  roomCode!: string;

  @ApiPropertyOptional({
    description: '개설 후에만 채워짐 (학생 입장 시 활용)',
  })
  meetIdx?: string | null;

  @ApiProperty({
    enum: ['PENDING', 'OPEN', 'STARTED', 'PAUSED', 'ENDED', 'CLOSED'],
    description: '현재 룸 상태 — 학생 UI 가 PENDING 이면 대기',
  })
  status!: BodaRoomStatus;

  @ApiProperty({
    description: '11=강사 / 12=학생 / 13=운영자',
    enum: [11, 12, 13],
  })
  userType!: 11 | 12 | 13;

  @ApiProperty({
    description: 'BODA 측에 보낼 사용자 식별자 (= ACM user UUID, 32 hex)',
  })
  uid!: string;

  @ApiProperty({ description: '표시명' })
  uname!: string;

  @ApiProperty({ description: 'BODA UI 언어 (ko | en)', enum: ['ko', 'en'] })
  lang!: 'ko' | 'en';

  @ApiProperty({
    description: 'BodaAppApi.js 절대 URL — 페이지가 <script> 로 로드',
  })
  appApiUrl!: string;

  @ApiProperty({
    description:
      'bodaOpen()/bodaJoin() 의 1번째 위치 인자 — BODA Backend API 베이스 URL (= bodaWebUrl, 끝 슬래시 제거). SPEC_823 v823.002.',
  })
  bodaWeb!: string;

  @ApiPropertyOptional({ description: 'joinUser.CId — 회사 아이디 (SPEC_823)' })
  companyId?: string | null;

  @ApiPropertyOptional({
    description:
      'joinUser.CCd — 회사 인덱스 (숫자 문자열, FE 가 Number 로 변환)',
  })
  companyCode?: string | null;

  @ApiProperty({ description: '이벤트 제목 — UI 안내문 표시용' })
  evtTitle!: string;

  @ApiProperty({ description: '이벤트 시작 (ISO 8601)' })
  evtStartAt!: string;

  @ApiProperty({ description: '이벤트 종료 (ISO 8601)' })
  evtEndAt!: string;

  // PLN-260716 — 일정에 등록된 메모(설명). 강의실/상세 화면 표시용.
  @ApiProperty({ nullable: true, description: '이벤트 설명(메모)' })
  evtDescription!: string | null;

  // REQ-260619 FR-LX-4 — 헤더 컨텍스트 (강사 이름, 즉시 강의 여부, 수강생 명단).
  @ApiProperty({ description: '강사(이벤트 owner) 이름' })
  ownerName!: string;

  @ApiProperty({
    enum: ['MANUAL', 'INSTANT', 'CLS_SESSION'],
    description: 'evt_source — INSTANT 면 헤더에 ⚡ 칩',
  })
  evtSource!: 'MANUAL' | 'INSTANT' | 'CLS_SESSION';

  @ApiProperty({
    description:
      '수강생/참석자 명단. 학생/학부모 본인 화면(`userType=12`)에서는 빈 배열로 마스킹 (NFR-LX-2).',
    type: 'array',
    items: { type: 'object' },
  })
  invitees!: Array<{
    kind: 'STUDENT' | 'TEACHER' | 'PARENT';
    refId: string;
    name: string;
    subLabel: string | null;
    notified: boolean;
  }>;

  @ApiPropertyOptional({
    description:
      'BODA WebRTC iframe 임베드 URL (모드 A) — `BODA_EMBED_ENABLED=true` 시에만 채워짐. 기본 null.',
  })
  embedUrl?: string | null;

  @ApiPropertyOptional({
    description:
      '브라우저 새 탭 입장용 URL (모드 B). `embedUrl` 과 별개로 vendor 의 webrtc URL + 파라미터를 항상 채움 (config 가 비어있으면 null).',
  })
  webBrowserUrl?: string | null;
}

/**
 * 학생 측 폴링 endpoint (`/api/cal/boda/rooms/:evtId/status`) 응답.
 * launch-context 보다 가벼움 — 룸 상태만 흘려보낸다.
 */
export class BodaRoomStatusResponseDto {
  @ApiProperty()
  status!: BodaRoomStatus;

  @ApiPropertyOptional()
  openedAt?: string | null;

  @ApiPropertyOptional()
  startedAt?: string | null;

  @ApiPropertyOptional()
  endedAt?: string | null;

  @ApiPropertyOptional()
  closedAt?: string | null;

  @ApiPropertyOptional({
    description:
      'REQ-260619 FR-LX-3 — vendor SPEC closeType (0/1/2/10/11/15/16/20/22/100). 종료 안내 메시지 분기에 사용.',
  })
  closeType?: string | null;
}

// -----------------------------------------------------------------------------
// Query DTOs (path params validated by ParseUUIDPipe in the controller; this
// type is here for Swagger consumers + future filter knobs)
// -----------------------------------------------------------------------------

export class LaunchContextQueryDto {
  @ApiProperty({ description: 'cal_event.evt_id' })
  @IsString()
  @IsUUID()
  evtId!: string;
}
