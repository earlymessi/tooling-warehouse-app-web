export interface ToolInboundRecord {
  id: number
  inbound_no: string
  tool_id: number | null
  tool_code: string
  tool_name: string
  specification: string | null
  serial_no: string | null
  work_center: string
  location_code: string | null
  operator_name: string
  inbound_time: string
  remark: string | null
  created_at: string
}

export interface InboundToolItem {
  tool_code: string
  tool_name: string
  specification: string
  serial_no: string
  work_center: string
  location_code: string
}

export interface BatchInboundInput {
  operator_name: string
  items: InboundToolItem[]
  remark?: string
}

export interface BatchInboundError {
  index: number
  tool_code: string
  reason: string
}

export interface BatchInboundResult {
  inbound_no: string
  count: number
  csvPath: string
  items: InboundToolItem[]
}
