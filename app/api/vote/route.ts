import { NextRequest, NextResponse } from "next/server";
import { castVote, getItemById, type OyRedSebebi } from "@/lib/db";
import { getVoterIdentity, ipGunOzeti } from "@/lib/auth";

const RED_MESAJI: Record<OyRedSebebi, string> = {
  "gunluk-sinir": "Bugünlük oy hakkın doldu. Yarın devam edebilirsin.",
  "ip-sinir": "Bu ağdan bugün çok fazla farklı kimlikle oy verildi.",
  "cok-hizli": "Biraz yavaş — oylar arasında kısa bir bekleme var.",
};

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
  const ipGun = await ipGunOzeti();
  const result = await castVote({
    itemId,
    voterKey,
    userId,
    value: value as 1 | -1,
    weight,
    ipGun,
  });

  if (!result.ok && result.red) {
    // 429: istemci kullanıcıya sebebi gösterebilsin
    return NextResponse.json(
      { ok: false, red: result.red, error: RED_MESAJI[result.red] },
      { status: 429 }
    );
  }

  return NextResponse.json({
    ok: result.ok,
    changed: result.changed,
    weight: result.agirlik ?? weight,
    member: userId !== null,
  });
}
