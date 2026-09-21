# Appwrite Go functions.
#
# Each function is a standalone module named `openruntimes/handler`, which is
# the contract Appwrite's Go runtime expects. The shared packages live in
# `shared/` and are materialised into each function's `internal/` by
# `scripts/prepare.sh` before building, testing, or deploying.

FUNCTIONS := resolve-grants update-organization-profile send-email

.PHONY: prepare test vet fmt clean $(FUNCTIONS)

# Materialise shared/ into each function's internal/.
prepare:
	./scripts/prepare.sh

# Compile-check every function module.
build: prepare $(FUNCTIONS)

$(FUNCTIONS):
	cd $@ && go build ./...

test: prepare
	@for fn in $(FUNCTIONS); do \
		echo "==> test $$fn"; \
		(cd $$fn && go test ./...) || exit 1; \
	done

vet: prepare
	@for fn in $(FUNCTIONS); do \
		echo "==> vet $$fn"; \
		(cd $$fn && go vet ./...) || exit 1; \
	done

fmt:
	gofmt -w shared

clean:
	rm -rf $(FUNCTIONS:%=%/internal)
