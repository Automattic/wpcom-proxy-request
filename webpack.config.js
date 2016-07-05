module.exports = {
	entry: __dirname + '/build/index.js',

	node: {
		fs: 'empty'
	},

	output: {
		path: __dirname + '/dist/',
		filename: 'wpcom-proxy-request.js',
		libraryTarget: 'var',
		library: 'WPComProxyRequest'
	},

	resolve: {
		extensions: [ '', '.js' ]
	},

	devtool: 'sourcemap'
};
