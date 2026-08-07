import { createHash } from 'node:crypto';
import ts from 'typescript';
import { aiVideoModelPortfolioSchema, type AiVideoModelPortfolio } from './ai-video-types';

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /(?:\+?\d[\d\s().-]{8,}\d)/g;
const URL = /https?:\/\/\S+/gi;
const ALLOWED_IMPORTS = new Map([
  ['react', new Set(['default'])],
  ['remotion', new Set(['AbsoluteFill', 'Sequence', 'useCurrentFrame', 'interpolate', 'spring', 'Easing'])],
  ['@business-ceo/video-runtime', new Set(['GeneratedVideoRuntime'])],
]);
const BLOCKED_IDENTIFIERS = new Set([
  'fetch', 'WebSocket', 'XMLHttpRequest', 'EventSource', 'eval', 'Function', 'require',
  'process', 'globalThis', 'window', 'document', 'navigator', 'localStorage',
  'sessionStorage', 'indexedDB', 'caches', 'cookieStore', 'parent', 'top', 'opener',
  'postMessage', 'Worker', 'SharedWorker', 'importScripts', 'Deno', 'Bun',
]);
const ALLOWED_JSX = new Set(['AbsoluteFill', 'Sequence', 'GeneratedVideoRuntime']);

function publicText(value: string | null | undefined, max: number) {
  if (!value) return null;
  return value
    .replace(EMAIL, '[e-posta kaldırıldı]')
    .replace(PHONE, '[telefon kaldırıldı]')
    .replace(URL, '[bağlantı kaldırıldı]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || null;
}

export function sanitizeVideoPrompt(value: string) {
  return publicText(value, 1_000) ?? '';
}

export function sanitizePortfolioForVideoModel(input: {
  title: string;
  referenceCode: string | null;
  location: string | null;
  price: number | null;
  roomCount: string | null;
  area: number | null;
  description: string | null;
  features: string[];
  company: { name: string; logoUrl: string | null; instagramUrl: string | null };
  advisor: { name: string; phone: string | null; email: string | null };
  photos: Array<{ id: string; url: string; fileName: string; isCover: boolean; width?: number | null; height?: number | null }>;
}): AiVideoModelPortfolio {
  return aiVideoModelPortfolioSchema.parse({
    title: publicText(input.title, 160) || 'Portföy',
    referenceCode: publicText(input.referenceCode, 80),
    location: publicText(input.location, 160),
    priceLabel: input.price == null ? null : `${new Intl.NumberFormat('tr-TR').format(input.price)} TL`,
    roomCount: publicText(input.roomCount, 40),
    areaLabel: input.area == null ? null : `${new Intl.NumberFormat('tr-TR').format(input.area)} m²`,
    description: publicText(input.description, 1_200),
    features: input.features.map((feature) => publicText(feature, 100)).filter((value): value is string => Boolean(value)).slice(0, 5),
    companyName: publicText(input.company.name, 120) || 'Emlak şirketi',
    assets: input.photos.slice(0, 8).map((photo, index) => ({
      assetId: photo.id,
      index,
      isCover: photo.isCover,
      width: photo.width ?? null,
      height: photo.height ?? null,
    })),
  });
}

export function sanitizeGeneratedRemotionCode(source: string) {
  const code = source.replace(/^```(?:tsx?|jsx?)?\s*/i, '').replace(/```\s*$/i, '').trim();
  if (code.length < 100 || code.length > 40_000) throw new Error('Üretilen kod güvenli boyut sınırını aşıyor.');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    reportDiagnostics: true,
  });
  const diagnostics = (transpiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  if (diagnostics.length) throw new Error('Üretilen Remotion kodu derlenemedi.');
  const ast = ts.createSourceFile('generated-video.tsx', code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  let hasDefaultExport = false;
  let hasPlan = false;
  let embeddedPlan: unknown;
  const readStaticLiteral = (node: ts.Expression): unknown => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
      return -Number(node.operand.text);
    }
    if (ts.isArrayLiteralExpression(node)) return node.elements.map((element) => readStaticLiteral(element as ts.Expression));
    if (ts.isObjectLiteralExpression(node)) {
      return Object.fromEntries(node.properties.map((property) => {
        if (!ts.isPropertyAssignment(property)) throw new Error('Video planında yalnız sabit alanlar kullanılabilir.');
        const name = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
          ? property.name.text
          : null;
        if (!name) throw new Error('Video planında hesaplanan alan adı kullanılamaz.');
        return [name, readStaticLiteral(property.initializer)];
      }));
    }
    throw new Error('Video planı yalnız sabit JSON değerlerinden oluşmalıdır.');
  };
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      const moduleName = ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : '';
      const allowed = ALLOWED_IMPORTS.get(moduleName);
      if (!allowed) throw new Error(`İzin verilmeyen import: ${moduleName || 'bilinmeyen'}`);
      const clause = node.importClause;
      if (clause?.name && !allowed.has('default')) throw new Error('Bu varsayılan import izinli değil.');
      for (const element of clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : []) {
        if (!allowed.has(element.propertyName?.text ?? element.name.text)) throw new Error('İzin verilmeyen Remotion importu.');
      }
    }
    if (node.kind === ts.SyntaxKind.ImportKeyword) throw new Error('Dinamik import yasak.');
    if (ts.isIdentifier(node) && BLOCKED_IDENTIFIERS.has(node.text)) throw new Error(`İzin verilmeyen kod erişimi: ${node.text}`);
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast);
      if (!ALLOWED_JSX.has(tag)) throw new Error(`İzin verilmeyen JSX bileşeni: ${tag}`);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'videoPlan') {
      if (!node.initializer) throw new Error('Video planı kod içinde sabit olarak bulunmalıdır.');
      hasPlan = true;
      embeddedPlan = readStaticLiteral(node.initializer);
    }
    if (ts.isFunctionDeclaration(node) && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)) hasDefaultExport = true;
    if (ts.isExportAssignment(node) && !node.isExportEquals) hasDefaultExport = true;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  if (!hasDefaultExport || !hasPlan || !code.includes('GeneratedVideoRuntime') || !/GeneratedVideoRuntime[\s\S]{0,400}\bfacts\s*=/.test(code)) {
    throw new Error('Üretilen kod zorunlu güvenli video çalışma kalıbına uymuyor.');
  }
  return { code, hash: createHash('sha256').update(code).digest('hex'), transpiledCode: transpiled.outputText, embeddedPlan };
}
