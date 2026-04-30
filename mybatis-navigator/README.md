# MyBatis Navigator

MyBatis Mapper 接口与 XML 之间的双向跳转插件，为 VS Code / Kiro 提供类似 IntelliJ IDEA 的 MyBatis 开发体验。

## 功能一览

| 功能 | 说明 |
|------|------|
| **Ctrl+Click 跳转** | Java 接口方法名上 Ctrl+Click 直接跳转到 Mapper XML 对应的 SQL 语句，反向同样支持 |
| **CodeLens 链接** | 方法上方显示 `→ SELECT → Mapper XML` 或 `← Java Interface` 可点击链接 |
| **Gutter 图标** | 行号旁显示绿色箭头（有对应 XML）/ 蓝色箭头（XML→Java）/ 黄色警告（无对应 XML） |
| **快捷键** | `Alt+Shift+M` 在 Java 和 XML 之间快速跳转 |
| **namespace 跳转** | 在 XML 的 `namespace` 属性上 Ctrl+Click 跳转到 Java 接口文件 |
| **resultMap 引用跳转** | 在 XML 的 `resultMap`/`refid`/`extends` 引用上 Ctrl+Click 跳转到定义处 |
| **增量索引** | 文件保存/创建/删除时自动更新索引，无需手动刷新 |
| **状态栏** | 底部状态栏显示当前索引的 SQL 语句数和接口方法数 |

## 安装

### 方式一：VSIX 安装（推荐）

1. 在 VS Code / Kiro 中按 `Ctrl+Shift+P`
2. 输入 `Install from VSIX`
3. 选择 `mybatis-navigator-0.1.0.vsix` 文件
4. 重新加载窗口

### 方式二：命令行安装

```powershell
# VS Code
code --install-extension mybatis-navigator-0.1.0.vsix

# Kiro（如果支持 CLI）
kiro --install-extension mybatis-navigator-0.1.0.vsix
```

## 使用方式

### 跳转操作

- **Java → XML**：在 Mapper 接口的方法名上 `Ctrl+Click`，或光标定位到方法名后按 `Alt+Shift+M`
- **XML → Java**：在 SQL 标签的 `id="xxx"` 上 `Ctrl+Click`，或光标定位到 SQL 标签行后按 `Alt+Shift+M`
- **namespace 跳转**：在 `<mapper namespace="xxx">` 的 namespace 值上 `Ctrl+Click`

### 命令面板

按 `Ctrl+Shift+P` 可使用以下命令：

| 命令 | 说明 |
|------|------|
| `MyBatis: 跳转到 Mapper XML` | 从 Java 接口跳转到 XML |
| `MyBatis: 跳转到 Java 接口` | 从 XML 跳转到 Java 接口 |
| `MyBatis: 重建索引` | 手动重建全量索引 |

### 配置项

在 VS Code 设置中搜索 `mybatisNavigator`：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `mybatisNavigator.mapperXmlGlob` | `**/src/main/resources/mapper/**/*.xml` | Mapper XML 文件匹配模式 |
| `mybatisNavigator.javaSourceGlob` | `**/src/main/java/**/*.java` | Java 源文件匹配模式 |
| `mybatisNavigator.enableCodeLens` | `true` | 是否显示方法上方的 CodeLens 跳转链接 |
| `mybatisNavigator.enableGutterIcon` | `true` | 是否显示行号旁的跳转图标 |

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| TypeScript | 5.3.3 | 主要开发语言 |
| VS Code Extension API | ^1.85.0 | 插件框架 |
| @vscode/vsce | 3.x | 打包工具 |

无第三方运行时依赖，纯正则解析，轻量高效。

## 实现思路

### 架构设计

```
┌─────────────────────────────────────────────────┐
│                  extension.ts                    │
│              （入口：注册所有 Provider）            │
├──────────┬──────────┬───────────┬───────────────┤
│ Definition│ CodeLens │  Gutter   │  FileWatcher  │
│ Provider  │ Provider │ Decorator │  (增量更新)    │
├──────────┴──────────┴───────────┴───────────────┤
│                  MyBatisIndexer                   │
│           （核心：构建和维护双向索引）               │
├─────────────────────────────────────────────────┤
│                    types.ts                       │
│              （数据结构定义）                       │
└─────────────────────────────────────────────────┘
```

### 核心模块

#### 1. MyBatisIndexer（索引器）

插件的核心，负责扫描工作区中的 Java 接口文件和 Mapper XML 文件，构建双向映射索引。

