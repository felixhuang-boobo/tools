import * as vscode from 'vscode';
import * as path from 'path';
import { MyBatisIndexer } from './indexer';

/**
 * Gutter 图标装饰器
 * 在 Java 接口方法和 XML SQL 语句的行号旁显示跳转箭头图标
 */
export class GutterDecorator {
  private javaDecorationType: vscode.TextEditorDecorationType;
  private xmlDecorationType: vscode.TextEditorDecorationType;
  private javaWarningDecorationType: vscode.TextEditorDecorationType;

  constructor(
    private indexer: MyBatisIndexer,
    private extensionUri: vscode.Uri
  ) {
    // Java → XML 跳转图标（绿色箭头）
    this.javaDecorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: this.getIconPath('arrow-right-green.svg'),
      gutterIconSize: '80%',
    });

    // XML → Java 跳转图标（蓝色箭头）
    this.xmlDecorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: this.getIconPath('arrow-left-blue.svg'),
      gutterIconSize: '80%',
    });

    // 无对应 XML 的警告图标（黄色）
    this.javaWarningDecorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: this.getIconPath('warning-yellow.svg'),
      gutterIconSize: '80%',
    });
  }

  private getIconPath(iconName: string): vscode.Uri {
    return vscode.Uri.joinPath(this.extensionUri, 'icons', iconName);
  }

  updateDecorations(editor: vscode.TextEditor): void {
    const config = vscode.workspace.getConfiguration('mybatisNavigator');
    if (!config.get('enableGutterIcon', true)) {
      editor.setDecorations(this.javaDecorationType, []);
      editor.setDecorations(this.xmlDecorationType, []);
      editor.setDecorations(this.javaWarningDecorationType, []);
      return;
    }

    const document = editor.document;
    const index = this.indexer.getIndex();

    if (document.languageId === 'java') {
      this.updateJavaDecorations(editor, index);
    } else if (document.languageId === 'xml' || document.languageId === 'mybatis-xml') {
      this.updateXmlDecorations(editor, index);
    }
  }

  private updateJavaDecorations(
    editor: vscode.TextEditor,
    index: ReturnType<MyBatisIndexer['getIndex']>
  ): void {
    const namespace = index.javaFileToNamespace.get(editor.document.uri.toString());
    if (!namespace) {
      editor.setDecorations(this.javaDecorationType, []);
      editor.setDecorations(this.javaWarningDecorationType, []);
      return;
    }

    const methods = this.indexer.getJavaMethods(namespace);
    const hasXml: vscode.DecorationOptions[] = [];
    const noXml: vscode.DecorationOptions[] = [];

    for (const method of methods) {
      if (method.uri.toString() !== editor.document.uri.toString()) {
        continue;
      }

      const range = new vscode.Range(method.line, 0, method.line, 0);
      const xmlStmt = this.indexer.findXmlStatement(namespace, method.name);

      if (xmlStmt) {
        hasXml.push({
          range,
          hoverMessage: new vscode.MarkdownString(
            `**MyBatis** → \`${xmlStmt.type.toUpperCase()}\` in Mapper XML\n\n` +
            `点击行号图标或使用 \`Alt+Shift+M\` 跳转`
          ),
        });
      } else {
        noXml.push({
          range,
          hoverMessage: new vscode.MarkdownString(
            `**MyBatis** ⚠️ 未找到对应的 Mapper XML SQL 语句`
          ),
        });
      }
    }

    editor.setDecorations(this.javaDecorationType, hasXml);
    editor.setDecorations(this.javaWarningDecorationType, noXml);
  }

  private updateXmlDecorations(
    editor: vscode.TextEditor,
    index: ReturnType<MyBatisIndexer['getIndex']>
  ): void {
    const namespace = index.xmlFileToNamespace.get(editor.document.uri.toString());
    if (!namespace) {
      editor.setDecorations(this.xmlDecorationType, []);
      return;
    }

    const stmts = this.indexer.getXmlStatements(namespace);
    const decorations: vscode.DecorationOptions[] = [];

    for (const stmt of stmts) {
      if (stmt.uri.toString() !== editor.document.uri.toString()) {
        continue;
      }

      const javaMethod = this.indexer.findJavaMethod(namespace, stmt.id);
      if (javaMethod) {
        decorations.push({
          range: new vscode.Range(stmt.line, 0, stmt.line, 0),
          hoverMessage: new vscode.MarkdownString(
            `**MyBatis** ← \`${javaMethod.qualifiedName.split('.').pop()}.${javaMethod.name}()\`\n\n` +
            `点击行号图标或使用 \`Alt+Shift+M\` 跳转`
          ),
        });
      }
    }

    editor.setDecorations(this.xmlDecorationType, decorations);
  }

  dispose(): void {
    this.javaDecorationType.dispose();
    this.xmlDecorationType.dispose();
    this.javaWarningDecorationType.dispose();
  }
}
