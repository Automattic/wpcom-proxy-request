
# get Makefile directory name: http://stackoverflow.com/a/5982798/376773
THIS_MAKEFILE_PATH:=$(word $(words $(MAKEFILE_LIST)),$(MAKEFILE_LIST))
THIS_DIR:=$(shell cd $(dir $(THIS_MAKEFILE_PATH));pwd)

# BIN directory
BIN := $(THIS_DIR)/node_modules/.bin

# applications
NODE ?= node
NPM ?= $(NODE) $(shell which npm)
BABEL ?= $(NODE) $(BIN)/babel
WEBPACK ?= $(NODE) $(BIN)/webpack

standalone: dist/wpcom-proxy-request.js

install: node_modules

clean:
	@rm -rf dist

distclean:
	@rm -rf node_modules

babelify: dist
	@$(BABEL) \
		index.js \
		--optional runtime \
		--out-file dist/index.js

dist:
	@mkdir -p $@

dist/wpcom-proxy-request.js: node_modules dist
	@$(WEBPACK) -p --config webpack.config.js

node_modules: package.json
	@NODE_ENV= $(NPM) install
	@touch node_modules


.PHONY: standalone install clean babelify
