// TypeScript's AST retains imports erased by runtime transpilation

import { join } from "node:path";
import {
  isCallExpression,
  isExportDeclaration,
  isExternalModuleReference,
  isIdentifier,
  isImportDeclaration,
  isImportTypeNode,
  isJsxElement,
  isJsxSelfClosingElement,
  isLiteralTypeNode,
  isNoSubstitutionTemplateLiteral,
  isStringLiteral,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { API } from "typescript/unstable/async";

export type Reference = { name: string; start: number; end: number };
export type ParsedSource = { text: string; references: Reference[]; jsx: boolean };

const readSource = (source: SourceFile): ParsedSource => {
  const references: Reference[] = [];
  let jsx = false;
  const add = (node: Node | undefined) => {
    if (node && (isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node))) {
      references.push({ name: node.text, start: node.getStart(source), end: node.end });
    }
  };
  const visit = (node: Node): void => {
    if (isImportDeclaration(node) || isExportDeclaration(node)) add(node.moduleSpecifier);
    else if (isImportTypeNode(node) && isLiteralTypeNode(node.argument)) {
      add(node.argument.literal);
    } else if (isExternalModuleReference(node)) add(node.expression);
    else if (isCallExpression(node)) {
      const expr = node.expression;
      if (expr.kind === SyntaxKind.ImportKeyword || (isIdentifier(expr) && expr.text === "require")) {
        add(node.arguments[0]);
      }
    }
    if (isJsxElement(node) || isJsxSelfClosingElement(node)) jsx = true;
    node.forEachChild(visit);
  };
  visit(source);
  return { text: source.text, references, jsx };
};

export async function parseSources(root: string, files: string[]): Promise<Map<string, ParsedSource>> {
  const api = new API({ cwd: root });
  try {
    const snapshot = await api.updateSnapshot({
      openProjects: [join(root, "tsconfig.json")],
    });
    const project = snapshot.getProject(join(root, "tsconfig.json"));
    if (!project) throw new Error(`TypeScript could not load ${root}/tsconfig.json`);
    const sources = new Map<string, ParsedSource>();
    for (const file of files) {
      const source = await project.program.getSourceFile(file);
      if (!source) throw new Error(`TypeScript could not parse ${file}`);
      const diagnostics = await project.program.getSyntacticDiagnostics(file);
      if (diagnostics.length) throw new Error(`Invalid source ${file}: ${JSON.stringify(diagnostics)}`);
      sources.set(file, readSource(source));
    }
    await snapshot.dispose();
    return sources;
  } finally {
    await api.close();
  }
}
