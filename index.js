
/**
 * Module dependencies.
 */

var event = require('event');

/**
 * WordPress.com REST API base endpoint.
 */

var proxyOrigin = 'https://public-api.wordpress.com';

/**
 * Reference to the <iframe> DOM element.
 * Gets set in the install() function.
 */

var iframe;

module.exports = request;

/**
 * Performs a "proxied REST API request". This happens by calling
 * `iframe.postMessage()` on the proxy iframe instance, which from there
 * takes care of WordPress.com user authentication (via the currently
 * logged user's cookies).
 *
 * @param {Object|String} params
 * @param {Function} fn callback function
 * @api public
 */

function request (params, fn) {
  if ('string' == typeof params) {
    params = { path: params };
  }

  // inject the <iframe> upon the first proxied API request
  if (!iframe) install();
}

/**
 * Injects the proxy <iframe> instance in the <body> of the current
 * HTML page.
 *
 * @api private
 */

function install () {
}
