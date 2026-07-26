import ts from "typescript";

export function collectModuleImports(filePath, source) {
  const sourceFile = createSourceFile(filePath, source);
  const imports = [];

  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      imports.push({
        kind: ts.isImportDeclaration(node) ? "static-import" : "export-from",
        specifier: node.moduleSpecifier.text
      });
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteralLike(argument)) {
        imports.push({
          kind: "dynamic-import",
          specifier: argument.text
        });
      } else {
        imports.push({
          kind: "computed-dynamic",
          specifier: null
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return imports;
}

export function isModuleImportGuardedByLocalDemoMode(filePath, source, targetSpecifier) {
  const sourceFile = createSourceFile(filePath, source);
  const normalizedTarget = normalizeImportSpecifier(targetSpecifier);
  let foundTarget = false;
  let allTargetsGuarded = true;

  const visit = (node) => {
    if (isLiteralDynamicImport(node)) {
      const imported = normalizeImportSpecifier(node.arguments[0].text);
      if (imported === normalizedTarget) {
        foundTarget = true;
        allTargetsGuarded = allTargetsGuarded && hasLocalDemoGuard(node);
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return foundTarget && allTargetsGuarded;
}

function createSourceFile(filePath, source) {
  return ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    resolveScriptKind(filePath)
  );
}

function isLiteralDynamicImport(node) {
  return ts.isCallExpression(node)
    && node.expression.kind === ts.SyntaxKind.ImportKeyword
    && node.arguments.length === 1
    && ts.isStringLiteralLike(node.arguments[0]);
}

function hasLocalDemoGuard(node) {
  let current = node.parent;
  while (current) {
    if (
      ts.isIfStatement(current)
      && containsNode(current.thenStatement, node)
      && conditionRequiresLocalDemo(current.expression)
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function containsNode(container, node) {
  return container.pos <= node.pos && container.end >= node.end;
}

function conditionRequiresLocalDemo(expression) {
  const resolved = unwrapParentheses(expression);
  if (ts.isBinaryExpression(resolved) && resolved.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    return conditionRequiresLocalDemo(resolved.left) || conditionRequiresLocalDemo(resolved.right);
  }
  if (!ts.isBinaryExpression(resolved)) return false;
  if (
    resolved.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken
    && resolved.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsToken
  ) {
    return false;
  }
  return (
    isExecutionModeValue(resolved.left) && isLocalDemoModeReference(resolved.right)
  ) || (
    isLocalDemoModeReference(resolved.left) && isExecutionModeValue(resolved.right)
  );
}

function isLocalDemoModeReference(expression) {
  const resolved = unwrapParentheses(expression);
  return ts.isPropertyAccessExpression(resolved)
    && ts.isIdentifier(resolved.expression)
    && resolved.expression.text === "CLIENT_EXECUTION_MODES"
    && resolved.name.text === "localDemo";
}

function isExecutionModeValue(expression) {
  const resolved = unwrapParentheses(expression);
  return (
    ts.isIdentifier(resolved)
    && resolved.text === "executionMode"
  ) || (
    ts.isCallExpression(resolved)
    && ts.isIdentifier(resolved.expression)
    && resolved.expression.text === "resolveClientEntryExecutionMode"
  );
}

function unwrapParentheses(expression) {
  let resolved = expression;
  while (ts.isParenthesizedExpression(resolved)) {
    resolved = resolved.expression;
  }
  return resolved;
}

function normalizeImportSpecifier(specifier) {
  return String(specifier || "").split(/[?#]/u, 1)[0].replace(/^\.\//u, "");
}

function resolveScriptKind(filePath) {
  if (filePath.endsWith(".ts")) return ts.ScriptKind.TS;
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}
