import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
interface RecordData {
  id: string;
  updatedAt: string;
  externalId: string;
  fields: Record<string, string | number | boolean | null>;
}
// 원본 행정정보 필드 키(업로드 엑셀 열 이름, 저장 데이터 키) → 표시용 i18n 키.
// 키 자체는 데이터이므로 번역하지 않고, 라벨만 `withdrawn.fields.*` 로 표시한다.
const FIELD_LABEL_KEYS: Record<string, string> = {
  "이름": "name",
  "성별": "gender",
  "출결번호": "attendanceNo",
  "학교": "school",
  "학년": "grade",
  "반": "classGroup",
  "원생연락처": "studentPhone",
  "집전화": "homePhone",
  "닉네임": "nickname",
  "생일": "birthday",
  "우편번호": "postalCode",
  "주소1": "address1",
  "주소2": "address2",
  "문과/이과": "track",
  "형제": "siblings",
  "졸업연도": "graduationYear",
  "원생이메일": "studentEmail",
  "보호자연락처": "guardianPhone",
  "보호자구분": "guardianRelation",
  "보호자이름": "guardianName",
  "보호자출결알림": "guardianAttendanceAlert",
  "기타보호자연락처": "otherGuardianPhone",
  "기타보호자이름": "otherGuardianName",
  "기타보호자출결알림": "otherGuardianAttendanceAlert",
  "입학일": "admissionDate",
  "입학동기": "admissionReason",
  "재원여부": "isEnrolled",
  "퇴원일": "withdrawnDate",
  "퇴원사유": "withdrawnReason",
  "휴원여부": "isOnLeave",
  "휴원사유": "leaveReason",
  "메모": "memo",
  "수업": "classes",
  "담임강사": "homeroomTeacher",
  "현금영수증발급번호": "cashReceiptNo",
  "현금영수증발급구분": "cashReceiptType",
  "수납기준청구일": "billingDay",
  "할인액": "discountAmount",
  "할인구분": "discountType",
  "원생고유번호": "studentUid",
  "기타수납": "otherPayment",
  "원생분류": "studentCategory",
  "기타항목1": "extra1",
  "기타항목2": "extra2",
  "포인트": "points",
  "적립금": "credits",
  "자동결제신청여부": "autoPayEnrolled",
  "등록일": "registeredDate",
};
export function WithdrawnRecordPanel({ studentId }: { studentId: string }) {
  const { t } = useTranslation("std");
  const qc = useQueryClient();
  const [edit, setEdit] = useState<RecordData | null>(null);
  const query = useQuery({
    queryKey: ["std", "withdrawn", studentId],
    queryFn: async () =>
      (
        await apiClient.get<RecordData[]>(
          `/acm/std/withdrawn/${studentId}/records`,
        )
      ).data,
  });
  const save = useMutation({
    mutationFn: async () =>
      apiClient.put(`/acm/std/withdrawn/${studentId}/records/${edit!.id}`, {
        fields: edit!.fields,
        updatedAt: edit!.updatedAt,
      }),
    onSuccess: () => {
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["std", "withdrawn", studentId] });
    },
  });
  if (query.isLoading) return <p>{t("common:status.loading")}</p>;
  if (query.error) return <p role="alert">{t("withdrawn.failed")}</p>;
  if (!query.data?.length) return null;
  return (
    <>
      {query.data.map((record) => {
        const current = edit?.id === record.id ? edit : record;
        return (
          <section
            key={record.id}
            className="rounded-lg border border-[var(--border-subtle)] bg-surface p-4"
          >
            <div className="flex justify-between">
              <h3 className="text-[13px] font-bold">
                {t("withdrawn.recordTitle")}
              </h3>
              <Button
                size="sm"
                variant="outline"
                disabled={save.isPending}
                onClick={() => {
                  save.reset();
                  setEdit({ ...record, fields: { ...record.fields } });
                }}
              >
                {t("common:actions.edit")}
              </Button>
            </div>
            <p className="text-xs text-secondary my-2">
              {t("withdrawn.sourceHint")}
            </p>
            {[
              {
                title: "form.sectionBasic",
                keys: [
                  "이름",
                  "성별",
                  "출결번호",
                  "학교",
                  "학년",
                  "반",
                  "원생연락처",
                  "집전화",
                  "닉네임",
                  "생일",
                  "우편번호",
                  "주소1",
                  "주소2",
                  "문과/이과",
                  "형제",
                  "졸업연도",
                  "원생이메일",
                ],
              },
              {
                title: "form.sectionParents",
                keys: [
                  "보호자연락처",
                  "보호자구분",
                  "보호자이름",
                  "보호자출결알림",
                  "기타보호자연락처",
                  "기타보호자이름",
                  "기타보호자출결알림",
                ],
              },
              {
                title: "withdrawn.datesTitle",
                keys: [
                  "입학일",
                  "입학동기",
                  "재원여부",
                  "퇴원일",
                  "퇴원사유",
                  "휴원여부",
                  "휴원사유",
                  "메모",
                  "수업",
                  "담임강사",
                ],
              },
              {
                title: "withdrawn.source",
                keys: [
                  "현금영수증발급번호",
                  "현금영수증발급구분",
                  "수납기준청구일",
                  "할인액",
                  "할인구분",
                  "원생고유번호",
                  "기타수납",
                  "원생분류",
                  "기타항목1",
                  "기타항목2",
                  "포인트",
                  "적립금",
                  "자동결제신청여부",
                  "등록일",
                ],
              },
            ].map((group) => (
              <div
                key={group.title}
                className="border rounded bg-surface p-3 mt-3"
              >
                <h4 className="text-[13px] font-bold mb-2">{t(group.title)}</h4>
                <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(current.fields)
                    .filter(([key]) => group.keys.includes(key))
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-xs text-secondary">
                          <label htmlFor={`${record.id}-${key}`}>
                            {FIELD_LABEL_KEYS[key]
                              ? t(`withdrawn.fields.${FIELD_LABEL_KEYS[key]}`)
                              : key}{" "}
                            :
                          </label>
                        </dt>
                        <dd className="text-sm break-words whitespace-pre-wrap">
                          {edit?.id === record.id && key !== "원생고유번호" ? (
                            typeof value === "boolean" ? (
                              <select
                                id={`${record.id}-${key}`}
                                value={String(value)}
                                onChange={(e) =>
                                  setEdit({
                                    ...edit,
                                    fields: {
                                      ...edit.fields,
                                      [key]: e.target.value === "true",
                                    },
                                  })
                                }
                              >
                                <option value="true">O</option>
                                <option value="false">X</option>
                              </select>
                            ) : (
                              <textarea
                                id={`${record.id}-${key}`}
                                placeholder={t("detail.enterValue")}
                                className="w-full border rounded p-1 bg-surface placeholder:italic placeholder:text-secondary"
                                rows={key === "메모" ? 4 : 1}
                                value={value == null ? "" : String(value)}
                                onChange={(e) =>
                                  setEdit({
                                    ...edit,
                                    fields: {
                                      ...edit.fields,
                                      [key]: e.target.value || null,
                                    },
                                  })
                                }
                              />
                            )
                          ) : value == null || value === "" ? (
                            <span className="italic text-secondary">
                              {t("detail.inputRequired")}
                            </span>
                          ) : typeof value === "boolean" ? (
                            value ? (
                              "O"
                            ) : (
                              "X"
                            )
                          ) : (
                            String(value)
                          )}
                        </dd>
                      </div>
                    ))}
                </dl>
              </div>
            ))}
            {edit?.id === record.id && (
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => setEdit(null)}
                >
                  {t("common:actions.cancel")}
                </Button>
                <Button disabled={save.isPending} onClick={() => save.mutate()}>
                  {t("common:actions.save")}
                </Button>
              </div>
            )}
            {save.error && edit?.id === record.id && (
              <p role="alert">{t("withdrawn.failed")}</p>
            )}
          </section>
        );
      })}
    </>
  );
}
