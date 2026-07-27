/** 资产编号 / 序列号 / 库位：英文大写 + 数字 + 常用分隔符 */
export function normalizeCodeField(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9\-/.]/g, '')
}

/** 查询关键字：仅将小写字母转大写，保留中文等字符供名称搜索 */
export function normalizeSearchKeyword(value: string): string {
  return value.replace(/[a-z]/g, (ch) => ch.toUpperCase())
}
