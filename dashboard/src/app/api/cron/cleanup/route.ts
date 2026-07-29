import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settings, auditLogs } from '@/lib/db/schema';
import { lt } from 'drizzle-orm';
import { subDays } from 'date-fns';

// This endpoint should be secured in production 
// (e.g., check for a valid cron secret token)
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Fetch the configured retention days
    const config = await db.select().from(settings).limit(1);
    const retentionDays = config.length > 0 && config[0].retentionDays 
      ? config[0].retentionDays 
      : 30; // Default to 30 days

    // Calculate the threshold date
    const thresholdDate = subDays(new Date(), retentionDays);

    // Delete logs older than the threshold
    const result = await db.delete(auditLogs)
      .where(lt(auditLogs.timestamp, thresholdDate))
      .returning();

    return NextResponse.json({ 
      success: true, 
      message: `Cleaned up ${result.length} old audit logs.`,
      retentionDays 
    });

  } catch (error: any) {
    console.error('Cron Cleanup Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
