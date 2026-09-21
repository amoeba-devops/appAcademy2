import { BadRequestException } from '@nestjs/common';
export function validateEmploymentDates(
  start?: string | null,
  end?: string | null,
) {
  for (const value of [start, end]) {
    if (value == null) continue;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException('INVALID_EMPLOYMENT_DATE');
  }
  if (start && end && end < start)
    throw new BadRequestException('EMPLOYMENT_END_PRECEDES_START');
}
