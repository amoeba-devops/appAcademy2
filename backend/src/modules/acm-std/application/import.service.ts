import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

@Injectable()
export class ImportService {
  /** TPI 형식 빈 템플릿 xlsx 생성 */
  generateTemplate(): Buffer {
    const wb = XLSX.utils.book_new();
    const headers = [
      '이름',
      '수업 시작일',
      '성별',
      '연락처',
      '생년월일',
      '학교',
      '학년',
      '거주지',
      '메일',
      'MAP TEST',
      '담당 강사',
      '커리큘럼',
      '수업교재',
      '수업 스케줄',
      '특이사항',
    ];
    for (const name of [
      'TPI 현재 등록 학생',
      'Trinity Academy 현재 등록 학생',
      'Santa Croce 현재 등록 학생',
    ]) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([headers]),
        name,
      );
    }
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }
}
