var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

/**
 * Module dependencies.
 */

var _uid = require('uid');

var _uid2 = _interopRequireDefault(_uid);

var _componentEvent = require('component-event');

var _componentEvent2 = _interopRequireDefault(_componentEvent);

var _progressEvent = require('progress-event');

var _progressEvent2 = _interopRequireDefault(_progressEvent);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var debug = (0, _debug2['default'])('wpcom-proxy-request');

// WordPress.com REST API base endpoint.
var proxyOrigin = 'https://public-api.wordpress.com';

// "Origin" of the current HTML page.
var origin = window.location.protocol + '//' + window.location.host;
debug('using "origin": %o', origin);

/**
 * Detecting support for the structured clone algorithm. IE8 and 9, and Firefox
 * 6.0 and below only support strings as postMessage's message. This browsers
 * will try to use the toString method.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 * https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/The_structured_clone_algorithm
 * https://github.com/Modernizr/Modernizr/issues/388#issuecomment-31127462
 */
var postStrings = (function () {
	var r = false;
	try {
		window.postMessage({
			toString: function toString() {
				r = true;
			}
		}, '*');
	} catch (err) {
		// silence error
	}

	return r;
})();

// Reference to the <iframe> DOM element.
// Gets set in the install() function.
var iframe = undefined;

// Set to `true` upon the iframe's "load" event.
var loaded = false;

// Array of buffered API requests. Added to when API requests are done before the
// proxy <iframe> is "loaded", and fulfilled once the "load" DOM event on the
// iframe occurs.
var buffered = undefined;

// Firefox apparently doesn't like sending `File` instances cross-domain.
// It results in a "DataCloneError: The object could not be cloned." error.
// Apparently this is for "security purposes" but it's actually silly if that's
// the argument because we can just read the File manually into an ArrayBuffer
// and we can work around this "security restriction".

// See: https://bugzilla.mozilla.org/show_bug.cgi?id=722126#c8
var hasFileSerializationBug = false;

// In-flight API request XMLHttpRequest dummy "proxy" instances.
var requests = {};

// Are HTML5 XMLHttpRequest2 "progress" events supported?
// See: http://goo.gl/xxYf6D
var supportsProgress = !!window.ProgressEvent && !!window.FormData;

/**
 * Returns `true` if `v` is a DOM File instance, `false` otherwise.
 *
 * @param {Mixed} v - instance to check
 * @return {Boolean} is a DOM File instance?
 * @private
 */
var isFile = function isFile(v) {
	return v && Object.prototype.toString.call(v) === '[object File]';
};

/**
 * Returns `true` if there's a `File` instance in the `params`, or `false`
 * otherwise.
 *
 * @param {Object} params - request parameters
 * @return {Boolean} is a `File` instance?
 * @private
 */
var hasFile = function hasFile(params) {
	var formData = params.formData;

	if (formData && formData.length > 0) {
		for (var i = 0; i < formData.length; i++) {
			if (isFile(formData[i][1])) {
				return true;
			}
		}
	}

	return false;
};

/**
 * Turns a `File` instance into a regular JavaScript object with `fileContents`
 * as an ArrayBuffer, and `fileName` and `mimeTypes`.
 *
 * @param {File} file - file
 * @param {Number} index - index
 * @param {Function} fn - callback
 * @private
 */
var fileToArrayBuffer = function fileToArrayBuffer(file, index, fn) {
	var reader = new FileReader();
	reader.onload = function (e) {
		var arrayBuffer = e.target.result;
		debug('finished reading file %o (%o bytes )', file.name, arrayBuffer.byteLength);
		fn(null, {
			fileContents: arrayBuffer,
			fileName: file.name,
			mimeType: file.type
		}, index);
	};

	reader.onError = function (err) {
		debug('got error reading file %o (%o bytes )', file.name, err);
		fn(err);
	};

	reader.readAsArrayBuffer(file);
};

/**
 * Emits the "load" event on the `xhr`.
 *
 * @param {XMLHttpRequest} xhr - XMLHttpRequest instance
 * @param {Object} body - response body
 * @private
 */
var resolve = function resolve(xhr, body) {
	var e = new _progressEvent2['default']('load');
	e.data = e.body = e.response = body;
	xhr.dispatchEvent(e);
};

/**
 * Emits the "error" event on the `xhr`.
 *
 * @param {XMLHttpRequest} xhr - XMLHttpRequest instance
 * @param {Error} err - response error object
 * @private
 */
var reject = function reject(xhr, err) {
	var e = new _progressEvent2['default']('error');
	e.error = e.err = err;
	xhr.dispatchEvent(e);
};

var toTitle = function toTitle(str) {
	if (!str || 'string' !== typeof str) {
		return '';
	}

	return str.replace(/((^|_)[a-z])/g, function ($1) {
		return $1.toUpperCase().replace('_', '');
	});
};

/**
 * Turns all `File` instances into `ArrayBuffer` objects in order to serialize
 * the data over the iframe `postMessage()` call.
 *
 * @param {Object} params - request parameters
 * @private
*/
var postAsArrayBuffer = function postAsArrayBuffer(params) {
	debug('converting File instances to ArrayBuffer before invoking postMessage()');

	var count = 0;
	var called = false;
	var formData = params.formData;

	function postMessage() {
		debug('finished reading all Files');
		iframe.contentWindow.postMessage(params, proxyOrigin);
	}

	function onLoad(err, file, i) {
		if (called) return;

		if (err) {
			called = true;
			reject(err);
			return;
		}

		formData[i][1] = file;

		count--;
		if (0 === count) {
			postMessage();
		}
	}

	for (var i = 0; i < formData.length; i++) {
		var val = formData[i][1];
		if (isFile(val)) {
			count++;
			fileToArrayBuffer(val, i, onLoad);
		}
	}

	if (0 === count) {
		postMessage();
	}
};

