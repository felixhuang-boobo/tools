import * as vscode from 'vscode';
import { MyBatisIndexer } from './indexer';
import { JavaToXmlDefinitionProvider, XmlToJavaDefinitionProvider } from './definitionProvider';
import { JavaCodeLensProvider, XmlCodeLensProvider } from './codeLensProvider';
import { GutterDecorator } from './gutterDecorator';

let indexer: MyBatisIndexer;
let gutterDecorator: GutterDecorator;
let javaCodeLens: JavaCodeLensProvider;
let xmlCodeLens: XmlCodeLensProvider;
let statusBarItem: vscode.StatusBarItem;

// XML 文件可能被识别为 xml 或 mybatis-xml（取决于安装的扩展）
const XML_LANGUAGES = ['xml', 'mybatis-xml'];

// DocumentFilter 列表：覆盖所有可能的 XML languageId
const xmlFilters: vscode.DocumentFilter[] = XML_LANGUAGES.map((lang) => ({
  language: lang,
  scheme: 'file',
}));

function isXmlLanguage(languageId: string): boolean {
  return XML_LANGUAGES.includes(languageId);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const startTime = Date.now();

  indexer = new MyBatisIndexer();
  gutterDecorator = new GutterDecorator(indexer, context.extensionUri);
  javaCodeLens = new JavaCodeLensProvider(indexer);
  xmlCodeLens = new XmlCodeLensProvider(indexer);

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = '$(sync~spin) MyBatis 索引构建中...';
  statusBarItem.show();

  // 注册 DefinitionProvider（Ctrl+Click 跳转）
  // Java → XML
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      { language: 'java', scheme: 'file' },
      new JavaToXmlDefinitionProvider(indexer)
    )
  );
  // XML → Java（注册所有可能的 XML languageId）
  for (const filter of xmlFilters) {
    context.subscriptions.push(
      vscode.languages.registerDefinitionProvider(
        filter,
        new XmlToJavaDefinitionProvider(indexer)
      )
    );
  }

  // 注册 CodeLens
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: 'java', scheme: 'file' },
      javaCodeLens
    )
  );
  for (const filter of xmlFilters) {
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(filter, xmlCodeLens)
    );
  }

  // 注册命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mybatis-navigator.jumpToMapper',
      async (uri?: vscode.Uri, line?: number, column?: number) => {
        if (uri && line !== undefined) {
          await jumpToLocation(uri, line, column || 0);
          return;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'java') {
          return;
        }
        await jumpFromJavaToXml(editor);
      }
    ),
    vscode.commands.registerCommand(
      'mybatis-navigator.jumpToInterface',
      async (uri?: vscode.Uri, line?: number, column?: number) => {
        if (uri && line !== undefined) {
          await jumpToLocation(uri, line, column || 0);
          return;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor || !isXmlLanguage(editor.document.languageId)) {
          return;
        }
        await jumpFromXmlToJava(editor);
      }
    ),
    vscode.commands.registerCommand('mybatis-navigator.rebuildIndex', async () => {
      statusBarItem.text = '$(sync~spin) MyBatis 重建索引...';
      statusBarItem.show();
      await indexer.buildFullIndex();
      refreshAll();
      updateStatusBar();
      const index = indexer.getIndex();
      const xmlCount = countValues(index.xmlStatements);
      const javaCount = countValues(index.javaMethods);
      vscode.window.showInformationMessage(
        `MyBatis 索引重建完成：${xmlCount} 个 SQL 语句，${javaCount} 个接口方法`
      );
    })
  );

  // 文件监听器 - 增量更新索引
  const xmlWatcher = vscode.workspace.createFileSystemWatcher('**/src/main/resources/mapper/**/*.xml');
  const javaWatcher = vscode.workspace.createFileSystemWatcher('**/src/main/java/**/*.java');

  xmlWatcher.onDidChange(async (uri) => { await indexer.indexXmlFile(uri); refreshAll(); });
  xmlWatcher.onDidCreate(async (uri) => { await indexer.indexXmlFile(uri); refreshAll(); });
  xmlWatcher.onDidDelete((uri) => { indexer.removeXmlFile(uri.toString()); refreshAll(); });

  javaWatcher.onDidChange(async (uri) => { await indexer.indexJavaFile(uri); refreshAll(); });
  javaWatcher.onDidCreate(async (uri) => { await indexer.indexJavaFile(uri); refreshAll(); });
  javaWatcher.onDidDelete((uri) => { indexer.removeJavaFile(uri.toString()); refreshAll(); });

  context.subscriptions.push(xmlWatcher, javaWatcher);

  // 编辑器切换时更新 Gutter 装饰
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        gutterDecorator.updateDecorations(editor);
      }
    })
  );

  // 文档保存时更新当前文件索引
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (doc.languageId === 'java') {
        await indexer.indexJavaFile(doc.uri);
      } else if (isXmlLanguage(doc.languageId)) {
        await indexer.indexXmlFile(doc.uri);
      }
      refreshAll();
    })
  );

  context.subscriptions.push(statusBarItem, gutterDecorator);

  // 构建初始索引
  await indexer.buildFullIndex();
  const elapsed = Date.now() - startTime;

  updateStatusBar();
  const index = indexer.getIndex();
  const xmlCount = countValues(index.xmlStatements);
  const javaCount = countValues(index.javaMethods);
  statusBarItem.tooltip = `MyBatis Navigator - 索引构建耗时 ${elapsed}ms\n${xmlCount} 个 SQL 语句，${javaCount} 个接口方法`;

  console.log(`[MyBatis Navigator] 索引构建完成：${xmlCount} SQL, ${javaCount} 方法, 耗时 ${elapsed}ms`);

  if (vscode.window.activeTextEditor) {
    gutterDecorator.updateDecorations(vscode.window.activeTextEditor);
  }
}

