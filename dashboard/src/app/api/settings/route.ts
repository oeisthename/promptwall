import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const configs = await db.select().from(settings).where(eq(settings.id, "global"));
    
    if (configs.length === 0) {
      // Return defaults if not set
      return NextResponse.json({ webhookUrl: "", retentionDays: 30 });
    }
    
    return NextResponse.json(configs[0]);
  } catch (error) {
    console.error("[SETTINGS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { webhookUrl, retentionDays } = body;

    const existing = await db.select().from(settings).where(eq(settings.id, "global"));

    if (existing.length === 0) {
      await db.insert(settings).values({
        id: "global",
        webhookUrl: webhookUrl || "",
        retentionDays: retentionDays || 30,
      });
    } else {
      await db.update(settings).set({
        webhookUrl: webhookUrl || "",
        retentionDays: retentionDays || 30,
      }).where(eq(settings.id, "global"));
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[SETTINGS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
