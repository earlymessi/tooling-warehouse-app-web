export function getApi() {
  if (!window.api) {
    throw new Error('请在 Electron 应用中运行，不要直接在浏览器打开 localhost 地址')
  }
  return window.api
}
