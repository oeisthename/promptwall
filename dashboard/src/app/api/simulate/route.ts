import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import * as yaml from "js-yaml";

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { prompt, policyYaml } = await req.json();

    if (!prompt || !policyYaml) {
      return new NextResponse("Prompt and Policy YAML are required", { status: 400 });
    }

    let parsedPolicy;
    try {
      parsedPolicy = yaml.load(policyYaml) as any;
    } catch (e) {
      return NextResponse.json({
        decision: "error",
        reason: "Invalid YAML configuration format.",
        score: 0,
      });
    }

    // A very simple simulation logic for the playground
    // In a real application, this would pass the prompt and policy to the core engine.
    let decision = "allow";
    let reason = "Passed all checks";
    let score = 0.05; // Base low threat score

    const policies = parsedPolicy.policies || [];
    
    for (const policy of policies) {
      if (policy.type === "regex" && policy.match) {
        try {
          const regex = new RegExp(policy.match, "i");
          if (regex.test(prompt)) {
            decision = policy.action || "block";
            reason = `Matched rule: ${policy.name}`;
            score = 0.99;
            break;
          }
        } catch (e) {
          // invalid regex in yaml
        }
      } else if (policy.type === "keyword" && policy.keywords) {
        const lowerPrompt = prompt.toLowerCase();
        for (const kw of policy.keywords) {
          if (lowerPrompt.includes(kw.toLowerCase())) {
            decision = policy.action || "block";
            reason = `Matched keyword in rule: ${policy.name}`;
            score = 0.85;
            break;
          }
        }
        if (decision === "block") break;
      }
    }

    // Simulate network latency (200-500ms) to make it feel real
    await new Promise(r => setTimeout(r, Math.random() * 300 + 200));

    return NextResponse.json({ decision, reason, score });
  } catch (error) {
    console.error("[SIMULATE_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
