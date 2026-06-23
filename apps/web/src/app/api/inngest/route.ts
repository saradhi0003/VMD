import { serve } from "inngest/next";
import { allFunctions, inngest } from "@vmd/jobs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: allFunctions,
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
