import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const gasUrl =
    process.env.GAS_WEB_APP_URL || process.env.NEXT_PUBLIC_GAS_WEB_APP_URL;

  if (!gasUrl) {
    return NextResponse.json(
      {
        success: false,
        error: "Google Apps Script 웹 앱 URL이 설정되지 않았습니다.",
        notConfigured: true,
      },
      { status: 200 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const url = new URL(gasUrl);
    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    const res = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "구글 시트 조회 실패: " + String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const gasUrl =
    process.env.GAS_WEB_APP_URL || process.env.NEXT_PUBLIC_GAS_WEB_APP_URL;

  if (!gasUrl) {
    return NextResponse.json(
      {
        success: false,
        error: "Google Apps Script 웹 앱 URL이 설정되지 않았습니다.",
        notConfigured: true,
      },
      { status: 200 }
    );
  }

  try {
    const body = await request.json();

    const res = await fetch(gasUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "follow",
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "구글 시트 연동 요청 실패: " + String(error) },
      { status: 500 }
    );
  }
}
