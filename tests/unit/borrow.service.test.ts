import { describe, it, expect } from 'vitest'
import { initTestDatabase } from '../../electron/db'
import * as toolService from '../../electron/services/tool.service'
import * as borrowService from '../../electron/services/borrow.service'

describe('borrow.service', () => {
  it('borrow and return updates tool status and quantity', () => {
    const db = initTestDatabase()
    toolService.createTool(db, { tool_code: '10001', tool_name: '夹具A' })

    borrowService.borrowTool(db, {
      toolCode: '10001',
      borrower: '张三',
      borrowerEmployeeNo: 'E100',
      borrowDepartment: '生产部',
      expectedReturnTime: '2026-07-01T18:00:00',
    })

    const openRecord = borrowService.getOpenRecordByToolCode(db, '10001')!
    expect(openRecord.borrower_employee_no).toBe('E100')

    let tool = toolService.getToolByCode(db, '10001')!
    expect(tool.status).toBe('借出')
    expect(tool.quantity).toBe(0)

    expect(() =>
      borrowService.borrowTool(db, {
        toolCode: '10001',
        borrower: '李四',
        borrowerEmployeeNo: 'E101',
        borrowDepartment: '生产部',
        expectedReturnTime: '2026-07-02T18:00:00',
      }),
    ).toThrow()

    borrowService.returnTool(db, { toolCode: '10001' })
    tool = toolService.getToolByCode(db, '10001')!
    expect(tool.status).toBe('在库')
    expect(tool.quantity).toBe(1)
    db.close()
  })

  it('keeps borrow history and clears tool reference after deleting a returned tool', () => {
    const db = initTestDatabase()
    const tool = toolService.createTool(db, { tool_code: '10002', tool_name: '夹具B' })

    const borrowed = borrowService.borrowTool(db, {
      toolCode: '10002',
      borrower: '李四',
      borrowerEmployeeNo: 'E101',
      borrowDepartment: '生产部',
      expectedReturnTime: '2026-07-02T18:00:00',
    })
    borrowService.returnTool(db, { toolCode: '10002' })

    toolService.deleteTool(db, tool.id)

    expect(toolService.getToolByCode(db, '10002')).toBeNull()
    const history = borrowService.getBorrowRecordById(db, borrowed.id)
    expect(history).not.toBeNull()
    expect(history?.tool_id).toBeNull()
    expect(history?.tool_code).toBe('10002')
    expect(history?.tool_name).toBe('夹具B')
    expect(history?.borrower_employee_no).toBe('E101')
    db.close()
  })

  it('rejects deleting a tool that is still borrowed', () => {
    const db = initTestDatabase()
    const tool = toolService.createTool(db, { tool_code: '10003', tool_name: '夹具C' })
    const borrowed = borrowService.borrowTool(db, {
      toolCode: '10003',
      borrower: '赵六',
      borrowerEmployeeNo: 'E102',
      borrowDepartment: '生产部',
      expectedReturnTime: '2026-07-03T18:00:00',
    })

    expect(() => toolService.adminDeleteTool(db, tool.id)).toThrow('TOOL_BORROWED')
    expect(toolService.getToolByCode(db, '10003')).not.toBeNull()
    expect(borrowService.getBorrowRecordById(db, borrowed.id)?.tool_id).toBe(tool.id)
    db.close()
  })

  it('keeps detached history detached when the same tool code is reused', () => {
    const db = initTestDatabase()
    const oldTool = toolService.createTool(db, { tool_code: '10004', tool_name: '旧夹具' })
    const borrowed = borrowService.borrowTool(db, {
      toolCode: '10004',
      borrower: '钱七',
      borrowerEmployeeNo: 'E103',
      borrowDepartment: '生产部',
      expectedReturnTime: '2026-07-04T18:00:00',
    })
    borrowService.returnTool(db, { toolCode: '10004' })
    toolService.deleteTool(db, oldTool.id)
    const newTool = toolService.createTool(db, { tool_code: '10004', tool_name: '新夹具' })

    const updated = borrowService.adminUpdateBorrowRecord(db, borrowed.id, {
      borrower_employee_no: 'E103-UPDATED',
    })

    expect(updated.tool_id).toBeNull()
    expect(updated.tool_code).toBe('10004')
    expect(updated.tool_name).toBe('旧夹具')
    expect(updated.borrower_employee_no).toBe('E103-UPDATED')
    expect(toolService.getToolById(db, newTool.id)?.tool_name).toBe('新夹具')
    db.close()
  })

  it('rejects deletion when an open record exists even if tool status is inconsistent', () => {
    const db = initTestDatabase()
    const tool = toolService.createTool(db, { tool_code: '10005', tool_name: '夹具D' })
    borrowService.borrowTool(db, {
      toolCode: '10005',
      borrower: '孙八',
      borrowerEmployeeNo: 'E104',
      borrowDepartment: '生产部',
      expectedReturnTime: '2026-07-05T18:00:00',
    })
    db.prepare("UPDATE tool_account SET status = '在库', quantity = 1 WHERE id = ?").run(tool.id)

    expect(() => toolService.adminDeleteTool(db, tool.id)).toThrow('TOOL_BORROWED')
    expect(toolService.getToolById(db, tool.id)).not.toBeNull()
    db.close()
  })
})
