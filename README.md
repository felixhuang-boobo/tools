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

### MyBatis Navigator（VS Code / Kiro 插件）

> 路径：`mybatis-navigator/`

MyBatis Mapper 接口与 XML 之间的双向跳转插件，为 VS Code / Kiro 提供类似 IntelliJ IDEA 的开发体验。

**核心功能：**
- Ctrl+Click 在 Java 接口方法名和 XML SQL 语句之间双向跳转
- CodeLens 在方法上方显示可点击的跳转链接
- Gutter 图标（绿色箭头/蓝色箭头/黄色警告）
- Alt+Shift+M 快捷键跳转
- 文件保存时自动增量更新索引
- 支持 `xml` 和 `mybatis-xml` 两种 languageId

**安装方式：**
```powershell
kiro --install-extension mybatis-navigator/mybatis-navigator-0.1.0.vsix --force
```

详细说明请参考 [mybatis-navigator/README.md](mybatis-navigator/README.md)。
