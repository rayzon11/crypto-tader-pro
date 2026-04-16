import { NextRequest, NextResponse } from "next/server";

// CORS proxy for exchange API calls that browsers can't make directly
// Keys are passed in headers — this server never stores them

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, method, headers: fwdHeaders, payload } = body as {
      url: string;
      method: string;
      headers: Record<string, string>;
      payload?: string;
    };

    // Only allow known exchange domains
    const allowed = [
      "api.binance.com",
      "testnet.binance.vision",
      "api.coinbase.com",
      "api.exchange.coinbase.com",
    ];
    const parsed = new URL(url);
    if (!allowed.includes(parsed.hostname)) {
      return NextResponse.json(
        { error: "Domain not allowed" },
        { status: 403 }
      );
    }

    const res = await fetch(url, {
      method: method || "GET",
      headers: {
        ...fwdHeaders,
        "Content-Type": "application/json",
      },
      body: payload || undefined,
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Proxy error" },
      { status: 500 }
    );
  }
}
