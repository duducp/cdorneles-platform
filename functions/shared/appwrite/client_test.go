package appwrite

import (
	"encoding/json"
	"testing"

	"github.com/appwrite/sdk-for-go/v7/models"
)

// TestRowsDataDecodesEveryRowInAList exercises the contract the functions rely
// on: the SDK does not retain a row's data for list responses, so the per-row
// Row.Decode fails, while decoding the whole RowList yields every row. This is
// the regression test for the ListRows decode failure.
func TestRowsDataDecodesEveryRowInAList(t *testing.T) {
	payload := []byte(
		`{"total":2,"rows":[{"$id":"a","key":"users.read"},{"$id":"b","key":"users.create"}]}`,
	)

	// Mirror TablesDB.ListRows exactly: the exported constructor stores the raw
	// payload, then the JSON unmarshal fills the Rows metadata (ids, etc.).
	result := models.RowList{}.New(payload)
	if err := json.Unmarshal(payload, result); err != nil {
		t.Fatalf("could not build RowList: %v", err)
	}

	// The root cause: a list row's data is never retained, so RowData fails.
	if _, err := RowData(&result.Rows[0]); err == nil {
		t.Fatal("expected RowData to fail on a list row, but it succeeded")
	}

	rows, err := RowsData(result)
	if err != nil {
		t.Fatalf("RowsData returned error: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(rows))
	}
	if got := StringField(rows[0], "key"); got != "users.read" {
		t.Fatalf("expected first row key %q, got %q", "users.read", got)
	}
	if got := StringField(rows[1], "key"); got != "users.create" {
		t.Fatalf("expected second row key %q, got %q", "users.create", got)
	}
}
