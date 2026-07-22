import { ElMessage, ElMessageBox } from 'element-plus'
import type { ImportResult } from '@/types/api'

export function showImportResult(res: ImportResult, reload?: () => void) {
  ElMessage.success(`导入完成：成功 ${res.successCount} 条，失败 ${res.failCount} 条`)
  if (res.errors.length > 0) {
    const detail = res.errors.map((e) => `第 ${e.row} 行：${e.reason}`).join('\n')
    ElMessageBox.alert(detail, '导入失败明细', { type: 'warning' })
  }
  reload?.()
}

export async function runImport(
  importFn: () => Promise<ImportResult>,
  reload?: () => void,
): Promise<void> {
  try {
    const res = await importFn()
    showImportResult(res, reload)
  } catch (e) {
    if (e instanceof Error && e.message !== '已取消') {
      ElMessage.error(e.message)
    }
  }
}
