import { env } from "@/env";

import { Pinecone } from "@pinecone-database/pinecone";

const pc = new Pinecone({
  apiKey: env.PINECONE_API_KEY,
});

export { pc };
