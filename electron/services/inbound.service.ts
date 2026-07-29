import path from 'node:path'
import { app } from 'electron'
import * as XLSX from 'xlsx'
import type Database from 'better-sqlite3'
import type {
  BatchInboundError,
  BatchInboundInput,
  BatchInboundResult,
  InboundToolItem,
} from '../../src/types/inbound'
import * as toolRepo from '../db/tool.repository'
import * as inboundRepo from '../db/inbound.repository'
import { formatNow } from './time'

export class BatchInboundValidationError extends Error {
  errors: BatchInboundError[]
  constructor(errors: BatchInboundError[]) {
    super(`BATCH_INBOUND_INVALID: ${JSON.stringify(errors)}`)
    this.name = 'BatchInboundValidationError'
    this.errors = errors
  }
}

function validateItems(db: Database.Database, items: InboundToolItem[]): BatchInboundError[] {
  const errors: BatchInboundError[] = []
  const codeSet = new Set<string>()

  items.forEach((item, index) => {
    const tool_code = item.tool_code?.trim() ?? ''
    const tool_name = item.tool_name?.trim() ?? ''
    const serial_no = item.serial_no?.trim() ?? ''
    const work_center = item.work_center?.trim() ?? ''
    const location_code = item.location_code?.trim() ?? ''
    const specification = item.specification?.trim() ?? ''

    if (!tool_code) {
      errors.push({ index, tool_code: '', reason: '资产编号不能为空' })
      return
    }
    if (codeSet.has(tool_code)) {
      errors.push({ index, tool_code, reason: '本批次内资产编号重复' })
    } else {
      codeSet.add(tool_code)
    }
    if (toolRepo.findByCode(db, tool_code)) {
      errors.push({ index, tool_code, reason: '资产编号已存在' })
    }
    if (!tool_name) errors.push({ index, tool_code, reason: '名称不能为空' })
    if (!serial_no) errors.push({ index, tool_code, reason: '序列号不能为空' })
    if (!work_center) errors.push({ index, tool_code, reason: '工作中心不能为空' })
    if (!location_code) errors.push({ index, tool_code, reason: '库位不能为空' })
    // 型号允许空？用户没说必填，允许空
    void specification
  })

  return errors
}

/** 导出打印标签表：列保持原样，格式改为 xlsx */
function writeLabelXlsx(items: InboundToolItem[], inboundNo: string): string {
  const desktop = app.getPath('desktop')
  const stamp = formatNow().replace(/[:T]/g, '-').slice(0, 19)
  const filePath = path.join(desktop, `工装标签-${inboundNo}-${stamp}.xlsx`)
  const rows = [
    ['资产编号', '名称', '型号', '序列号', '工作中心'],
    ...items.map((item) => [
      item.tool_code,
      item.tool_name,
      item.specification ?? '',
      item.serial_no,
      item.work_center,
    ]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '工装标签')
  XLSX.writeFile(wb, filePath)
  return filePath
}

/** 自助入库：整批校验，失败全部不写入并返回原因；成功则事务写入台账+入库记录，并导出标签 xlsx 到桌面 */
export function batchInbound(db: Database.Database, input: BatchInboundInput): BatchInboundResult {
  const operator = input.operator_name?.trim() ?? ''
  if (!operator) throw new Error('OPERATOR_REQUIRED: 入库人不能为空')
  if (!input.items?.length) throw new Error('ITEMS_REQUIRED: 请至少添加一件工装')

  const normalized: InboundToolItem[] = input.items.map((item) => ({
    tool_code: item.tool_code.trim(),
    tool_name: item.tool_name.trim(),
    specification: (item.specification ?? '').trim(),
    serial_no: item.serial_no.trim(),
    work_center: item.work_center.trim(),
    location_code: item.location_code.trim(),
  }))

  const errors = validateItems(db, normalized)
  if (errors.length > 0) throw new BatchInboundValidationError(errors)

  const nowDate = new Date()
  const now = formatNow(nowDate)
  const inbound_no = inboundRepo.generateInboundNo(db, nowDate)

  const tx = db.transaction(() => {
    for (const item of normalized) {
      const tool = toolRepo.insert(db, {
        tool_code: item.tool_code,
        tool_name: item.tool_name,
        specification: item.specification || undefined,
        serial_no: item.serial_no,
        work_center: item.work_center,
        location_code: item.location_code,
        quantity: 1,
        unit: '件',
        status: '在库',
        qr_content: item.tool_code,
        created_at: now,
        updated_at: now,
      })
      inboundRepo.insert(db, {
        inbound_no,
        tool_id: tool.id,
        tool_code: tool.tool_code,
        tool_name: tool.tool_name,
        specification: tool.specification,
        serial_no: tool.serial_no,
        work_center: item.work_center,
        location_code: tool.location_code,
        operator_name: operator,
        inbound_time: now,
        remark: input.remark?.trim() || null,
        created_at: now,
      })
    }
  })

  try {
    tx()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`BATCH_INBOUND_FAILED: 入库失败，已全部回滚。${msg}`)
  }

  const csvPath = writeLabelXlsx(normalized, inbound_no)
  return { inbound_no, count: normalized.length, csvPath, items: normalized }
}

/** 管理员导入/创建台账后补一条入库记录 */
export function insertAdminImportInbound(
  db: Database.Database,
  tool: {
    id: number
    tool_code: string
    tool_name: string
    specification: string | null
    serial_no: string | null
    work_center: string | null
    location_code: string | null
  },
  options?: { now?: string; operator_name?: string; remark?: string },
): void {
  const now = options?.now ?? formatNow()
  const operator_name = options?.operator_name ?? '管理员导入'
  const work_center = tool.work_center?.trim() || 'LG-FT'
  const inbound_no = inboundRepo.generateInboundNo(db, new Date())
  inboundRepo.insert(db, {
    inbound_no,
    tool_id: tool.id,
    tool_code: tool.tool_code,
    tool_name: tool.tool_name,
    specification: tool.specification,
    serial_no: tool.serial_no,
    work_center,
    location_code: tool.location_code,
    operator_name,
    inbound_time: now,
    remark: options?.remark ?? operator_name,
    created_at: now,
  })
}
