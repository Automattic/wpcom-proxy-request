'use strict';

var _chai = require('chai');

var _ = require('../');

var _2 = _interopRequireDefault(_);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Expose proxy for development purpose
 */
/* eslint-disable no-console */

/**
 * External dependencies
 */
window.proxy = _2.default;

/**
 * Internal dependencies
 */


var runs = [{ shouldReloadProxy: false }, { shouldReloadProxy: true }];

runs.forEach(function (_ref) {
	var shouldReloadProxy = _ref.shouldReloadProxy;

	var description = '';
	if (shouldReloadProxy) {
		description = ' (after proxy has been reloaded)';
	}
	describe('wpcom-proxy-request' + description, function () {
		var siteDomain = 'en.blog.wordpress.com';
		var siteId = 3584907;
		var postId = 35600;

		// run the proxy
		before(function (done) {
			if (shouldReloadProxy) {
				(0, _.reloadProxy)();
			}
			(0, _2.default)({ metaAPI: { accessAllUsersBlogs: true } }, function (err) {
				if (err) {
					throw err;
				}

				if (shouldReloadProxy) {
					console.log('proxy reloaded');
				}
				console.log('proxy now running in "access all user\'s blogs" mode');
				done();
			});
		});

		describe('REST-API', function () {
			var apiVersion = '1';

			describe('v1', function () {
				describe('successful requests', function () {
					it('[v1] should get `WordPress` blog post info', function (done) {
						(0, _2.default)({
							path: '/sites/' + siteDomain + '/posts/' + postId,
							apiVersion: apiVersion
						}, function (error, body, headers) {
							// error
							(0, _chai.expect)(error).to.be.an('null');

							// body
							(0, _chai.expect)(body).to.be.ok;
							(0, _chai.expect)(body.ID).to.be.a('number');
							(0, _chai.expect)(body.ID).to.be.equal(postId);
							(0, _chai.expect)(body.site_ID).to.be.a('number');
							(0, _chai.expect)(body.site_ID).to.be.equal(siteId);

							// headers
							(0, _chai.expect)(headers).to.be.ok;
							(0, _chai.expect)(headers.status).to.be.equal(200);

							done();
						});
					});

					it('[v1] should get `me` user', function (done) {
						(0, _2.default)({
							path: '/me',
							apiVersion: apiVersion
						}, function (error, body, headers) {
							// error
							(0, _chai.expect)(error).to.be.an('null');

							// body
							(0, _chai.expect)(body.ID).to.be.ok;
							(0, _chai.expect)(body.ID).to.be.a('number');
							(0, _chai.expect)(body.username).to.be.ok;

							// headers
							(0, _chai.expect)(headers).to.be.ok;

							done();
						});
					});
				});

				describe('wrong requests', function () {
					it('[v1] should get `404` for a non-exiting route', function (done) {
						(0, _2.default)({
							path: '/this-route-does-not-exists'
						}, function (error, body, headers) {
							(0, _chai.expect)(error).to.be.ok;
							(0, _chai.expect)(error.name).to.be.equal('NotFoundError');
							(0, _chai.expect)(error.message).to.be.ok;
							(0, _chai.expect)(error.statusCode).to.be.equal(404);

							// error
							(0, _chai.expect)(error).to.be.ok;

							// body
							(0, _chai.expect)(body).to.be.not.ok;

							// headers
							(0, _chai.expect)(headers).to.be.ok;
							(0, _chai.expect)(headers.status).to.be.equal(404);

							done();
						});
					});

					it('[v1] should get `404` for a non-exiting site', function (done) {
						(0, _2.default)({
							path: '/sites/this-site-does-not-exit-i-hope',
							apiVersion: apiVersion
						}, function (error, body, headers) {
							// error
							(0, _chai.expect)(error).to.be.ok;
							(0, _chai.expect)(error.name).to.be.equal('UnknownBlogError');
							(0, _chai.expect)(error.message).to.be.ok;
							(0, _chai.expect)(error.statusCode).to.be.equal(404);

							// body
							(0, _chai.expect)(body).to.be.not.ok;

							// headers
							(0, _chai.expect)(headers).to.be.ok;
							(0, _chai.expect)(headers.status).to.be.equal(404);

							done();
						});
					});

					it('[v1] should get `404` for a non-exiting post', function (done) {
						(0, _2.default)({
							path: '/sites/' + siteDomain + '/posts/0',
							apiVersion: apiVersion
						}, function (error, body, headers) {
							// error
							(0, _chai.expect)(error).to.be.ok;
							(0, _chai.expect)(error.name).to.be.equal('UnknownPostError');
							(0, _chai.expect)(error.message).to.be.ok;
							(0, _chai.expect)(error.statusCode).to.be.equal(404);

							// body
							(0, _chai.expect)(body).to.be.not.ok;

							// headers
							(0, _chai.expect)(headers).to.be.ok;
							(0, _chai.expect)(headers.status).to.be.equal(404);

							done();
						});
					});
				});
			});
		});

		describe('WP-API', function () {
			describe('wp/v2', function () {
				var namespace = 'wp/v2';

				describe('successful requests', function () {
					it('[wp/v2] should get `me` user', function (done) {
						(0, _2.default)({
							path: '/sites/' + siteDomain + '/users/me',
							apiNamespace: namespace
						}, function (error, body, headers) {
							// error
							(0, _chai.expect)(error).to.be.an('null');

							// body
							(0, _chai.expect)(body.name).to.be.ok;
							(0, _chai.expect)(body.link).to.be.ok;

							// headers
							(0, _chai.expect)(headers).to.be.ok;

							done();
						});
					});
				});

				describe('wrong requests', function () {
					it('[wp/v2] should get `404` for a non-exiting route', function (done) {
						(0, _2.default)({
							path: '/this-route-does-not-exists',
							apiNamespace: namespace
						}, function (error, body, headers) {
							// error
							(0, _chai.expect)(error).to.be.ok;
							(0, _chai.expect)(error.name).to.be.equal('RestNoRouteError');
							(0, _chai.expect)(error.statusCode).to.be.equal(404);
							(0, _chai.expect)(error.message).to.be.equal('No route was found matching the URL and request method');

							// body
							(0, _chai.expect)(body).to.be.not.ok;

							// headers
							(0, _chai.expect)(headers).to.be.ok;
							(0, _chai.expect)(headers.status).to.be.equal(404);

							done();
						});
					});

					it('[wp/v2] should get `404` a non-existing post', function (done) {
						(0, _2.default)({
							path: '/sites/retrofocs.wordpress.com/posts/0',
							apiNamespace: namespace
						}, function (error, body, headers) {
							// error
							(0, _chai.expect)(error).to.be.ok;
							(0, _chai.expect)(error.name).to.be.equal('RestPostInvalidIdError');
							(0, _chai.expect)(error.statusCode).to.be.equal(404);
							(0, _chai.expect)(error.message).to.be.equal('Invalid post ID.');

							// body
							(0, _chai.expect)(body).to.be.not.ok;

							// headers
							(0, _chai.expect)(headers).to.be.ok;
							(0, _chai.expect)(headers.status).to.be.equal(404);

							done();
						});
					});
				});
			});

			describe('wpcom/v2', function () {
				var namespace = 'wpcom/v2';

				describe('successful requests', function () {
					it('[wpcom/v2] should get timezones list', function (done) {
						(0, _2.default)({
							path: '/timezones',
							apiNamespace: namespace
						}, function (error, body) {
							// error
							(0, _chai.expect)(error).to.be.an('null');

							// body
							(0, _chai.expect)(body.found).to.be.ok;
							(0, _chai.expect)(body.timezones).to.be.an('array');

							done();
						});
					});
				});

				describe('wrong requests', function () {
					it('[wpcom/v2] should get `404` for a non-exiting route', function (done) {
						(0, _2.default)({
							path: '/this-route-does-not-exists',
							apiNamespace: namespace
						}, function (error, body, headers) {
							// error
							(0, _chai.expect)(error).to.be.ok;
							(0, _chai.expect)(error.name).to.be.equal('RestNoRouteError');
							(0, _chai.expect)(error.statusCode).to.be.equal(404);
							(0, _chai.expect)(error.message).to.be.equal('No route was found matching the URL and request method');

							// body
							(0, _chai.expect)(body).to.be.not.ok;

							// headers
							(0, _chai.expect)(headers).to.be.ok;
							(0, _chai.expect)(headers.status).to.be.equal(404);

							done();
						});
					});
				});
			});
		});
	});
});

//# sourceMappingURL=index.js.map