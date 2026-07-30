import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handlers = toNextJsHandler(auth);

export async function GET(req: Request) {
  console.log("BETTER AUTH GET:", req.url);
  const res = await handlers.GET(req);
  console.log("BETTER AUTH RESPONSE:", res.status);
  return res;
}

export async function POST(req: Request) {
  console.log("BETTER AUTH POST:", req.url);
  return handlers.POST(req);
}
