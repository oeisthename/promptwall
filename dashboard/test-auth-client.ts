import { createAuthClient } from "better-auth/react";
import { multiSessionClient } from "better-auth/client/plugins";

const client = createAuthClient({ plugins: [multiSessionClient()] });
console.log(Object.keys(client));
console.log(Object.keys(client.multiSession || {}));
