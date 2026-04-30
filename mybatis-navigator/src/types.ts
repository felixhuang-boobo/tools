import * as vscode from 'vscode';

/** Mapper XML 中的 SQL 语句信息 */
export interface XmlStatement {
  /** SQL 语句 id（方法名） */
  id: string;
  /** SQL 类型：select / insert / update / delete */
  type: 'select' | 'insert' | 'update' | 'delete';
  /** 所属 namespace（Java 接口全限定名） */
  namespace: string;
  /** XML 文件 URI */
  uri: vscode.Uri;
  /** 语句在 XML 中的行号（0-based） */
  line: number;
  /** 语句在 XML 中的列号（0-based） */
  column: number;
}

/** Java 接口方法信息 */
export interface JavaMethod {
  /** 方法名 */
  name: string;
  /** 所属接口全限定名 */
  qualifiedName: string;
  /** Java 文件 URI */
  uri: vscode.Uri;
  /** 方法在 Java 文件中的行号（0-based） */
  line: number;
  /** 方法在 Java 文件中的列号（0-based） */
  column: number;
}

/** 索引数据：namespace -> 语句/方法列表 */
export interface IndexData {
  /** namespace -> XmlStatement[] */
  xmlStatements: Map<string, XmlStatement[]>;
  /** namespace -> JavaMethod[] */
  javaMethods: Map<string, JavaMethod[]>;
  /** Java 文件 URI string -> namespace */
  javaFileToNamespace: Map<string, string>;
  /** XML 文件 URI string -> namespace */
  xmlFileToNamespace: Map<string, string>;
}