function countValues<T>(map: Map<string, T[]>): number {
  let count = 0;
  for (const arr of map.values()) {
    count += arr.length;
  }
  return count;
}

function updateStatusBar(): void {
  const index = indexer.getIndex();
  const xmlCount = countValues(index.xmlStatements);
  const javaCount = countValues(index.javaMethods);
  statusBarItem.text = `$(database) MyBatis: ${xmlCount} SQL, ${javaCount} 方法`;
}

function refreshAll(): void {
  javaCodeLens.refresh();
  xmlCodeLens.refresh();
  if (vscode.window.activeTextEditor) {
    gutterDecorator.updateDecorations(vscode.window.activeTextEditor);
  }
  updateStatusBar();
}

async function jumpToLocation(uri: vscode.Uri, line: number, column: number): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc);
  const pos = new vscode.Position(line, column);
  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
}

async function jumpFromJavaToXml(editor: vscode.TextEditor): Promise<void> {
  const index = indexer.getIndex();
  const namespace = index.javaFileToNamespace.get(editor.document.uri.toString());
  if (!namespace) {
    vscode.window.showWarningMessage('当前文件不是 MyBatis Mapper 接口');
    return;
  }

  const position = editor.selection.active;
  const wordRange = editor.document.getWordRangeAtPosition(position, /\w+/);
  if (!wordRange) { return; }
  const word = editor.document.getText(wordRange);

  const xmlStmt = indexer.findXmlStatement(namespace, word);
  if (xmlStmt) {
    await jumpToLocation(xmlStmt.uri, xmlStmt.line, xmlStmt.column);
  } else {
    vscode.window.showWarningMessage(`未找到方法 ${word} 对应的 Mapper XML SQL 语句`);
  }
}

async function jumpFromXmlToJava(editor: vscode.TextEditor): Promise<void> {
  const index = indexer.getIndex();
  const namespace = index.xmlFileToNamespace.get(editor.document.uri.toString());
  if (!namespace) {
    vscode.window.showWarningMessage('当前文件不是 MyBatis Mapper XML');
    return;
  }

  const line = editor.document.lineAt(editor.selection.active.line).text;
  const idMatch = /id\s*=\s*"([^"]+)"/.exec(line);
  if (idMatch) {
    const javaMethod = indexer.findJavaMethod(namespace, idMatch[1]);
    if (javaMethod) {
      await jumpToLocation(javaMethod.uri, javaMethod.line, javaMethod.column);
    } else {
      vscode.window.showWarningMessage(`未找到 ${idMatch[1]} 对应的 Java 接口方法`);
    }
  }
}

export function deactivate(): void {
  // 清理由 dispose pattern 处理
}
