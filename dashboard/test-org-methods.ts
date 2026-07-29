import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

const client = createAuthClient({ plugins: [organizationClient()] });
console.log("has organization.list:", !!(client.organization as any)?.list);
