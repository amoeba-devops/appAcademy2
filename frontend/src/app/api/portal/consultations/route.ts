import { NextResponse } from "next/server";
import { consultationApiSchema } from "@/lib/portal/schemas";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "요청 본문이 올바르지 않습니다." } },
      { status: 400 },
    );
  }

  const parsed = consultationApiSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "입력값을 확인해 주세요.",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  console.log(
    `[consultations] ${parsed.data.type} received`,
    JSON.stringify(parsed.data.payload),
  );

  return NextResponse.json(
    {
      data: {
        type: parsed.data.type,
        receivedAt: new Date().toISOString(),
      },
    },
    { status: 201 },
  );
}
