module.exports = {
	entry: __dirname + '/index.js',

	output: {
		path: __dirname + '/dist',
		filename: 'wpcom-proxy-request.js',
		libraryTarget: 'var',
		library: 'wpcomProxyRequest'
	},

	module: {
		loaders: [
			{
				test: /\.js$/,
				exclude: /node_modules/,
				loader: 'babel-loader',
				query: {
					cacheDirectory: true,
					optional: [ 'runtime' ]
				}
			}
		]
	},

	resolve: {
		extensions: [ '', '.js' ]
	},

	devtool: 'sourcemap'
};
