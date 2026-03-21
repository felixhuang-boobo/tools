# 开发工具集

日常开发中使用的工具脚本和自动化方案。

## 工具列表

### Google Sheets @人自动邮件通知

> 路径：`mentiion_notify/`

在 Google Sheets 中使用智能芯片 @ 某人时，自动通过 Gmail 给被 @ 的人发送邮件通知，邮件内容包含该行的完整数据。

**核心功能：**
- 支持 @ 单人和多人，每个人都会收到邮件
- 自动从智能芯片中提取邮箱，无需手动维护联系人映射表
- 邮件包含该行所有列的数据（表头 + 值），以及 Sheet 直达链接
- 自动识别 HYPERLINK 公式，邮件中显示为可点击链接
- 自动识别 IMAGE 公式，邮件中显示图片预览
- 自动过滤 emoji 和不可显示字符，避免邮件乱码

**文件说明：**

| 文件 | 说明 |
|------|------|
| `google_sheet_mention_notify.js` | Google Apps Script 脚本代码 |
| `google_sheet_mention_notify_guide.md` | 详细安装和使用说明 |

**快速开始：**
1. 打开 Google Sheet → `扩展程序` → `Apps Script`
2. 在 Services 中添加 `Google Sheets API`
3. 创建脚本文件，粘贴 `google_sheet_mention_notify.js` 代码
4. 添加 `onEditInstallable` 编辑触发器
5. 完成授权后即可使用

详细步骤请参考 [安装使用说明](mentiion_notify/google_sheet_mention_notify_guide.md)。

### 批量更新卖家状态脚本

> 路径：`batch_update_seller_status.py`

Python 脚本，用于批量更新卖家状态。
