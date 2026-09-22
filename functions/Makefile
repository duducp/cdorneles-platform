# Appwrite Go functions.
#
# Each function is a standalone module named `openruntimes/handler`, which is
# the contract Appwrite's Go runtime expects. The shared packages live in
# `shared/` and are materialised into each function's `internal/` by
# `scripts/prepare.sh` before building, testing, or deploying.

FUNCTIONS := resolve-grants update-organization-profile send-email get-organization-profile provision-organization create-user update-user-permissions list-users
DEPLOY_TARGETS := $(addprefix deploy-,$(FUNCTIONS))

.PHONY: prepare test vet fmt clean deploy $(FUNCTIONS) $(DEPLOY_TARGETS)

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

# Deploy every function (creates them in Appwrite if missing, then activates a
# new deployment). Requires the Appwrite CLI, logged in and configured.
deploy:
	./scripts/deploy.sh

# Deploy a single function, e.g. `make deploy-resolve-grants`.
$(DEPLOY_TARGETS): deploy-%:
	./scripts/deploy.sh $*
