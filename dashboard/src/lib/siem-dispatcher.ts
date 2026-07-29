import { db } from "@/lib/db";
import { siemIntegrations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function dispatchToSIEM(logData: any) {
  try {
    const integrations = await db.select().from(siemIntegrations).where(eq(siemIntegrations.enabled, true));
    
    if (integrations.length === 0) return;

    const promises = integrations.map(async (integration) => {
      try {
        switch (integration.provider) {
          case 'datadog':
            return await sendToDatadog(integration, logData);
          case 'splunk':
            return await sendToSplunk(integration, logData);
          case 'wazuh':
            return await sendToWazuh(integration, logData);
          case 'elk':
            return await sendToElk(integration, logData);
          default:
            console.warn(`Unknown SIEM provider: ${integration.provider}`);
        }
      } catch (err) {
        console.error(`Error sending to SIEM (${integration.provider}):`, err);
      }
    });

    // We process them in parallel
    await Promise.allSettled(promises);
  } catch (err) {
    console.error("SIEM Dispatcher Error:", err);
  }
}

async function sendToDatadog(integration: any, logData: any) {
  // Datadog HTTP Intake API
  const payload = {
    ddsource: 'promptwall',
    ddtags: `env:${logData.environment || 'production'},action:${logData.action}`,
    hostname: 'promptwall-engine',
    message: JSON.stringify(logData),
    status: logData.action === 'block' ? 'error' : (logData.action === 'redact' ? 'warning' : 'info')
  };

  const res = await fetch(integration.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': integration.apiKey,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Datadog API Error: ${res.status}`);
}

async function sendToSplunk(integration: any, logData: any) {
  // Splunk HTTP Event Collector (HEC)
  const payload = {
    time: Date.now(),
    host: 'promptwall-engine',
    source: 'promptwall',
    sourcetype: '_json',
    event: logData,
  };

  const res = await fetch(integration.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Splunk ${integration.apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Splunk API Error: ${res.status}`);
}

async function sendToWazuh(integration: any, logData: any) {
  // Wazuh API 
  const res = await fetch(integration.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${integration.apiKey}`,
    },
    body: JSON.stringify(logData),
  });
  if (!res.ok) throw new Error(`Wazuh API Error: ${res.status}`);
}

async function sendToElk(integration: any, logData: any) {
  // Elasticsearch /_doc endpoint
  const res = await fetch(integration.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `ApiKey ${integration.apiKey}`,
    },
    body: JSON.stringify(logData),
  });
  if (!res.ok) throw new Error(`ELK API Error: ${res.status}`);
}
