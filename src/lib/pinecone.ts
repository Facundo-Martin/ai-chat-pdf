import { env } from "@/env";

import { Pinecone } from "@pinecone-database/pinecone";

const pc = new Pinecone({
  apiKey: env.PINECONE_API_KEY,
});

export { pc };

const indexName = "ai-chat-pdf";

await pc.createIndexForModel({
  name: indexName,
  cloud: "aws",
  region: "us-east-1",
  embed: {
    model: "llama-text-embed-v2",
    fieldMap: { text: "chunk_text" },
  },
  waitUntilReady: true,
});

pc.Index("ai-chat-pdf");