**索引构建过程：**
- 启动时全量扫描：通过 `workspace.findFiles()` 按 glob 模式查找所有文件
- XML 解析：正则提取 `<mapper namespace="...">` 和 `<select|insert|update|delete id="...">`
- Java 解析：正则提取 `package`、`interface` 声明和接口方法签名
- 建立 `namespace → [XmlStatement]` 和 `namespace → [JavaMethod]` 的双向映射

**增量更新：**
- 通过 `FileSystemWatcher` 监听文件变化
- 文件保存/创建时重新解析单个文件并更新索引
- 文件删除时移除对应索引条目

#### 2. DefinitionProvider（跳转核心）

实现 VS Code 的 `DefinitionProvider` 接口，这是 `Ctrl+Click` 跳转的底层机制。

- `JavaToXmlDefinitionProvider`：光标在 Java 方法名上时，查索引找到对应 XML SQL 语句的位置
- `XmlToJavaDefinitionProvider`：光标在 XML 的 `id` 属性值上时，查索引找到对应 Java 方法的位置

#### 3. CodeLensProvider（行内链接）

在代码行上方显示可点击的操作链接：
- Java 文件：每个有对应 XML 的方法上方显示 `→ SELECT → Mapper XML`
- XML 文件：每个 SQL 语句上方显示 `← Java Interface ← XxxDao.methodName()`
- 无对应 XML 的方法显示 `⚠️ 未找到 Mapper XML` 警告

#### 4. GutterDecorator（行号图标）

通过 `TextEditorDecorationType` 在行号区域显示 SVG 图标：
- 🟢 绿色右箭头：Java 方法有对应的 XML SQL
- 🔵 蓝色左箭头：XML SQL 有对应的 Java 方法
- 🟡 黄色警告：Java 方法没有对应的 XML SQL

### 为什么用正则而不是 AST？

- **轻量**：无需引入 Java/XML 解析器，零运行时依赖
- **快速**：正则扫描比 AST 解析快一个数量级，大型项目（1000+ Mapper）也能秒级完成索引
- **够用**：MyBatis 的 namespace 和 id 结构非常规范，正则完全能准确匹配
- **兼容**：不依赖 Java Language Server，即使没装 Java 扩展也能工作

### 匹配逻辑

```
Java 接口: com.yamibuy.central.sellerportal.dao.CategoryChangeDao
                                    ↕ namespace 匹配
XML Mapper: <mapper namespace="com.yamibuy.central.sellerportal.dao.CategoryChangeDao">

Java 方法: List<CategoryChange> selectByCondition(...)
                                    ↕ id 匹配
XML 语句:  <select id="selectByCondition" resultType="...">
```

## 构建

### 环境要求

- Node.js >= 18
- npm >= 9

### 构建步骤

```powershell
# 1. 安装依赖
npm install

# 2. 编译 TypeScript
npm run compile

# 3. 打包成 VSIX
npx @vscode/vsce package --no-dependencies
```

构建产物：`mybatis-navigator-{version}.vsix`

### 开发调试

```powershell
# 监听模式编译
npm run watch
```

然后在 VS Code 中按 `F5` 启动 Extension Development Host 进行调试。

## 目录结构

```
mybatis-navigator/
├── src/
│   ├── types.ts                # 数据结构定义（XmlStatement, JavaMethod, IndexData）
│   ├── indexer.ts              # 核心索引器（扫描、解析、查询）
│   ├── definitionProvider.ts   # Ctrl+Click 跳转（DefinitionProvider）
│   ├── codeLensProvider.ts     # 行内链接（CodeLensProvider）
│   ├── gutterDecorator.ts      # 行号图标装饰器
│   └── extension.ts            # 插件入口（注册 Provider、命令、监听器）
├── icons/
│   ├── arrow-right-green.svg   # Java→XML 跳转图标
│   ├── arrow-left-blue.svg     # XML→Java 跳转图标
│   └── warning-yellow.svg      # 无对应 XML 警告图标
├── package.json                # 插件清单（命令、配置、快捷键）
├── tsconfig.json               # TypeScript 配置
├── .vscodeignore               # 打包排除规则
└── mybatis-navigator-0.1.0.vsix # 打包产物
```

## 已知限制

1. **仅支持接口方法**：不支持 MyBatis 注解方式（`@Select`、`@Insert` 等），只支持 XML Mapper
2. **正则解析**：极端情况下（如方法签名跨多行）可能匹配不到，但覆盖 99% 的常规写法
3. **不支持动态 SQL 片段跳转**：`<include refid="...">` 的跳转仅限同文件内的 `<sql>` 定义
4. **多模块项目**：依赖 glob 模式匹配，如果项目结构非标准需要调整 `mapperXmlGlob` 和 `javaSourceGlob` 配置
