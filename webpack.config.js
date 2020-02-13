const path = require('path');

const solclientjs = path.resolve(__dirname, 'node_modules/solclientjs/lib/solclientjs.js');

module.exports = {
    resolve: {
        alias: {
          solclientjs$: solclientjs
        }
    },
    entry: [
      'regenerator-runtime/runtime',
      './src/index.js'
    ],
    target: 'node',
    devtool: 'source-map',
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: 'bundle.js',
        publicPath: 'build/'
    },
    module: {
        rules: [
            {
                use: 'babel-loader',
                exclude: /(node_modules)/,
                test: /\.js$/
            }
        ]
    }
}
