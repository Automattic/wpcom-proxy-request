
# get Makefile directory name: http://stackoverflow.com/a/5982798/376773
THIS_MAKEFILE_PATH:=$(word $(words $(MAKEFILE_LIST)),$(MAKEFILE_LIST))
THIS_DIR:=$(shell cd $(dir $(THIS_MAKEFILE_PATH));pwd)

# BIN folder
BIN := $(THIS_DIR)/node_modules/.bin

# applications
NODE ?= node
BROWSERIFY ?= $(NODE) $(BIN)/browserify

standalone: wpcom-cookie-auth.js

wpcom-cookie-auth.js: index.js
	@$(BROWSERIFY) -s wpcom_proxy_request index.js > $@

.PHONY: standalone
