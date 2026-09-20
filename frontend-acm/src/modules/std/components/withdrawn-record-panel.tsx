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
            className="rounded-lg border border-[var(--border-subtle)] p-4"
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
              <div key={group.title} className="border rounded p-3 mt-3">
                <h4 className="text-[13px] font-bold mb-2">{t(group.title)}</h4>
                <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(current.fields)
                    .filter(([key]) => group.keys.includes(key))
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-xs text-secondary">
                          <label htmlFor={`${record.id}-${key}`}>{key} :</label>
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
                                className="w-full border rounded p-1 bg-canvas"
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
                            t("detail.inputRequired")
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
