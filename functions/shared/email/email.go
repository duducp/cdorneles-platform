// Package email renders transactional emails with the Appwrite default email
// theme for functions that send mail directly through Appwrite Messaging.
//
// The layout mirrors Appwrite's own templates (app/config/locale/templates/
// email-base.tpl and email-magic-url.tpl): a white card on a quiet background,
// Inter typography, light/dark support via prefers-color-scheme, the dark
// rounded action button and the closing security note. Recipients therefore
// see a welcome email that looks exactly like the platform's recovery or
// verification emails.
package email

import (
	"html"
	"strings"
)

// base is the document chrome from Appwrite's email-base.tpl, with the
// preview text and body left as placeholders. Placeholders are replaced with
// strings.ReplaceAll (never fmt.Sprintf) so bodies containing `%` stay safe.
const base = `<!doctype html>
<html>
<head>
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style type="text/css">
:root {
color-scheme: light dark;
supported-color-schemes: light dark;
}
@media (prefers-color-scheme: dark ) {
body {
color: #616b7c !important;
background-color: #ffffff !important;
}
a {
color: currentColor !important;
}
a.button {
color: #ffffff !important;
background-color: #2D2D31 !important;
border-color: #414146 !important;
}
h1, h2, h3 {
color: #373b4d !important;
}
h4 {
color: #4f5769 !important;
}
p.security-phrase:not(:empty), hr {
border-color: #e8e9f0 !important;
}
}
</style>
<style>
@font-face {
font-family: 'Inter';
src: url('https://assets.appwrite.io/fonts/inter/Inter-Regular.woff2') format('woff2');
font-weight: 400;
font-style: normal;
font-display: swap;
}
@font-face {
font-family: 'DM Sans';
src: url('https://assets.appwrite.io/fonts/dm-sans/dm-sans-v16-latin-600.woff2') format('woff2');
font-weight: 600;
font-style: normal;
font-display: swap;
}
</style>
<style>
.main {
max-width: 650px;
margin: 0 auto;
margin-top: 32px;
padding: 32px;
line-height: 1.5;
color: #616b7c;
font-size: 15px;
font-weight: 400;
font-family: "Inter", sans-serif;
background-color: #ffffff;
}
.main a {
color: currentColor;
word-break: break-all;
}
.main a.button {
box-sizing: border-box;
display: inline-block;
text-align: center;
text-decoration: none;
padding: 9px 14px;
color: #ffffff;
background-color: #19191D;
border: 1px solid #414146;
border-radius: 8px;
}
.main a.button:hover,
.main a.button:focus {
opacity: 0.8;
}
table {
width: 100%;
border-spacing: 0 !important;
}
table, tr, th, td {
margin: 0;
padding: 0;
}
td {
vertical-align: top;
}
h1 {
font-size: 22px;
margin-bottom: 0px;
margin-top: 0px;
color: #373b4d;
}
h2 {
font-size: 20px;
font-weight: 600;
color: #373b4d;
}
h3 {
font-size: 14px;
font-weight: 500;
color: #373b4d;
line-height: 21px;
margin: 0;
padding: 0;
}
h4 {
font-family: "DM Sans", sans-serif;
font-weight: 600;
font-size: 12px;
color: #4f5769;
margin: 0;
padding: 0;
}
hr {
border: none;
border-top: 1px solid #e8e9f0;
}
p {
margin-bottom: 10px;
}
p.security-phrase:not(:empty) {
opacity: 0.7;
margin-top: 32px;
padding-top: 32px;
border-top: 1px solid #e8e9f0;
}
</style>
</head>
<body style="direction: ltr">
<div style="display: none; overflow: hidden; max-height: 0; max-width: 0; opacity: 0; line-height: 1px;">
{{preview}}
<div>{{previewWhitespace}}</div>
</div>
<div class="main" style="max-width:650px; word-wrap: break-word; overflow-wrap: break-word; word-break: normal; margin:0 auto;">
<table style="margin-top: 32px">
<tr>
<td>
{{body}}
</td>
</tr>
</table>
</div>
</body>
</html>`

// Wrap renders the base document around an already themed inner body. The
// preview is the hidden preheader text email clients show in the inbox list.
func Wrap(preview, bodyHTML string) string {
	doc := strings.ReplaceAll(base, "{{preview}}", html.EscapeString(preview))
	doc = strings.ReplaceAll(doc, "{{previewWhitespace}}", "")
	return strings.ReplaceAll(doc, "{{body}}", bodyHTML)
}

// Button renders the default-styled action button, table-wrapped exactly the
// way Appwrite's inner templates do so the padding survives Outlook.
func Button(href, label string) string {
	return `<table border="0" cellspacing="0" cellpadding="0" style="padding-top: 10px; padding-bottom: 10px; display: inline-block;">
<tr>
<td align="center" style="border-radius: 8px; background-color: #19191D;">
<a rel="noopener" target="_blank" href="` + html.EscapeString(href) + `" class="button">` + html.EscapeString(label) + `</a>
</td>
</tr>
</table>`
}

// Welcome renders the "your account was created" email: a themed card with
// the temporary password, an optional sign-in button (empty loginURL omits
// it) and the same closing note Appwrite's templates use.
func Welcome(name, password, loginURL string) string {
	var body strings.Builder
	body.WriteString("<p>Olá " + html.EscapeString(name) + ",</p>")
	body.WriteString(
		"<p>Uma conta foi criada para você na plataforma. Use a senha temporária abaixo para entrar e troque-a no primeiro acesso.</p>",
	)
	body.WriteString(`<h3>Senha temporária</h3>`)
	body.WriteString(`<p style="font-size: 18px; line-height: 150%; margin-top: 8px;"><strong>` +
		html.EscapeString(password) + `</strong></p>`)
	if strings.TrimSpace(loginURL) != "" {
		body.WriteString(Button(loginURL, "Entrar agora"))
		body.WriteString(
			`<p>Se o botão não funcionar, copie e cole este endereço no navegador:<br>` +
				`<a href="` + html.EscapeString(loginURL) + `" target="_blank" style="font-size: 12px; line-height: 100%;">` +
				html.EscapeString(loginURL) + `</a></p>`,
		)
	}
	body.WriteString(`<p style="margin-bottom: 0px;">Atenciosamente,</p>`)
	body.WriteString(`<p style="margin-top: 0px;">Equipe Carlos Dorneles</p>`)
	body.WriteString(`<hr style="margin-block-start: 1rem; margin-block-end: 1rem;">`)
	body.WriteString(
		`<p class="security-phrase" style="margin-bottom: 0px;">Se você não esperava esta mensagem, ignore este e-mail e fale com o administrador da sua organização.</p>`,
	)
	return Wrap("Sua conta foi criada — a senha temporária está dentro.", body.String())
}
