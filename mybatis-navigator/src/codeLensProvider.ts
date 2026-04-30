import * as vscode from 'vscode';
import { MyBatisIndexer } from './indexer';

/**
 * Java 接口文件中的 CodeLens
 * 在每个有对应 XML SQL 的方法上方显示 "→ Mapper XML" 链接
 */
export class JavaCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(private indexer: MyBatisIndexer) {}

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const config = vscode.workspace.getConfiguration('mybatisNavigator');
    if (!config.get('enableCodeLens', true)) {
      return [];
    }

    const index = this.indexer.getIndex();
    const namespace = index.javaFileToNamespace.get(document.uri.toString());
    if (!namespace) {
      return [];
    }

    const methods = this.indexer.getJavaMethods(namespace);
    const lenses: vscode.CodeLens[] = [];

    for (const method of methods) {
      if (method.uri.toString() !== document.uri.toString()) {
        continue;
      }

      const xmlStmt = this.indexer.findXmlStatement(namespace, method.name);
      if (xmlStmt) {
        const range = new vscode.Range(method.line, 0, method.line, 0);
        lenses.push(
          new vscode.CodeLens(range, {
            title: `$(arrow-right) ${xmlStmt.type.toUpperCase()} → Mapper XML`,
            command: 'mybatis-navigator.jumpToMapper',
            arguments: [xmlStmt.uri, xmlStmt.line, xmlStmt.column],
            tooltip: `跳转到 ${xmlStmt.uri.fsPath}:${xmlStmt.line + 1}`,
          })
        );
      } else {
        // 没有对应 XML，显示警告
        const range = new vscode.Range(method.line, 0, method.line, 0);
        lenses.push(
          new vscode.CodeLens(range, {
            title: `$(warning) 未找到 Mapper XML`,
            command: '',
            tooltip: `方法 ${method.name} 在 Mapper XML 中没有对应的 SQL 语句`,
          })
        );
      }
    }

    return lenses;
  }
}

/**
 * XML Mapper 文件中的 CodeLens
 * 在每个 SQL 语句上方显示 "→ Java Interface" 链接
 */
export class XmlCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(private indexer: MyBatisIndexer) {}

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const config = vscode.workspace.getConfiguration('mybatisNavigator');
    if (!config.get('enableCodeLens', true)) {
      return [];
    }

    const index = this.indexer.getIndex();
    const namespace = index.xmlFileToNamespace.get(document.uri.toString());
    if (!namespace) {
      return [];
    }

    const stmts = this.indexer.getXmlStatements(namespace);
    const lenses: vscode.CodeLens[] = [];

    for (const stmt of stmts) {
      if (stmt.uri.toString() !== document.uri.toString()) {
        continue;
      }

      const javaMethod = this.indexer.findJavaMethod(namespace, stmt.id);
      if (javaMethod) {
        const range = new vscode.Range(stmt.line, 0, stmt.line, 0);
        lenses.push(
          new vscode.CodeLens(range, {
            title: `$(arrow-left) Java Interface ← ${javaMethod.qualifiedName.split('.').pop()}.${javaMethod.name}()`,
            command: 'mybatis-navigator.jumpToInterface',
            arguments: [javaMethod.uri, javaMethod.line, javaMethod.column],
            tooltip: `跳转到 ${javaMethod.uri.fsPath}:${javaMethod.line + 1}`,
          })
        );
      }
    }

    return lenses;
  }
}
