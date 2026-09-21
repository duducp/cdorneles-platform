# Site deployments — the Next.js apps on Appwrite Sites.
#
# The Go Appwrite Functions have their own Makefile at functions/Makefile.

SITES := admin client customer design-system
DEPLOY_SITE_TARGETS := $(addprefix deploy-site-,$(SITES))

.PHONY: deploy-sites $(DEPLOY_SITE_TARGETS)

# Deploy every site (creates them in Appwrite if missing, then activates a new
# deployment). Requires the Appwrite CLI, logged in and configured.
deploy-sites:
	./scripts/deploy-sites.sh

# Deploy a single site, e.g. `make deploy-site-admin`.
$(DEPLOY_SITE_TARGETS): deploy-site-%:
	./scripts/deploy-sites.sh $*
