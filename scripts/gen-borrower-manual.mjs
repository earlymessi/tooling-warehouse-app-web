/**
 * 生成借还人使用说明书.docx（无需 pandoc / python-docx）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'docs')
const workDir = path.join(outDir, '_manual_build')
const outFile = path.join(outDir, '工装库管理系统-借还人使用说明书.docx')

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function p(text, opts = {}) {
  const size = opts.size ?? 24 // half-points, 24=12pt
  const bold = opts.bold ? '<w:b/>' : ''
  const center = opts.center ? '<w:jc w:val="center"/>' : ''
  const before = opts.before ?? 120
  const after = opts.after ?? 120
  return `<w:p>
  <w:pPr>
    <w:spacing w:before="${before}" w:after="${after}"/>
    ${center}
  </w:pPr>
  <w:r>
    <w:rPr>
      ${bold}
      <w:sz w:val="${size}"/>
      <w:szCs w:val="${size}"/>
      <w:rFonts w:ascii="Microsoft YaHei" w:hAnsi="Microsoft YaHei" w:eastAsia="Microsoft YaHei"/>
    </w:rPr>
    <w:t xml:space="preserve">${esc(text)}</w:t>
  </w:r>
</w:p>`
}

function h1(text) {
  return p(text, { size: 36, bold: true, before: 360, after: 200 })
}

function h2(text) {
  return p(text, { size: 28, bold: true, before: 280, after: 160 })
}

function bullet(text) {
  return p('• ' + text, { size: 22, before: 60, after: 60 })
}

function step(n, text) {
  return p(`${n}. ${text}`, { size: 22, before: 80, after: 80 })
}

const body = [
  p('工装库管理系统', { size: 44, bold: true, center: true, before: 200, after: 80 }),
  p('借还人使用说明书', { size: 36, bold: true, center: true, before: 80, after: 80 }),
  p('（触摸一体机版）', { size: 22, center: true, before: 40, after: 200 }),
  p('适用对象：现场借还工装的操作人员', { size: 20, center: true, before: 40, after: 40 }),
  p('说明：本手册不包含管理员功能。', { size: 18, center: true, before: 40, after: 360 }),

  h1('一、开机与首页'),
  step(1, '打开设备电源，等待系统进入桌面。'),
  step(2, '点击桌面或开始菜单中的「工装库管理系统」。'),
  step(3, '进入首页后，屏幕上有四个常用大按钮：'),
  bullet('工装借用 —— 把工装借出去'),
  bullet('工装归还 —— 把工装还回来'),
  bullet('库存查询 —— 查工装在不在库、谁在用'),
  bullet('借还记录 —— 查看历史借还情况'),
  p('操作提示：请用手指点击大按钮；扫码枪对准标签扫码后，一般会自动填入。', { size: 20, before: 160, after: 200 }),

  h1('二、如何借用工装'),
  h2('操作步骤'),
  step(1, '在首页点击「工装借用」。'),
  step(2, '用扫码枪扫描工装标签上的资产编号（也可在输入框里手动输入后按回车）。'),
  step(3, '确认工装已加入下方「借出清单」。可连续扫码，一次借多件。'),
  step(4, '填写借用信息：'),
  bullet('借用人：从列表选择员工姓名（推荐）。若名单没有，可手动输入。'),
  bullet('工作中心：选择员工后会自动带出，一般不用改；手动输入借用人时，需自己填写工作中心。'),
  bullet('预计归还时间：选择计划归还的日期和时间（必填）。'),
  bullet('备注：选填。'),
  step(5, '核对清单无误后，点击「确认借用」。'),
  step(6, '看到成功提示后，点击「返回首页」。'),
  h2('注意事项'),
  bullet('只能借「在库」的工装；已借出的不能再借。'),
  bullet('同一件工装不要重复扫进清单。'),
  bullet('扫码失败时，请检查标签是否清晰，或改用手输资产编号。'),
  bullet('借出后请妥善保管工装，并在预计归还时间前归还。'),

  h1('三、如何归还工装'),
  h2('操作步骤'),
  step(1, '在首页点击「工装归还」。'),
  step(2, '扫描（或输入）要归还的资产编号，加入「待归还清单」。可连续扫多件。'),
  step(3, '核对清单中的工装名称、借用人，以及「归还库位」。'),
  step(4, '点击「确认归还」。'),
  step(5, '弹出确认窗口时，请重点看清红色大字标出的库位，把实物放回该库位。'),
  step(6, '确认无误后点击「确认归还」，完成后再回首页。'),
  h2('注意事项'),
  bullet('只有已借出的工装才能归还。'),
  bullet('归还时务必按提示库位放回，避免放错位置。'),
  bullet('若提示“不存在 / 不需要归还”，请先到「库存查询」核对状态。'),

  h1('四、库存查询（选看）'),
  step(1, '首页点击「库存查询」。'),
  step(2, '可按关键字搜索：资产编号、名称、型号、序列号。'),
  step(3, '可按状态筛选：「在库」或「借出」。'),
  step(4, '列表中可查看：库位、使用人、工作中心、预计归还时间等。'),
  p('用途：借之前先查是否在库；还之前先查应放回哪个库位、当前使用人是谁。', { size: 20, before: 120, after: 200 }),

  h1('五、借还记录（选看）'),
  step(1, '首页点击「借还记录」。'),
  step(2, '可按关键字、借用人、状态（未归还 / 已归还 / 已超期）查询。'),
  p('用途：核对本人或本班组的借出情况，避免漏还。', { size: 20, before: 120, after: 200 }),

  h1('六、常见问题'),
  p('Q：扫码没反应？', { size: 22, bold: true, before: 160, after: 60 }),
  p('A：确认光标在输入框内；重新对准标签扫一次；仍不行则手输资产编号后按回车。', { size: 20 }),
  p('Q：提示不可借用？', { size: 22, bold: true, before: 160, after: 60 }),
  p('A：该工装可能已借出或不在库。请到「库存查询」查看状态。', { size: 20 }),
  p('Q：找不到借用人？', { size: 22, bold: true, before: 160, after: 60 }),
  p('A：可手动输入姓名，并自行填写工作中心。如需加入正式名单，请联系管理员。', { size: 20 }),
  p('Q：归还时库位看不清？', { size: 22, bold: true, before: 160, after: 60 }),
  p('A：确认弹窗中有放大显示的库位号，请按该库位放回后再点确认。', { size: 20 }),
  p('Q：屏幕卡住或点不动？', { size: 22, bold: true, before: 160, after: 60 }),
  p('A：稍等几秒；仍无反应可关闭窗口后重新打开软件。不要重复狂点。', { size: 20 }),

  h1('七、操作口诀'),
  p('借：扫码入清单 → 选人填时间 → 确认借用', { size: 22, bold: true, before: 120, after: 80 }),
  p('还：扫码入清单 → 看清库位 → 确认归还', { size: 22, bold: true, before: 80, after: 200 }),

  p('—— 完 ——', { size: 20, center: true, before: 400, after: 80 }),
].join('\n')

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`

fs.rmSync(workDir, { recursive: true, force: true })
fs.mkdirSync(path.join(workDir, '_rels'), { recursive: true })
fs.mkdirSync(path.join(workDir, 'word', '_rels'), { recursive: true })
fs.writeFileSync(path.join(workDir, '[Content_Types].xml'), contentTypes, 'utf8')
fs.writeFileSync(path.join(workDir, '_rels', '.rels'), rels, 'utf8')
fs.writeFileSync(path.join(workDir, 'word', 'document.xml'), documentXml, 'utf8')
fs.writeFileSync(path.join(workDir, 'word', '_rels', 'document.xml.rels'), docRels, 'utf8')

fs.mkdirSync(outDir, { recursive: true })
if (fs.existsSync(outFile)) fs.unlinkSync(outFile)

// Prefer PowerShell Compress-Archive then rename; zip needs .zip extension
const zipPath = outFile.replace(/\.docx$/i, '.zip')
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath)

execFileSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path '${workDir}\\*' -DestinationPath '${zipPath}' -Force; Move-Item -Force '${zipPath}' '${outFile}'`,
  ],
  { stdio: 'inherit' },
)

fs.rmSync(workDir, { recursive: true, force: true })
console.log('created:', outFile)
