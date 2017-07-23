'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.reloadProxy = undefined;

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _uid = require('uid');

var _uid2 = _interopRequireDefault(_uid);

var _wpError = require('wp-error');

var _wpError2 = _interopRequireDefault(_wpError);

var _componentEvent = require('component-event');

var _componentEvent2 = _interopRequireDefault(_componentEvent);

var _progressEvent = require('progress-event');

var _progressEvent2 = _interopRequireDefault(_progressEvent);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * debug instance
 */
var debug = (0, _debug2.default)('wpcom-proxy-request');

/**
 * WordPress.com REST API base endpoint.
 */

/**
 * Module dependencies.
 */
var proxyOrigin = 'https://public-api.wordpress.com';

/**
 * "Origin" of the current HTML page.
 */
var origin = window.location.protocol + '//' + window.location.host;

/**
 * Detecting support for the structured clone algorithm. IE8 and 9, and Firefox
 * 6.0 and below only support strings as postMessage's message. This browsers
 * will try to use the toString method.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 * https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/The_structured_clone_algorithm
 * https://github.com/Modernizr/Modernizr/issues/388#issuecomment-31127462
 */
var postStrings = function () {
	var r = false;
	try {
		window.postMessage({
			toString: function toString() {
				r = true;
			}
		}, '*');
	} catch (e) {/* empty */}
	return r;
}();

/**
 * Reference to the <iframe> DOM element.
 * Gets set in the install() function.
 */
var iframe = null;

/**
 * Set to `true` upon the iframe's "load" event.
 */
var loaded = false;

/**
 * Array of buffered API requests. Added to when API requests are done before the
 * proxy <iframe> is "loaded", and fulfilled once the "load" DOM event on the
 * iframe occurs.
 */
var buffered = void 0;

/**
 * Firefox apparently doesn't like sending `File` instances cross-domain.
 * It results in a "DataCloneError: The object could not be cloned." error.
 * Apparently this is for "security purposes" but it's actually silly if that's
 * the argument because we can just read the File manually into an ArrayBuffer
 * and we can work around this "security restriction".
 *
 * See: https://bugzilla.mozilla.org/show_bug.cgi?id=722126#c8
 */
var hasFileSerializationBug = false;

/**
 * In-flight API request XMLHttpRequest dummy "proxy" instances.
 */
var requests = {};

/**
 * Are HTML5 XMLHttpRequest2 "progress" events supported?
 * See: http://goo.gl/xxYf6D
 */
var supportsProgress = !!window.ProgressEvent && !!window.FormData;

debug('using "origin": %o', origin);

/**
 * Performs a "proxied REST API request". This happens by calling
 * `iframe.postMessage()` on the proxy iframe instance, which from there
 * takes care of WordPress.com user authentication (via the currently
 * logged-in user's cookies).
 *
 * @param {Object|String} originalParams - request parameters
 * @param {Function} [fn] - callback response
 * @return {XMLHttpRequest} XMLHttpRequest instance
 * @api public
 */
var request = function request(originalParams, fn) {
	var params = (0, _assign2.default)({}, originalParams);

	debug('request(%o)', params);

	// inject the <iframe> upon the first proxied API request
	if (!iframe) {
		install();
	}

	if ('string' === typeof params) {
		params = { path: params };
	}

	// generate a uid for this API request
	var id = (0, _uid2.default)();
	params.callback = id;
	params.supports_args = true; // supports receiving variable amount of arguments
	params.supports_error_obj = true; // better Error object info
	params.supports_progress = supportsProgress; // supports receiving XHR "progress" events

	// force uppercase "method" since that's what the <iframe> is expecting
	params.method = String(params.method || 'GET').toUpperCase();

	debug('params object: %o', params);

	var xhr = new XMLHttpRequest();
	xhr.params = params;

	// store the `XMLHttpRequest` instance so that "onmessage" can access it again
	requests[id] = xhr;

	if ('function' === typeof fn) {
		var xhrOnLoad = function xhrOnLoad(e) {
			if (called) {
				return;
			}

			called = true;
			var body = e.response || xhr.response;
			debug('body: ', body);
			debug('headers: ', e.headers);
			fn(null, body, e.headers);
		};

		var xhrOnError = function xhrOnError(e) {
			if (called) {
				return;
			}

			called = true;
			var error = e.error || e.err || e;
			debug('error: ', error);
			debug('headers: ', e.headers);
			fn(error, null, e.headers);
		};

		// a callback function was provided
		var called = false;


		_componentEvent2.default.bind(xhr, 'load', xhrOnLoad);
		_componentEvent2.default.bind(xhr, 'abort', xhrOnError);
		_componentEvent2.default.bind(xhr, 'error', xhrOnError);
	}

	if (loaded) {
		submitRequest(params);
	} else {
		debug('buffering API request since proxying <iframe> is not yet loaded');
		buffered.push(params);
	}

	return xhr;
};

