# Google Sheets @人自动邮件通知 - 使用说明

## 功能介绍

在 Google Sheets 中使用智能芯片 @ 某人时，自动通过 Gmail 给被 @ 的人发送邮件通知，邮件内容包含该行的完整数据。

- 支持 @ 单人和多人
- 自动从智能芯片中提取邮箱，无需手动维护联系人映射表
- 邮件包含该行所有列的数据（表头 + 值），以及 Sheet 链接

## 依赖项

| 依赖 | 说明 |
|------|------|
| Google Apps Script | Google Sheets 内置脚本引擎，无需额外安装 |
| Google Sheets API | 需要在 Apps Script 的 Services 中手动添加，用于读取智能芯片底层数据 |
| Gmail | 用于发送通知邮件，首次运行需要授权 |

## 安装步骤

### 第一步：打开 Apps Script

1. 打开你的 Google Sheet
2. 顶部菜单栏点击 `扩展程序（Extensions）` → `Apps Script`
3. 会在新标签页打开 Apps Script 编辑器

### 第二步：添加 Google Sheets API 服务

1. 在 Apps Script 编辑器左侧，找到 `Services`
2. 点击旁边的 `+` 号
3. 在列表中找到 `Google Sheets API`（标识符为 `Sheets`）
4. 点击 `Add` 添加

### 第三步：创建脚本文件

1. 左侧 `Files` 旁边点击 `+` → 选择 `脚本（Script）`
2. 文件名改为 `mention_notify`（或你喜欢的名字）
3. 将 `google_sheet_mention_notify.js` 的完整代码粘贴进去
4. 按 `Ctrl + S` 保存

> 注意：如果已有其他 `.gs` 文件，不需要删除，多个脚本文件可以共存。但确保只有一个文件包含 `onEditInstallable` 函数。

### 第四步：添加触发器

1. 左侧菜单点击闹钟图标（触发器 / Triggers）
2. 右下角点击 `添加触发器`
3. 配置如下：
   - 选择函数：`onEditInstallable`
   - 事件来源：`从电子表格`
   - 事件类型：`编辑时`
4. 点击 `保存`

### 第五步：授权

1. 首次保存触发器时会弹出 Google 授权窗口
2. 选择你的 Google 账号
3. 如果提示「此应用未经验证」，点击 `高级` → `转至 xxx（不安全）`
4. 点击 `允许`，授权 Gmail 发送权限

## 使用方式

安装完成后，正常使用即可：

1. 在 Google Sheet 的任意单元格中输入 `@`
2. 从弹出的人员列表中选择一个或多个人（智能芯片）
3. 按回车确认
4. 脚本自动触发，给被 @ 的人发送邮件

## 邮件内容

收件人会收到一封包含以下信息的邮件：

- 被提及的 Sheet 名称和单元格位置
- 该行所有列的数据（以表格形式展示）
- Sheet 的直达链接

## 自定义配置

脚本顶部可以修改邮件标题：

```javascript
var NOTIFY_SUBJECT = "【Google Sheet 通知】你被提及了";
```

## 查看执行日志

如需排查问题：

1. 打开 Apps Script 编辑器
2. 左侧点击 `执行`（Executions）图标
3. 可以看到每次触发的执行记录和状态

## 注意事项

- 脚本只在编辑单元格时触发，不会扫描已有内容
- 每次编辑只处理当前编辑的单元格
- 如果单元格中没有智能芯片或邮箱，脚本不会执行任何操作
- Google Apps Script 有每日邮件发送配额限制（免费账号 100 封/天，Workspace 账号 1500 封/天）
