import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import type { BodaRoomStatus } from '../../infrastructure/typeorm/boda-room.typeorm-entity';

/**
 * BODA 입장 런처 페이지 (`/web/classroom/:evtId`) 가 백엔드에서 받아오는
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

  @ApiPropertyOptional({ description: '개설 후에만 채워짐 (학생 입장 시 활용)' })
  meetIdx?: string | null;

  @ApiProperty({
    enum: ['PENDING', 'OPEN', 'STARTED', 'PAUSED', 'ENDED', 'CLOSED'],
    description: '현재 룸 상태 — 학생 UI 가 PENDING 이면 대기',
  })
  status!: BodaRoomStatus;

  @ApiProperty({ description: '11=강사 / 12=학생 / 13=운영자', enum: [11, 12, 13] })
  userType!: 11 | 12 | 13;

  @ApiProperty({ description: 'BODA 측에 보낼 사용자 식별자 (= ACM user UUID, 32 hex)' })
  uid!: string;

  @ApiProperty({ description: '표시명' })
  uname!: string;

  @ApiProperty({ description: 'BODA UI 언어 (ko | en)', enum: ['ko', 'en'] })
  lang!: 'ko' | 'en';

  @ApiProperty({ description: 'BodaAppApi.js 절대 URL — 페이지가 <script> 로 로드' })
  appApiUrl!: string;

  @ApiProperty({ description: '이벤트 제목 — UI 안내문 표시용' })
  evtTitle!: string;

  @ApiProperty({ description: '이벤트 시작 (ISO 8601)' })
  evtStartAt!: string;

  @ApiProperty({ description: '이벤트 종료 (ISO 8601)' })
  evtEndAt!: string;
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
}

// -----------------------------------------------------------------------------
// Query DTOs (path params validated by ParseUUIDPipe in the controller; this
// type is here for Swagger consumers + future filter knobs)
// -----------------------------------------------------------------------------

export class LaunchContextQueryDto {
  @ApiProperty({ description: 'cal_event.evt_id' })
  @IsString() @IsUUID()
  evtId!: string;
}