/**
 * Calls the `postMessage()` function on the <iframe>.
 *
 * @param {Object} params
 * @api private
 */

function submitRequest(params) {
	debug('sending API request to proxy <iframe> %o', params);

	if (hasFileSerializationBug && hasFile(params)) {
		postAsArrayBuffer(params);
	} else {
		try {
			iframe.contentWindow.postMessage(postStrings ? (0, _stringify2.default)(params) : params, proxyOrigin);
		} catch (e) {
			// were we trying to serialize a `File`?
			if (hasFile(params)) {
				debug('this browser has the File serialization bug');
				// cache this check for the next API request
				hasFileSerializationBug = true;
				postAsArrayBuffer(params);
			} else {
				// not interested, rethrow
				throw e;
			}
		}
	}
}

/**
 * Returns `true` if there's a `File` instance in the `params`, or `false`
 * otherwise.
 *
 * @param {Object} params - request parameter
 * @return {Boolean} `true` if there's a `File`
 * @private
 */
function hasFile(params) {
	var formData = params.formData;
	if (formData && formData.length > 0) {
		for (var i = 0; i < formData.length; i++) {
			if (isFile(formData[i][1])) {
				return true;
			}
		}
	}
	return false;
}

/**
 * Returns `true` if `v` is a DOM File instance, `false` otherwise.
 *
 * @param {Mixed} v - instance to analize
 * @return {Boolean} `true` if `v` is a DOM File instance
 * @private
 */
function isFile(v) {
	return v && Object.prototype.toString.call(v) === '[object File]';
}

/**
 * Turns all `File` instances into `ArrayBuffer` objects in order to serialize
 * the data over the iframe `postMessage()` call.
 *
 * @param {Object} params
 * @private
 */

function postAsArrayBuffer(params) {
	debug('converting File instances to ArrayBuffer before invoking postMessage()');

	var formData = params.formData;
	var count = 0;
	var called = false;
	for (var i = 0; i < formData.length; i++) {
		var val = formData[i][1];
		if (isFile(val)) {
			count++;
			fileToArrayBuffer(val, i, onLoadFile);
		}
	}

	if (0 === count) {
		postMessage();
	}

	function onLoadFile(err, file, j) {
		if (called) {
			return;
		}

		if (err) {
			called = true;
			reject(err);
			return;
		}

		formData[j][1] = file;

		count--;
		if (0 === count) {
			postMessage();
		}
	}

	function postMessage() {
		debug('finished reading all Files');
		iframe.contentWindow.postMessage(params, proxyOrigin);
	}
}

/**
 * Turns a `File` instance into a regular JavaScript object with `fileContents`
 * as an ArrayBuffer, and `fileName` and `mimeTypes`.
 *
 * @param {File} file
 * @param {Number} index
 * @param {Function} fn
 * @private
 */

function fileToArrayBuffer(file, index, fn) {
	var reader = new FileReader();

	reader.onload = function (e) {
		var arrayBuffer = e.target.result;
		debug('finished reading file %o (%o bytes)', file.name, arrayBuffer.byteLength);

		fn(null, {
			fileContents: arrayBuffer,
			fileName: file.name,
			mimeType: file.type
		}, index);
	};

	reader.onerror = function (err) {
		debug('got error reading file %o (%o bytes)', file.name, err);
		fn(err);
	};

	reader.readAsArrayBuffer(file);
}

/**
 * Injects the proxy <iframe> instance in the <body> of the current
 * HTML page.
 *
 * @api private
 */

function install() {
	debug('install()');
	if (iframe) {
		uninstall();
	}

	buffered = [];

	// listen to messages sent to `window`
	_componentEvent2.default.bind(window, 'message', onmessage);

	// create the <iframe>
	iframe = document.createElement('iframe');

	// set `src` and hide the iframe
	iframe.src = proxyOrigin + '/wp-admin/rest-proxy/#' + origin;
	iframe.style.display = 'none';

	// inject the <iframe> into the <body>
	document.body.appendChild(iframe);
}

/**
 * Reloads the proxy iframe.
 *
 * @api public
 */
var reloadProxy = function reloadProxy() {
	install();
};

/**
 * Removes the <iframe> proxy instance from the <body> of the page.
 *
 * @api private
 */
