import { createAuthClient } from "better-auth/react";
import { organizationClient, multiSessionClient, twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    multiSessionClient(),
    twoFactorClient(),
  ]
});
