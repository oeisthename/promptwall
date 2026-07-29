import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

const client = createAuthClient({ plugins: [organizationClient()] });
console.log("has useListOrganizations:", !!(client as any).useListOrganizations);
console.log("has organization.useList:", !!(client.organization as any)?.useList);