/**
 * Calls the `postMessage()` function on the <iframe>.
 *
 * @param {Object} params - request parameters
 * @api private
 */
var submitRequest = function submitRequest(params) {
	debug('sending API request to proxy <iframe> %o', params);

	if (hasFileSerializationBug && hasFile(params)) {
		postAsArrayBuffer(params);
	} else {
		try {
			params = postStrings ? JSON.stringify(params) : params, params.success = true;

			iframe.contentWindow.postMessage(params, proxyOrigin);
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
};

/**
 * The proxy <iframe> instance's "load" event callback function.
 *
 * @api private
 */
var onload = function onload() {
	debug('proxy <iframe> "load" event');
	loaded = true;

	// flush any buffered API calls
	if (buffered) {
		for (var i = 0; i < buffered.length; i++) {
			submitRequest(buffered[i]);
		}

		buffered = null;
	}
};

/**
 * Handles a "progress" event being proxied back from the iframe page.
 *
 * @param {Object} data - gotten data
 * @private
 */
var onprogress = function onprogress(data) {
	debug('got "progress" event: %o', data);
	var xhr = requests[data.callbackId];
	if (xhr) {
		var prog = new _progressEvent2['default']('progress', data);
		var target = data.upload ? xhr.upload : xhr;
		target.dispatchEvent(prog);
	}
};

/**
 * The main `window` object's "message" event callback function.
 *
 * @param {MessageEvent} messageEv - MessageEvent instance
 * @return {Null} null
 * @api private
 */
var onmessage = function onmessage(messageEv) {
	// safeguard...
	if (messageEv.origin !== proxyOrigin) {
		debug('ignoring message... %o !== %o', messageEv.origin, proxyOrigin);
		return;
	}

	var data = messageEv.data;

	if (!data) {
		return debug('no `data`, bailing');
	}

	if (postStrings && 'string' === typeof data) {
		data = JSON.parse(data);
	}

	// check if we're receiving a "progress" messageEv
	if (data.upload || data.download) {
		return onprogress(data);
	}

	if (!data.length) {
		return debug('`messageEv.data` doesn\'t appear to be an Array, bailing...');
	}

	// first get the `xhr` instance that we're interested in
	var id = data[data.length - 1];
	if (!(id in requests)) {
		return debug('bailing, no matching request with callback: %o', id);
	}

	var xhr = requests[id];
	delete requests[id];

	var body = data[0];
	var statusCode = data[1];
	var headers = data[2];

	if (!xhr.params.metaAPI) {
		debug('got %o status code for URL: %o', statusCode, xhr.params.path);
	}

	if (body && headers) {
		body._headers = headers;
	}

	if (null == statusCode || 2 === Math.floor(statusCode / 100)) {
		// 2xx status code, success
		resolve(xhr, body);
	} else {
		// any other status code is a failure
		var err = new Error();
		err.statusCode = statusCode;
		for (var i in body) {
			err[i] = body[i];
		}

		if (body.error) {
			err.name = toTitle(body.error) + 'Error';
		}

		reject(xhr, err);
	}
};

/**
 * Injects the proxy <iframe> instance in the <body> of the current
 * HTML page.
 *
 * @api private
 */
var install = function install() {
	debug('install()');
	if (iframe) {
		// @TODO remove it ?
		//uninstall();
	}

	buffered = [];

	// listen to messages sent to `window`
	_componentEvent2['default'].bind(window, 'message', onmessage);

	// create the <iframe>
	iframe = document.createElement('iframe');

	// set `loaded` to true once the "load" event happens
	_componentEvent2['default'].bind(iframe, 'load', onload);

	// set `src` and hide the iframe
	iframe.src = proxyOrigin + '/wp-admin/rest-proxy/#' + origin;

	iframe.style.display = 'none';

	// inject the <iframe> into the <body>
	document.body.appendChild(iframe);
};

/**
 * Performs a "proxied REST API request". This happens by calling
 * `iframe.postMessage()` on the proxy iframe instance, which from there
 * takes care of WordPress.com user authentication ( via the currently
 * logged-in user's cookies ).
 *
 * @param {Object|String} params - request parameters
 * @param {Function} [fn] - response callback
 * @return {XMLHttpRequest} xhr instance
 * @api public
 */
var request = function request(params, fn) {
	debug('request(%o )', params);

	if ('string' === typeof params) {
		params = { path: params };
	}

	// inject the <iframe> upon the first proxied API request
	if (!iframe) {
		install();
	}

	// generate a uid for this API request
	var id = (0, _uid2['default'])();
	params.callback = id;
	params.supports_args = true; // supports receiving variable amount of arguments
	params.supports_progress = supportsProgress; // supports receiving XHR "progress" events

	// force uppercase "method" since that's what the <iframe> is expecting
	params.method = String(params.method || 'GET').toUpperCase();

	debug('params object: %o', params);

	var xhr = new XMLHttpRequest();
	xhr.params = params;

	// store the `XMLHttpRequest` instance so that "onmessage" can access it again
	requests[id] = xhr;

	if ('function' === typeof fn) {
		(function () {
			// a callback function was provided
			var called = false;

			var _onLoad = function _onLoad(err) {
				if (called) return;

				called = true;
				fn(null, err.response || xhr.response);
			};

			var onError = function onError(err) {
				if (called) return;
				called = true;
				fn(err.error || err.err || err);
			};

			_componentEvent2['default'].bind(xhr, 'load', _onLoad);
			_componentEvent2['default'].bind(xhr, 'abort', onError);
			_componentEvent2['default'].bind(xhr, 'error', onError);
		})();
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
 * Export `request` function.
 */
module.exports = request;
