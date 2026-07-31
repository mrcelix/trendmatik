import { NextRequest, NextResponse } from "next/server";
import { castVote, getItemById } from "@/lib/db";
import { getVoterIdentity } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let body: { itemId?: number; value?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const itemId = Number(body.itemId);
  const value = Number(body.value);
  if (!Number.isInteger(itemId) || (value !== 1 && value !== -1)) {
    return NextResponse.json({ error: "Geçersiz oy." }, { status: 400 });
  }

  const item = await getItemById(itemId);
  if (!item || (item.status !== "active" && item.status !== "candidate")) {
    return NextResponse.json({ error: "Madde bulunamadı." }, { status: 404 });
  }

  const { voterKey, userId, weight } = await getVoterIdentity();
  const result = await castVote({ itemId, voterKey, userId, value: value as 1 | -1, weight });

  return NextResponse.json({
    ok: result.ok,
    changed: result.changed,
    weight,
    member: userId !== null,
  });
}
