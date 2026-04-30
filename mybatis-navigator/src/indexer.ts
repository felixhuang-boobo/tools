import * as vscode from 'vscode';
import { IndexData, XmlStatement, JavaMethod } from './types';

const SQL_TAG_REGEX = /<(select|insert|update|delete)\s+[^>]*id\s*=\s*"([^"]+)"[^>]*>/gi;
const NAMESPACE_REGEX = /<mapper\s+[^>]*namespace\s*=\s*"([^"]+)"[^>]*>/i;
const JAVA_PACKAGE_REGEX = /^\s*package\s+([\w.]+)\s*;/m;
const JAVA_INTERFACE_REGEX = /(?:public\s+)?interface\s+(\w+)/;
const JAVA_METHOD_REGEX = /^\s*(?:[\w<>\[\],\s]+?)\s+(\w+)\s*\(/gm;

export class MyBatisIndexer {
  private index: IndexData = {
    xmlStatements: new Map(),
    javaMethods: new Map(),
    javaFileToNamespace: new Map(),
    xmlFileToNamespace: new Map(),
  };

  private xmlGlob: string;
  private javaGlob: string;

  constructor() {
    const config = vscode.workspace.getConfiguration('mybatisNavigator');
    this.xmlGlob = config.get('mapperXmlGlob', '**/src/main/resources/mapper/**/*.xml');
    this.javaGlob = config.get('javaSourceGlob', '**/src/main/java/**/*.java');
  }

  getIndex(): IndexData {
    return this.index;
  }

  async buildFullIndex(): Promise<void> {
    this.index = {
      xmlStatements: new Map(),
      javaMethods: new Map(),
      javaFileToNamespace: new Map(),
      xmlFileToNamespace: new Map(),
    };

    await Promise.all([this.indexAllXml(), this.indexAllJava()]);
  }

  // ─── XML 索引 ───

  private async indexAllXml(): Promise<void> {
    const files = await vscode.workspace.findFiles(this.xmlGlob);
    await Promise.all(files.map((uri) => this.indexXmlFile(uri)));
  }

  async indexXmlFile(uri: vscode.Uri): Promise<void> {
    try {
      const content = (await vscode.workspace.fs.readFile(uri)).toString();
      this.parseXml(uri, content);
    } catch {
      // 文件读取失败，静默跳过
    }
  }

  private parseXml(uri: vscode.Uri, content: string): void {
    const nsMatch = NAMESPACE_REGEX.exec(content);
    if (!nsMatch) {
      return;
    }
    const namespace = nsMatch[1];
    const uriStr = uri.toString();

    // 清除该文件旧索引
    this.removeXmlFile(uriStr);
    this.index.xmlFileToNamespace.set(uriStr, namespace);

    const statements: XmlStatement[] = [];
    const lines = content.split('\n');

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const tagRegex = /<(select|insert|update|delete)\s+[^>]*id\s*=\s*"([^"]+)"[^>]*/gi;
      let match: RegExpExecArray | null;

      while ((match = tagRegex.exec(line)) !== null) {
        statements.push({
          id: match[2],
          type: match[1].toLowerCase() as XmlStatement['type'],
          namespace,
          uri,
          line: lineIdx,
          column: match.index,
        });
      }
    }

    const existing = this.index.xmlStatements.get(namespace) || [];
    // 移除同文件旧数据后追加
    const filtered = existing.filter((s) => s.uri.toString() !== uriStr);
    this.index.xmlStatements.set(namespace, [...filtered, ...statements]);
  }

  removeXmlFile(uriStr: string): void {
    const oldNs = this.index.xmlFileToNamespace.get(uriStr);
    if (oldNs) {
      const stmts = this.index.xmlStatements.get(oldNs);
      if (stmts) {
        this.index.xmlStatements.set(
          oldNs,
          stmts.filter((s) => s.uri.toString() !== uriStr)
        );
      }
      this.index.xmlFileToNamespace.delete(uriStr);
    }
  }

  // ─── Java 索引 ───

  private async indexAllJava(): Promise<void> {
    const files = await vscode.workspace.findFiles(this.javaGlob);
    await Promise.all(files.map((uri) => this.indexJavaFile(uri)));
  }

  async indexJavaFile(uri: vscode.Uri): Promise<void> {
    try {
      const content = (await vscode.workspace.fs.readFile(uri)).toString();
      this.parseJava(uri, content);
    } catch {
      // 文件读取失败，静默跳过
    }
  }

  private parseJava(uri: vscode.Uri, content: string): void {
    const pkgMatch = JAVA_PACKAGE_REGEX.exec(content);
    const ifaceMatch = JAVA_INTERFACE_REGEX.exec(content);
    if (!pkgMatch || !ifaceMatch) {
      return;
    }

    // 只索引接口（Dao / Mapper）
    const qualifiedName = `${pkgMatch[1]}.${ifaceMatch[1]}`;
    const uriStr = uri.toString();

    // 清除旧索引
    this.removeJavaFile(uriStr);
    this.index.javaFileToNamespace.set(uriStr, qualifiedName);

    const methods: JavaMethod[] = [];
    const lines = content.split('\n');

    // 判断是否在接口体内
    let insideInterface = false;
    let braceDepth = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];

      if (!insideInterface) {
        if (JAVA_INTERFACE_REGEX.test(line)) {
          insideInterface = true;
          braceDepth = 0;
        }
      }

      if (insideInterface) {
        for (const ch of line) {
          if (ch === '{') { braceDepth++; }
          if (ch === '}') { braceDepth--; }
        }

        // 匹配接口方法声明
        // 支持: List<Integer> methodName(...), void methodName(...), Map<String, Object> methodName(...)
        if (braceDepth >= 1) {
          const trimmed = line.trim();
          // 跳过注释、注解、import、package
          if (
            trimmed.startsWith('//') ||
            trimmed.startsWith('/*') ||
            trimmed.startsWith('*') ||
            trimmed.startsWith('@') ||
            trimmed.startsWith('import ') ||
            trimmed.startsWith('package ')
          ) {
            // 不跳过，注解行本身不含方法声明，但下一行可能有
            // 只跳过纯注释行
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
              continue;
            }
          }

          // 核心正则：匹配 "返回类型 方法名(" 模式
          // 返回类型可以是: void, int, String, List<Integer>, Map<String, List<Object>>
          // 方法名紧跟在返回类型后面，以 ( 开头
          const methodMatch = /\b(\w+)\s*\(/.exec(trimmed);
          if (methodMatch) {
            const candidate = methodMatch[1];
            // 排除 Java 关键字、接口声明、注解
            if (
              !isJavaKeyword(candidate) &&
              candidate !== ifaceMatch[1] &&  // 排除接口名本身
              !trimmed.startsWith('@') &&
              !/^(interface|class|enum)\b/.test(trimmed)
            ) {
              // 额外验证：方法名前面应该有返回类型（至少一个非空白字符）
              const beforeMethod = trimmed.substring(0, trimmed.indexOf(candidate)).trim();
              if (beforeMethod.length > 0) {
                methods.push({
                  name: candidate,
                  qualifiedName,
                  uri,
                  line: lineIdx,
                  column: line.indexOf(candidate),
                });
              }
            }
          }
        }

        if (braceDepth <= 0 && insideInterface) {
          break; // 接口体结束
        }
      }
    }

    const existing = this.index.javaMethods.get(qualifiedName) || [];
    const filtered = existing.filter((m) => m.uri.toString() !== uriStr);
    this.index.javaMethods.set(qualifiedName, [...filtered, ...methods]);
  }

  removeJavaFile(uriStr: string): void {
    const oldNs = this.index.javaFileToNamespace.get(uriStr);
    if (oldNs) {
      const methods = this.index.javaMethods.get(oldNs);
      if (methods) {
        this.index.javaMethods.set(
          oldNs,
          methods.filter((m) => m.uri.toString() !== uriStr)
        );
      }
      this.index.javaFileToNamespace.delete(uriStr);
    }
  }

  // ─── 查询 ───

  /** 根据 namespace + methodName 查找 XML 中的 SQL 语句 */
  findXmlStatement(namespace: string, methodName: string): XmlStatement | undefined {
    const stmts = this.index.xmlStatements.get(namespace);
    return stmts?.find((s) => s.id === methodName);
  }

  /** 根据 namespace + statementId 查找 Java 接口方法 */
  findJavaMethod(namespace: string, statementId: string): JavaMethod | undefined {
    const methods = this.index.javaMethods.get(namespace);
    return methods?.find((m) => m.name === statementId);
  }

  /** 获取某个 namespace 下所有 XML 语句 */
  getXmlStatements(namespace: string): XmlStatement[] {
    return this.index.xmlStatements.get(namespace) || [];
  }

  /** 获取某个 namespace 下所有 Java 方法 */
  getJavaMethods(namespace: string): JavaMethod[] {
    return this.index.javaMethods.get(namespace) || [];
  }
}

const JAVA_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
  'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
  'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
  'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new',
  'package', 'private', 'protected', 'public', 'return', 'short', 'static',
  'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'try', 'void', 'volatile', 'while',
]);

function isJavaKeyword(word: string): boolean {
  return JAVA_KEYWORDS.has(word);
}
