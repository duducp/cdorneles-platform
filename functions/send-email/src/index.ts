import { Client, ID, Messaging } from "node-appwrite";

interface EmailRequest {
  to: string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
}

interface Context {
  req: { body: string; headers: Record<string, string> };
  res: { json(value: unknown, status?: number): unknown };
  log: (message: unknown) => void;
}

export default async function ({ req, res, log }: Context) {
  const headerUserId = req.headers["x-appwrite-user-id"] ?? "";
  if (!headerUserId) {
    return res.json({ error: "unauthorized", reason: "missing user identity" }, 401);
  }

  let body: EmailRequest;
  try {
    body = JSON.parse(req.body) as EmailRequest;
  } catch {
    return res.json({ error: "bad_request", reason: "invalid JSON" }, 400);
  }

  if (!body.to?.length || !body.subject || !body.htmlBody) {
    return res.json(
      { error: "bad_request", reason: "to, subject, and htmlBody are required" },
      400,
    );
  }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT ?? "")
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID ?? "")
    .setKey(req.headers["x-appwrite-key"] ?? "");

  const messaging = new Messaging(client);

  const messageIds: string[] = [];

  for (const recipient of body.to) {
    const message = await messaging.createEmail(
      ID.unique(),
      body.subject,
      body.htmlBody,
      undefined, // cc
      undefined, // bcc
      undefined, // attachments
      [recipient],
    );
    messageIds.push(message.$id);
  }

  log({
    action: "send-email",
    userId: headerUserId,
    recipients: body.to.length,
    subject: body.subject,
  });

  return res.json({ ok: true, messageIds });
}
