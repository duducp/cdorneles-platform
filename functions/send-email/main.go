// Package handler implements the send-email Appwrite Function.
package handler

import (
	sdk "github.com/appwrite/sdk-for-go/v7/appwrite"
	"github.com/appwrite/sdk-for-go/v7/id"
	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	platform "github.com/cdorneles/platform/functions/internal/appwrite"
	"github.com/cdorneles/platform/functions/internal/httpx"
)

type emailRequest struct {
	To       []string `json:"to"`
	Subject  string   `json:"subject"`
	HTMLBody string   `json:"htmlBody"`
	TextBody string   `json:"textBody"`
}

type emailResponse struct {
	OK         bool     `json:"ok"`
	MessageIDs []string `json:"messageIds"`
}

// Main sends one email message per recipient.
func Main(ctx openruntimes.Context) openruntimes.Response {
	userID := ctx.Req.Headers["x-appwrite-user-id"]
	if userID == "" {
		return httpx.Unauthorized(ctx, "missing user identity")
	}

	var body emailRequest
	if err := ctx.Req.BodyJson(&body); err != nil {
		return httpx.BadRequest(ctx, "invalid JSON")
	}

	if len(body.To) == 0 || body.Subject == "" || body.HTMLBody == "" {
		return httpx.BadRequest(ctx, "to, subject, and htmlBody are required")
	}

	client := platform.NewClient(ctx.Req.Headers["x-appwrite-key"])
	messagingSvc := sdk.NewMessaging(client)

	messageIDs := make([]string, 0, len(body.To))
	for _, recipient := range body.To {
		message, err := messagingSvc.CreateEmail(
			id.Unique(),
			body.Subject,
			body.HTMLBody,
			messagingSvc.WithCreateEmailUsers([]string{recipient}),
		)
		if err != nil {
			ctx.Error("send-email failed", err)
			return ctx.Res.Json(
				httpx.Error{Error: "internal", Reason: "failed to send email"},
				ctx.Res.WithStatusCode(500),
			)
		}
		messageIDs = append(messageIDs, message.Id)
	}

	ctx.Log(map[string]interface{}{
		"action":     "send-email",
		"userId":     userID,
		"recipients": len(body.To),
		"subject":    body.Subject,
	})

	return ctx.Res.Json(emailResponse{OK: true, MessageIDs: messageIDs})
}
