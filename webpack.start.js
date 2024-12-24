
const path = require('path')

module.exports = {
  mode: 'none',
  // 不设置入口文件会导致一些无关紧要的报错
  devServer: {
    static: {
      directory: path.join(__dirname, '/resource/vditor/'),
    },
    port: 9000,
    host: '0.0.0.0',
    open: true,
  },
}
