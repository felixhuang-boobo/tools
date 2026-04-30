import * as vscode from 'vscode';
import { MyBatisIndexer } from './indexer';

/**
 * Java 接口 → XML Mapper 跳转
 * 在 Java 接口方法名上 Ctrl+Click 跳转到对应的 XML SQL 语句
 */
export class JavaToXmlDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private indexer: MyBatisIndexer) {}

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Definition | undefined {
    const index = this.indexer.getIndex();
    const uriStr = document.uri.toString();
    const namespace = index.javaFileToNamespace.get(uriStr);
    if (!namespace) {
      return undefined;
    }

    // 获取光标所在的单词（方法名）
    const wordRange = document.getWordRangeAtPosition(position, /\w+/);
    if (!wordRange) {
      return undefined;
    }
    const word = document.getText(wordRange);

    // 确认这个单词是接口方法（放宽匹配：只要方法名匹配即可，不严格要求行号）
    const methods = this.indexer.getJavaMethods(namespace);
    const method = methods.find((m) => m.name === word);
    if (!method) {
      return undefined;
    }

    // 查找对应的 XML 语句
    const xmlStmt = this.indexer.findXmlStatement(namespace, word);
    if (!xmlStmt) {
      return undefined;
    }

    return new vscode.Location(xmlStmt.uri, new vscode.Position(xmlStmt.line, xmlStmt.column));
  }
}

/**
 * XML Mapper → Java 接口跳转
 * 在 XML 的 SQL id 上 Ctrl+Click 跳转到对应的 Java 接口方法
 */
export class XmlToJavaDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private indexer: MyBatisIndexer) {}

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Definition | undefined {
    const index = this.indexer.getIndex();
    const uriStr = document.uri.toString();
    const namespace = index.xmlFileToNamespace.get(uriStr);
    if (!namespace) {
      return undefined;
    }

    const line = document.lineAt(position.line).text;

    // 检查是否在 namespace 属性值上（跳转到接口文件）
    const nsAttrMatch = /namespace\s*=\s*"([^"]+)"/.exec(line);
    if (nsAttrMatch) {
      const nsValue = nsAttrMatch[1];
      const nsStart = line.indexOf(nsValue);
      const nsEnd = nsStart + nsValue.length;
      if (position.character >= nsStart && position.character <= nsEnd) {
        const methods = this.indexer.getJavaMethods(nsValue);
        if (methods.length > 0) {
          return new vscode.Location(methods[0].uri, new vscode.Position(0, 0));
        }
      }
    }

    // 检查是否在 SQL 语句的 id 属性值上
    const idMatch = /id\s*=\s*"([^"]+)"/.exec(line);
    if (idMatch) {
      const idValue = idMatch[1];
      const idStart = line.indexOf('"' + idValue + '"') + 1;
      const idEnd = idStart + idValue.length;
      if (position.character >= idStart && position.character <= idEnd) {
        const javaMethod = this.indexer.findJavaMethod(namespace, idValue);
        if (javaMethod) {
          return new vscode.Location(
            javaMethod.uri,
            new vscode.Position(javaMethod.line, javaMethod.column)
          );
        }
      }
    }

    // 检查是否在 resultMap / include 等引用的 id 上
    const refIdMatch = /(?:resultMap|refid|extends)\s*=\s*"([^"]+)"/.exec(line);
    if (refIdMatch) {
      const refId = refIdMatch[1];
      const refStart = line.indexOf('"' + refId + '"') + 1;
      const refEnd = refStart + refId.length;
      if (position.character >= refStart && position.character <= refEnd) {
        const text = document.getText();
        const escaped = refId.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
        const resultMapRegex = new RegExp('<resultMap[^>]+id\\s*=\\s*"' + escaped + '"', 'i');
        const rmMatch = resultMapRegex.exec(text);
        if (rmMatch) {
          const pos = document.positionAt(rmMatch.index);
          return new vscode.Location(document.uri, pos);
        }
      }
    }

    return undefined;
  }
}
