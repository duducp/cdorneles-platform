package email

import (
	"strings"
	"testing"
)

func TestWrapRendersBodyInsideTheCard(t *testing.T) {
	doc := Wrap("Pré-visualização", "<p>corpo</p>")

	if !strings.Contains(doc, "Pré-visualização") {
		t.Fatal("expected the preview text in the hidden preheader")
	}
	if !strings.Contains(doc, "<p>corpo</p>") {
		t.Fatal("expected the body inside the base document")
	}
	if strings.Contains(doc, "{{body}}") || strings.Contains(doc, "{{preview}}") {
		t.Fatal("expected every placeholder to be replaced")
	}
}

// Percent signs in user content must not break rendering: the base is
// substituted with strings.ReplaceAll, never fmt.Sprintf.
func TestWrapToleratesPercentSigns(t *testing.T) {
	doc := Wrap("p", "<p>100% pronto</p>")

	if !strings.Contains(doc, "100% pronto") {
		t.Fatal("expected a percent sign to survive rendering")
	}
}

func TestButtonEscapesHrefAndLabel(t *testing.T) {
	button := Button("https://app.test/login?a=1&b=2", "Entrar & começar")

	if !strings.Contains(button, `href="https://app.test/login?a=1&amp;b=2"`) {
		t.Fatalf("expected an escaped href, got %s", button)
	}
	if !strings.Contains(button, "Entrar &amp; começar") {
		t.Fatalf("expected an escaped label, got %s", button)
	}
	if !strings.Contains(button, `background-color: #19191D;`) {
		t.Fatalf("expected the default dark button color, got %s", button)
	}
}

func TestWelcomeIncludesPasswordAndSecurityNote(t *testing.T) {
	doc := Welcome("Ana", "tmp-pass_123", "https://app.test/login")

	for _, want := range []string{
		"Olá Ana,",
		"tmp-pass_123",
		`href="https://app.test/login"`,
		"Entrar agora",
		"security-phrase",
		"Equipe Carlos Dorneles",
	} {
		if !strings.Contains(doc, want) {
			t.Fatalf("expected the welcome email to contain %q", want)
		}
	}
}

func TestWelcomeEscapesUserName(t *testing.T) {
	doc := Welcome("<b>Ana</b>", "pw", "")

	if strings.Contains(doc, "<b>Ana</b>") {
		t.Fatalf("expected the name to be escaped, got %s", doc)
	}
	if !strings.Contains(doc, "&lt;b&gt;Ana&lt;/b&gt;") {
		t.Fatal("expected the escaped name in the output")
	}
}

// Without a login URL the button and the copy-paste fallback must be absent
// entirely.
func TestWelcomeOmitsButtonWithoutLoginURL(t *testing.T) {
	doc := Welcome("Ana", "pw", "")

	if strings.Contains(doc, "Entrar agora") {
		t.Fatal("expected no button without a login URL")
	}
	if strings.Contains(doc, `class="button"`) {
		t.Fatal("expected no anchor button without a login URL")
	}
}
