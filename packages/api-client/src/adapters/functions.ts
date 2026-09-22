import { Functions } from "appwrite";
import type { Client, ExecutionMethod } from "appwrite";

import type { FunctionsApi } from "../client";
import type { AppwriteExecution } from "../dto";
import { mapAppwriteError } from "./map-error";

export function createFunctionsApi(client: Client): FunctionsApi {
  const functions = new Functions(client);

  return {
    async createExecution(input): Promise<AppwriteExecution> {
      try {
        const body = typeof input.body === "string" ? input.body : JSON.stringify(input.body);
        const execution = await functions.createExecution({
          functionId: input.functionId,
          body,
          async: false,
          xpath: input.path,
          method: input.method as ExecutionMethod | undefined,
        });
        return {
          $id: execution.$id,
          status: execution.status,
          responseBody: execution.responseBody,
        };
      } catch (error) {
        throw mapAppwriteError(error);
      }
    },
  };
}