function uninstall() {
	debug('uninstall()');
	document.body.removeChild(iframe);
	loaded = false;
	iframe = null;
}

/**
 * The proxy <iframe> instance's "load" event callback function.
 *
 * @api private
 */

function onload() {
	debug('proxy <iframe> "load" event');
	loaded = true;

	// flush any buffered API calls
	if (buffered) {
		for (var i = 0; i < buffered.length; i++) {
			submitRequest(buffered[i]);
		}
		buffered = null;
	}
}

/**
 * The main `window` object's "message" event callback function.
 *
 * @param {Event} e
 * @api private
 */

function onmessage(e) {
	debug('onmessage');

	// safeguard...
	if (e.origin !== proxyOrigin) {
		debug('ignoring message... %o !== %o', e.origin, proxyOrigin);
		return;
	}

	var data = e.data;

	if (!data) {
		return debug('no `data`, bailing');
	}

	// Once the iframe is loaded, we can start using it.
	if (data === '["ready",200,null]') {
		onload();
		return;
	}

	if (postStrings && 'string' === typeof data) {
		data = JSON.parse(data);
	}

	// check if we're receiving a "progress" event
	if (data.upload || data.download) {
		return onprogress(data);
	}

	if (!data.length) {
		return debug('`e.data` doesn\'t appear to be an Array, bailing...');
	}

	// first get the `xhr` instance that we're interested in
	var id = data[data.length - 1];
	if (!(id in requests)) {
		return debug('bailing, no matching request with callback: %o', id);
	}

	var xhr = requests[id];

	// Build `error` and `body` object from the `data` object
	var params = xhr.params;

	var body = void 0,
	    statusCode = void 0,
	    headers = void 0;

	// apiNamespace (WP-API)
	var apiNamespace = params.apiNamespace;

	// is REST-API api?

	var isRestAPI = apiNamespace === undefined;

	if (isRestAPI) {
		debug('REST-API detected');
		body = data[0];
		statusCode = data[1];
		headers = data[2];
	} else {
		debug('WP-API detected');
		body = data[0];
		headers = data[2];

		// Identify error response in `envelope` mode in function of the response fields
		// and try to make the same error structure for both APIs
		if (body.code && body.data && body.data.status && body.message) {
			body.error = body.code;
			statusCode = body.data.status;
			delete body.code;
			delete body.data;
		}
	}

	if (statusCode === 207) {
		// 207 is a signal from rest-proxy. It means, "this isn't the final
		// response to the query." The proxy supports WebSocket connections
		// by invoking the original success callback for each message received.
	} else {
		// this is the final response to this query
		delete requests[id];
	}

	if (!params.metaAPI) {
		debug('got %o status code for URL: %o', statusCode, params.path);
	} else {
		statusCode = body === 'metaAPIupdated' ? 200 : 500;
	}

	// add statusCode into headers object
	if ((typeof headers === 'undefined' ? 'undefined' : (0, _typeof3.default)(headers)) === 'object') {
		headers.status = statusCode;
	}

	if (null == statusCode || 2 === Math.floor(statusCode / 100)) {
		// 2xx status code, success
		resolve(xhr, body, headers);
	} else {
		// any other status code is a failure
		var wpe = (0, _wpError2.default)(params, statusCode, body);
		reject(xhr, wpe, headers);
	}
}

/**
 * Handles a "progress" event being proxied back from the iframe page.
 *
 * @param {Object} data
 * @private
 */

function onprogress(data) {
	debug('got "progress" event: %o', data);
	var xhr = requests[data.callbackId];
	if (xhr) {
		var prog = new _progressEvent2.default('progress', data);
		var target = data.upload ? xhr.upload : xhr;
		target.dispatchEvent(prog);
	}
}

/**
 * Emits the "load" event on the `xhr`.
 *
 * @param {XMLHttpRequest} xhr
 * @param {Object} body
 * @private
 */

function resolve(xhr, body, headers) {
	var e = new _progressEvent2.default('load');
	e.data = e.body = e.response = body;
	e.headers = headers;
	xhr.dispatchEvent(e);
}

/**
 * Emits the "error" event on the `xhr`.
 *
 * @param {XMLHttpRequest} xhr
 * @param {Error} err
 * @private
 */

function reject(xhr, err, headers) {
	var e = new _progressEvent2.default('error');
	e.error = e.err = err;
	e.headers = headers;
	xhr.dispatchEvent(e);
}

/**
 * Export `request` function.
 */
exports.default = request;
exports.reloadProxy = reloadProxy;

//# sourceMappingURL=index.js.map