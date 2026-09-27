import { Functions } from "appwrite";
import type { Client, ExecutionMethod } from "appwrite";

import type { FunctionsApi } from "../client";
import type { AppwriteExecution } from "../dto";
import { ApiError } from "../errors";
import { mapAppwriteError } from "./map-error";

interface FunctionErrorBody {
  error?: string;
  reason?: string;
}

interface ExecutionInput {
  functionId: string;
  body?: string | Record<string, unknown>;
  path?: string;
  method?: string;
}

export function createFunctionsApi(client: Client): FunctionsApi {
  const functions = new Functions(client);

  async function execute(input: ExecutionInput): Promise<AppwriteExecution> {
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
  }

  function parseResponse<T>(execution: AppwriteExecution): T {
    let data: T & FunctionErrorBody;
    try {
      data = JSON.parse(execution.responseBody) as T & FunctionErrorBody;
    } catch (cause) {
      throw new ApiError("malformed function response", { code: "invalid_response", cause });
    }
    if (data === null || typeof data !== "object") {
      throw new ApiError("malformed function response", { code: "invalid_response" });
    }
    if (data.error) {
      throw new ApiError(data.reason ?? data.error, { code: data.error });
    }
    return data;
  }

  return {
    createExecution: execute,

    async createUser(input) {
      const execution = await execute({
        functionId: "create-user",
        body: input,
        method: "POST",
      });
      const data = parseResponse<{ userId: string }>(execution);
      return { userId: data.userId };
    },

    async updateUserPermissions(input) {
      const execution = await execute({
        functionId: "update-user-permissions",
        body: input,
        method: "POST",
      });
      parseResponse<Record<string, never>>(execution);
    },

    async listUsers() {
      const execution = await execute({
        functionId: "list-users",
        body: {},
        method: "POST",
      });
      const data = parseResponse<{
        users: { id: string; email: string; name: string; labels: string[] }[];
      }>(execution);
      return { users: data.users };
    },

    async listOrganizations() {
      const execution = await execute({
        functionId: "list-organizations",
        body: {},
        method: "POST",
      });
      const data = parseResponse<{
        organizations: { id: string; name: string }[];
      }>(execution);
      return { organizations: data.organizations };
    },

    async oneTapLogin(input) {
      const execution = await execute({
        functionId: "one-tap-login",
        body: input,
        method: "POST",
      });
      return parseResponse<{ userId: string; secret: string }>(execution);
    },

    async publicLogin(input) {
      const execution = await execute({
        functionId: "public-auth",
        body: { action: "login", ...input },
        method: "POST",
      });
      const data = parseResponse<{ userId: string; secret: string }>(execution);
      return { userId: data.userId, secret: data.secret };
    },

    async publicMfaChallenge(input) {
      const execution = await execute({
        functionId: "public-auth",
        body: { action: "mfaChallenge", ...input },
        method: "POST",
      });
      const data = parseResponse<{ challengeId: string }>(execution);
      return { challengeId: data.challengeId };
    },

    async publicMfaVerify(input) {
      const execution = await execute({
        functionId: "public-auth",
        body: { action: "mfaVerify", ...input },
        method: "POST",
      });
      const data = parseResponse<{ $id: string; userId: string; expire: string }>(execution);
      return { $id: data.$id, userId: data.userId, expire: data.expire };
    },

    async publicRequestRecovery(input) {
      const execution = await execute({
        functionId: "public-auth",
        body: { action: "requestRecovery", ...input },
        method: "POST",
      });
      parseResponse<Record<string, never>>(execution);
    },

    async publicCompleteRecovery(input) {
      const execution = await execute({
        functionId: "public-auth",
        body: { action: "completeRecovery", ...input },
        method: "POST",
      });
      parseResponse<Record<string, never>>(execution);
    },
  };
}
