import { NextRequest, NextResponse } from "next/server";
import { bultenOnayla } from "@/lib/db";
import { siteUrl } from "@/lib/site";

/** Bülten çift onayının ikinci adımı. */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t") ?? "";
  const ok = t ? await bultenOnayla(t) : false;
  return NextResponse.redirect(`${siteUrl()}/bulten?durum=${ok ? "onaylandi" : "gecersiz"}`);
}
