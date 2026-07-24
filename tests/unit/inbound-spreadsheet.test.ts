import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import {
  parseInboundSpreadsheet,
  writeInboundImportTemplate,
} from '../../electron/services/excel.service'

const tempDirs: string[] = []

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tooling-inbound-import-'))
  tempDirs.push(dir)
  return dir
}

function writeWorkbook(filePath: string, rows: Record<string, unknown>[]): void {
  const sheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '工装清单')
  XLSX.writeFile(workbook, filePath)
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('parseInboundSpreadsheet', () => {
  it('parses the first Excel sheet into trimmed inbound rows and ignores extra columns', () => {
    const filePath = path.join(makeTempDir(), 'inbound.xlsx')
    writeWorkbook(filePath, [
      {
        资产编号: ' 0001 ',
        名称: ' 定位夹具 ',
        型号: ' A-100 ',
        序列号: ' SN-001 ',
        工作中心: ' LG-FT ',
        库位: ' A-01 ',
        备注: '不应导入',
      },
      {
        资产编号: '',
        名称: '',
        型号: '',
        序列号: '',
        工作中心: '',
        库位: '',
        备注: '只有额外列也应视为空白行',
      },
    ])

    expect(parseInboundSpreadsheet(filePath)).toEqual([
      {
        tool_code: '0001',
        tool_name: '定位夹具',
        specification: 'A-100',
        serial_no: 'SN-001',
        work_center: 'LG-FT',
        location_code: 'A-01',
      },
    ])
  })

  it('parses legacy XLS workbooks', () => {
    const filePath = path.join(makeTempDir(), 'inbound.xls')
    writeWorkbook(filePath, [
      {
        资产编号: 'XLS-001',
        名称: '旧版表格夹具',
        型号: '',
        序列号: 'XLS-SN-001',
        工作中心: 'WC-XLS',
        库位: 'X-01',
      },
    ])

    expect(parseInboundSpreadsheet(filePath)[0].tool_code).toBe('XLS-001')
  })

  it('only imports the first sheet', () => {
    const filePath = path.join(makeTempDir(), 'multiple-sheets.xlsx')
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([{ 资产编号: 'FIRST', 名称: '第一页' }]),
      '第一页',
    )
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([{ 资产编号: 'SECOND', 名称: '第二页' }]),
      '第二页',
    )
    XLSX.writeFile(workbook, filePath)

    expect(parseInboundSpreadsheet(filePath).map((item) => item.tool_code)).toEqual(['FIRST'])
  })

  it('parses CSV aliases used by existing tooling spreadsheets', () => {
    const filePath = path.join(makeTempDir(), 'inbound.csv')
    fs.writeFileSync(
      filePath,
      '\uFEFF工装ID,工装名称,规格型号,序列号,工作中心,库位\nT-002,检具,B-20,SN-002,WC-01,B-02\n',
      'utf8',
    )

    expect(parseInboundSpreadsheet(filePath)).toEqual([
      {
        tool_code: 'T-002',
        tool_name: '检具',
        specification: 'B-20',
        serial_no: 'SN-002',
        work_center: 'WC-01',
        location_code: 'B-02',
      },
    ])
  })

  it('preserves CSV identifiers that resemble dates as literal text', () => {
    const filePath = path.join(makeTempDir(), 'date-like-identifiers.csv')
    fs.writeFileSync(
      filePath,
      '\uFEFF资产编号,名称,型号,序列号,工作中心,库位\n1-2,检具,,12-31,WC-01,B-03\n',
      'utf8',
    )

    const [item] = parseInboundSpreadsheet(filePath)
    expect(item.tool_code).toBe('1-2')
    expect(item.serial_no).toBe('12-31')
  })

  it('trims whitespace around recognized column headers', () => {
    const filePath = path.join(makeTempDir(), 'spaced-headers.csv')
    fs.writeFileSync(
      filePath,
      '\uFEFF 资产编号 , 名称 , 型号 , 序列号 , 工作中心 , 库位 \nT-004,量具,C-10,SN-004,WC-02,C-04\n',
      'utf8',
    )

    expect(parseInboundSpreadsheet(filePath)[0]).toEqual({
      tool_code: 'T-004',
      tool_name: '量具',
      specification: 'C-10',
      serial_no: 'SN-004',
      work_center: 'WC-02',
      location_code: 'C-04',
    })
  })

  it('rejects a spreadsheet without recognizable inbound columns', () => {
    const filePath = path.join(makeTempDir(), 'wrong-columns.csv')
    fs.writeFileSync(filePath, '编号,品名\nT-003,量具\n', 'utf8')

    expect(() => parseInboundSpreadsheet(filePath)).toThrow('未识别到可导入的工装列')
  })

  it('reports an unreadable spreadsheet with an actionable Chinese message', () => {
    const filePath = path.join(makeTempDir(), 'missing.xlsx')

    expect(() => parseInboundSpreadsheet(filePath)).toThrow('无法读取表格文件')
  })

  it('rejects a spreadsheet without effective inbound rows', () => {
    const filePath = path.join(makeTempDir(), 'empty.xlsx')
    const sheet = XLSX.utils.aoa_to_sheet([
      ['资产编号', '名称', '型号', '序列号', '工作中心', '库位'],
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, '工装清单')
    XLSX.writeFile(workbook, filePath)

    expect(() => parseInboundSpreadsheet(filePath)).toThrow('表格中没有可导入的工装数据')
  })
})

describe('writeInboundImportTemplate', () => {
  it('writes shaded tool-code column with 无需填写 placeholder', () => {
    const filePath = path.join(makeTempDir(), 'inbound-template.xlsx')

    expect(writeInboundImportTemplate(filePath)).toBe(filePath)

    const workbook = XLSX.readFile(filePath)
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false })
    expect(rows[0]?.[0]).toBe('资产编号')
    expect(rows[0]?.slice(1)).toEqual(['名称', '型号', '序列号', '工作中心', '库位'])
    expect(rows[1]?.[0]).toBe('无需填写')
    expect(rows[1]?.[1]).toBe('示例夹具')
  })
})
