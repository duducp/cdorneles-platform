import { Client } from "node-appwrite";

export interface AppwriteConfig {
  endpoint: string;
  projectId: string;
  apiKey: string;
}

export function createClient(config: AppwriteConfig): Client {
  return new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
}
