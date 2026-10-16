import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** REQ-261016E — 드라이브 화면(AMA 동일) 파일 작업. */
const FILE_ID = /^[\w-]{1,200}$/;

export class DriveRenameDto {
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
}

export class DriveFilesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Matches(FILE_ID, { each: true })
  fileIds!: string[];
}

export class DriveMoveDto extends DriveFilesDto {
  @Matches(FILE_ID) targetId!: string;
}
