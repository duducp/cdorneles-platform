# Site deployments — the Next.js apps on Appwrite Sites.
#
# The Go Appwrite Functions have their own Makefile at functions/Makefile.

SITES := admin client design-system
DEPLOY_SITE_TARGETS := $(addprefix deploy-site-,$(SITES))

.PHONY: deploy-sites deploy-functions $(DEPLOY_SITE_TARGETS)

# Deploy every site (creates them in Appwrite if missing, then activates a new
# deployment). Requires the Appwrite CLI, logged in and configured.
deploy-sites:
	./scripts/deploy-sites.sh

# Deploy the Go Appwrite Functions (creates them in Appwrite if missing, then
# activates a new deployment). Requires the Appwrite CLI, logged in and
# configured.
deploy-functions:
	$(MAKE) -C functions deploy

# Deploy a single site, e.g. `make deploy-site-admin`.
$(DEPLOY_SITE_TARGETS): deploy-site-%:
	./scripts/deploy-sites.sh $*
