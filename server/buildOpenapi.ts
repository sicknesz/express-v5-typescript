#!/usr/bin/env tsx
/**
 * generate-openapi.ts
 *
 * Analyse statiquement un répertoire de routes Express (sans annotations) et
 * génère un fichier openapi.json :
 *   - verbe + URL           : router.get('/x', ...), router.route('/x').get(...)
 *   - préfixes de montage   : app.use('/users', usersRouter) (résolus via le type-checker)
 *   - codes HTTP + schémas  : res.status(404), res.json(x), res.send(x), res.sendStatus(204),
 *                             res.render(...), res.redirect(...), res.end()
 *   - schéma des réponses   : déduit du TYPE TypeScript de l'argument de res.json(...)
 *   - bonus                 : params de chemin (:id), body / query si Request<P, Res, Body, Query> est typé
 *
 * Usage :
 *   npx tsx tools/generate-openapi.ts --routes src/routes --out openapi.json
 */
import { writeFileSync } from 'node:fs';
import { STATUS_CODES } from 'node:http';
import { relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  Node,
  Project,
  SyntaxKind,
  ts,
  type ArrowFunction,
  type CallExpression,
  type FunctionDeclaration,
  type FunctionExpression,
  type MethodDeclaration,
  type SourceFile,
  type Type,
} from 'ts-morph';

// ───────────────────────────── CLI ─────────────────────────────
const { values: opt } = parseArgs({
  options: {
    baseUrl: { type: 'string', default: 'http://localhost:3000' },
    routes: { type: 'string', default: 'controllers' },
    tsconfig: { type: 'string', default: 'tsconfig.json' },
    out: { type: 'string', default: 'openapi.json' },
    title: { type: 'string', default: 'API' },
    'api-version': { type: 'string', default: '1.0.0' },
  },
});

// ─────────────────────────── Constantes ────────────────────────
type Schema = Record<string, any>;
type Fn = ArrowFunction | FunctionExpression | FunctionDeclaration | MethodDeclaration;
type Link = { name: string; args: Node[]; call: CallExpression };
type Resp = { description: string; content: Map<string, Schema[]> };

interface RouteDef {
  verb: string;
  path: string;
  call: CallExpression;
  handlers: Node[];
  key?: string;
  file: SourceFile;
}

const VERBS = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options']);
const TERMINALS = new Set(['json', 'jsonp', 'send', 'sendStatus', 'status', 'render', 'redirect', 'end', 'sendFile', 'download']);
const ROUTER_TYPES = new Set(['Router', 'IRouter', 'Express', 'Application']);
const INLINE_NAMES = new Set(['Record', 'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Array', 'ReadonlyArray', 'Object']);

const has = (t: Type, flags: ts.TypeFlags) => (t.getFlags() & flags) !== 0;
const warn = (msg: string) => console.warn(`⚠  ${msg}`);

// ───────────────────── Convertisseur Type → JSON Schema ─────────────────────
class SchemaBuilder {
  components: Record<string, Schema> = {};
  loc!: Node; // nœud de contexte pour résoudre le type des propriétés
  private ids = new Map<number, string>();
  private taken = new Set<string>();

  convert(t: Type, depth = 0): Schema {
    if (depth > 12 || t.isAny() || t.isUnknown()) return {};
    if (has(t, ts.TypeFlags.Void | ts.TypeFlags.Undefined | ts.TypeFlags.Never)) return {};
    if (t.isNull()) return { type: 'null' };
    if (t.isBoolean()) return { type: 'boolean' };
    if (t.isBooleanLiteral()) return { type: 'boolean', const: t.getText() === 'true' };
    if (t.isStringLiteral()) return { type: 'string', const: t.getLiteralValue() };
    if (t.isNumberLiteral()) return { type: 'number', const: t.getLiteralValue() };
    if (t.isString() || t.isTemplateLiteral()) return { type: 'string' };
    if (t.isNumber()) return { type: 'number' };
    if (has(t, ts.TypeFlags.BigInt)) return { type: 'integer', format: 'int64' };
    if (t.isUnion()) return this.union(t, depth);

    const name = t.getSymbol()?.getName();
    if (name === 'Date') return { type: 'string', format: 'date-time' };
    if (name === 'Buffer' || name === 'Uint8Array') return { type: 'string', format: 'binary' };
    if (name === 'Promise') {
      const inner = t.getTypeArguments()[0];
      return inner ? this.convert(inner, depth + 1) : {};
    }
    if (t.isArray() || t.isReadonlyArray()) {
      const el = t.getArrayElementType() ?? t.getTypeArguments()[0];
      return { type: 'array', items: el ? this.convert(el, depth + 1) : {} };
    }
    if (t.isTuple()) {
      const els = t.getTupleElements();
      return {
        type: 'array',
        prefixItems: els.map((e) => this.convert(e, depth + 1)),
        minItems: els.length,
        maxItems: els.length,
      };
    }
    if (name === 'Set') {
      const el = t.getTypeArguments()[0];
      return { type: 'array', uniqueItems: true, items: el ? this.convert(el, depth + 1) : {} };
    }
    if (name === 'Map') return { type: 'object' };
    if (t.getCallSignatures().length) return {};

    // Les types avec toJSON() (Date, Decimal, ObjectId...) sont sérialisés via leur retour
    const toJSON = t.getProperty('toJSON');
    const sig = toJSON?.getTypeAtLocation(this.loc).getCallSignatures()[0];
    if (sig) return this.convert(sig.getReturnType(), depth + 1);

    if (t.isObject() || t.isIntersection()) return this.object(t, depth);
    return {};
  }

  private union(t: Type, depth: number): Schema {
    const members = t.getUnionTypes().filter((m) => !has(m, ts.TypeFlags.Void | ts.TypeFlags.Undefined | ts.TypeFlags.Never));
    const out: Schema[] = [];
    const strs: string[] = [];
    const nums: number[] = [];
    let yes = false, no = false, nullable = false;
    for (const m of members) {
      if (m.isNull()) nullable = true;
      else if (m.isStringLiteral()) strs.push(m.getLiteralValue() as string);
      else if (m.isNumberLiteral()) nums.push(m.getLiteralValue() as number);
      else if (m.isBooleanLiteral()) m.getText() === 'true' ? (yes = true) : (no = true);
      else out.push(this.convert(m, depth + 1));
    }
    if (strs.length) out.push({ type: 'string', enum: strs });
    if (nums.length) out.push({ type: 'number', enum: nums });
    if (yes && no) out.push({ type: 'boolean' });
    else if (yes || no) out.push({ type: 'boolean', const: yes });
    if (nullable) out.push({ type: 'null' });
    const uniq = out.filter((s, i) => out.findIndex((o) => JSON.stringify(o) === JSON.stringify(s)) === i);
    return uniq.length === 0 ? {} : uniq.length === 1 ? uniq[0] : { anyOf: uniq };
  }

  private object(t: Type, depth: number): Schema {
    const name = this.componentName(t);
    if (!name) return this.body(t, depth);
    const id = (t.compilerType as any).id as number;
    let ref = this.ids.get(id);
    if (!ref) {
      ref = name;
      for (let i = 2; this.taken.has(ref); i++) ref = `${name}${i}`;
      this.taken.add(ref);
      this.ids.set(id, ref);
      this.components[ref] = {}; // placeholder : gère les types récursifs
      this.components[ref] = this.body(t, depth);
    }
    return { $ref: `#/components/schemas/${ref}` };
  }

  private body(t: Type, depth: number): Schema {
    const properties: Record<string, Schema> = {};
    const required: string[] = [];
    for (const p of t.getProperties()) {
      const n = p.getName();
      if (n.startsWith('__@')) continue;
      const pt = p.getTypeAtLocation(this.loc);
      if (pt.getCallSignatures().length) continue;
      properties[n] = this.convert(pt, depth + 1);
      const optional =
        p.hasFlags(ts.SymbolFlags.Optional) ||
        has(pt, ts.TypeFlags.Undefined) ||
        (pt.isUnion() && pt.getUnionTypes().some((u) => has(u, ts.TypeFlags.Undefined)));
      if (!optional) required.push(n);
    }
    const schema: Schema = { type: 'object' };
    if (Object.keys(properties).length) schema.properties = properties;
    if (required.length) schema.required = required;
    const idx = t.getStringIndexType();
    if (idx) schema.additionalProperties = this.convert(idx, depth + 1);
    return schema;
  }

  /** Nom de composant pour les interfaces / classes / alias déclarés dans le projet, sinon inline. */
  private componentName(t: Type): string | undefined {
    const sym = t.getAliasSymbol() ?? t.getSymbol();
    const n = sym?.getName();
    if (!sym || !n || n.startsWith('__') || INLINE_NAMES.has(n)) return;
    const decl = sym.getDeclarations()[0];
    if (!decl || decl.getSourceFile().isInNodeModules() || decl.getSourceFile().isDeclarationFile()) return;
    const args = t.getAliasTypeArguments().length ? t.getAliasTypeArguments() : t.getTypeArguments();
    const label = (a: Type) => {
      const s = a.getAliasSymbol()?.getName() ?? a.getSymbol()?.getName() ?? a.getText().replace(/\W/g, '');
      return s.charAt(0).toUpperCase() + s.slice(1);
    };
    return n + args.map(label).join('');
  }
}

// ───────────────────────── Helpers AST ─────────────────────────
/** Valeur string d'une expression (littéral, template, ou constante au type littéral). */
function strValue(n?: Node): string | undefined {
  if (!n) return;
  if (Node.isStringLiteral(n) || Node.isNoSubstitutionTemplateLiteral(n)) return n.getLiteralValue();
  if (Node.isTemplateExpression(n)) {
    let s = n.getHead().getLiteralText();
    for (const span of n.getTemplateSpans()) {
      const v = strValue(span.getExpression());
      if (v === undefined) return;
      s += v + span.getLiteral().getLiteralText();
    }
    return s;
  }
  const t = n.getType();
  return t.isStringLiteral() ? (t.getLiteralValue() as string) : undefined;
}

function pathsOf(n?: Node): string[] | undefined {
  if (!n) return;
  if (Node.isArrayLiteralExpression(n)) {
    const v = n.getElements().map(strValue);
    return v.every((x) => x !== undefined) ? (v as string[]) : undefined;
  }
  const s = strValue(n);
  return s === undefined ? undefined : [s];
}

function numOf(n?: Node): number | undefined {
  const v = n?.getType().getLiteralValue();
  return typeof v === 'number' ? v : undefined;
}

function isRouterLike(n: Node): boolean {
  const t = n.getType();
  const name = t.getSymbol()?.getName() ?? t.getAliasSymbol()?.getName();
  if (name && ROUTER_TYPES.has(name)) return true;
  // Repli si les types express ne sont pas résolus
  return t.isAny() && Node.isIdentifier(n) && /^(router|app|api|server)\w*$/i.test(n.getText());
}

/** Identité stable de la variable désignée (suit les imports / export default). */
function keyOf(n: Node): string | undefined {
  if (!Node.isIdentifier(n)) return;
  let d: Node | undefined = n.getDefinitionNodes()[0];
  while (d && Node.isExportAssignment(d)) {
    const e = d.getExpression();
    d = Node.isIdentifier(e) ? e.getDefinitionNodes()[0] : undefined;
  }
  return d ? `${d.getSourceFile().getFilePath()}#${d.getPos()}` : undefined;
}

/** router.route('/x').get(...).post(...) → { paths, root } */
function routeChain(n: Node): { paths?: string[]; root: Node } | undefined {
  let cur = n;
  while (Node.isCallExpression(cur)) {
    const c = cur.getExpression();
    if (!Node.isPropertyAccessExpression(c)) return;
    if (c.getName() === 'route') return { paths: pathsOf(cur.getArguments()[0]), root: c.getExpression() };
    cur = c.getExpression();
  }
}

/** Résout un argument de route vers les fonctions handlers (inline, référencées, wrappées, tableaux). */
function resolveFns(n: Node, depth = 0): Fn[] {
  if (depth > 3) return [];
  if (Node.isArrowFunction(n) || Node.isFunctionExpression(n)) return [n];
  if (Node.isArrayLiteralExpression(n)) return n.getElements().flatMap((e) => resolveFns(e, depth + 1));
  if (Node.isCallExpression(n)) return n.getArguments().flatMap((a) => resolveFns(a, depth + 1)); // asyncHandler(fn)
  if (Node.isIdentifier(n) || Node.isPropertyAccessExpression(n)) {
    const id = Node.isPropertyAccessExpression(n) ? n.getNameNode() : n;
    return id.getDefinitionNodes().flatMap((d): Fn[] => {
      if (Node.isFunctionDeclaration(d) || Node.isMethodDeclaration(d)) return [d];
      if (Node.isVariableDeclaration(d) || Node.isPropertyAssignment(d)) {
        const init = d.getInitializer();
        return init ? resolveFns(init, depth + 1) : [];
      }
      return [];
    });
  }
  return [];
}

/** Décompose res.status(404).json(x) en [{status},{json}] si la racine est bien `res`. */
function chainOf(call: CallExpression, res: string): Link[] | undefined {
  const links: Link[] = [];
  let cur: Node = call;
  while (Node.isCallExpression(cur)) {
    const c = cur.getExpression();
    if (!Node.isPropertyAccessExpression(c)) return;
    links.unshift({ name: c.getName(), args: cur.getArguments(), call: cur });
    cur = c.getExpression();
  }
  return Node.isIdentifier(cur) && cur.getText() === res ? links : undefined;
}

function leadingComment(call: Node): string | undefined {
  const st = call.getFirstAncestor((a) => Node.isExpressionStatement(a));
  const last = st?.getLeadingCommentRanges().at(-1);
  if (!last) return;
  return (
    last
      .getText()
      .replace(/^\/\*+|\*+\/$/g, '')
      .replace(/^\s*\*+ ?/gm, '')
      .replace(/^\/\/\s?/gm, '')
      .trim() || undefined
  );
}

function useful(t?: Type): t is Type {
  if (!t || t.isAny() || t.isUnknown()) return false;
  const n = t.getSymbol()?.getName() ?? t.getAliasSymbol()?.getName();
  if (n === 'ParsedQs' || n === 'ParamsDictionary') return false;
  return !(t.isObject() && !t.getProperties().length && !t.getStringIndexType());
}

// ─────────────────── Analyse du corps d'un handler ───────────────────
function collectResponses(fn: Fn, res: string, resBodyT: Type | undefined, out: Map<string, Resp>, sb: SchemaBuilder) {
  const add = (code: number | string, media?: string, schema?: Schema, desc?: string) => {
    const k = String(code);
    const r = out.get(k) ?? { description: desc ?? STATUS_CODES[Number(k)] ?? 'Default response', content: new Map() };
    out.set(k, r);
    if (!media) return;
    const list = r.content.get(media) ?? [];
    const s = schema ?? {};
    if (!list.some((x) => JSON.stringify(x) === JSON.stringify(s))) list.push(s);
    r.content.set(media, list);
  };

  const schemaOf = (arg?: Node): Schema => {
    if (!arg) return {};
    sb.loc = arg;
    let t = arg.getType();
    if (t.isAny() && useful(resBodyT)) t = resBodyT;
    return sb.convert(t);
  };

  // Toutes les chaînes `res.xxx(...).yyy(...)` (uniquement la plus externe de chaque chaîne)
  const chains: Link[][] = [];
  for (const call of fn.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const p = call.getParent();
    if (Node.isPropertyAccessExpression(p) && p.getExpression() === call) continue;
    const c = chainOf(call, res);
    if (c) chains.push(c);
  }

  const statusOf = (chain: Link[]) => {
    const l = [...chain].reverse().find((x) => x.name === 'status');
    return l ? { code: numOf(l.args[0]) ?? 'default' } : undefined;
  };

  // `res.status(404);` seul, suivi plus loin d'un `res.json()` dans le même bloc
  const consumed = new Set<Node>();
  const pendingStatus = (from: Node): number | undefined => {
    const st = from.getFirstAncestor((a) => Node.isExpressionStatement(a) || Node.isReturnStatement(a));
    const parent = st?.getParent();
    if (!st || !parent) return;
    if (!(Node.isBlock(parent) || Node.isCaseClause(parent) || Node.isDefaultClause(parent) || Node.isSourceFile(parent))) return;
    for (const s of st.getPreviousSiblings().sort((a, b) => b.getPos() - a.getPos())) {
      if (!Node.isExpressionStatement(s)) continue;
      const e = s.getExpression();
      if (!Node.isCallExpression(e)) continue;
      const ch = chainOf(e, res);
      const last = ch?.at(-1);
      if (last?.name === 'status') {
        consumed.add(e);
        return numOf(last.args[0]);
      }
    }
  };

  // 1) chaînes terminales : json / send / sendStatus / render / redirect / end ...
  for (const chain of chains) {
    const term = chain.at(-1)!;
    if (!TERMINALS.has(term.name)) continue;

    let code: number | string | undefined = statusOf(chain)?.code;
    if (code === undefined) {
      if (term.name === 'sendStatus') code = numOf(term.args[0]) ?? 'default';
      else if (term.name === 'redirect') code = numOf(term.args[0]) ?? 302;
      else code = pendingStatus(term.call) ?? 200;
    }

    const arg = term.args[0];
    switch (term.name) {
      case 'json':
      case 'jsonp':
        add(code, 'application/json', schemaOf(arg));
        break;
      case 'send': {
        const t = arg?.getType();
        if (!t) add(code);
        else if (t.isString() || t.isStringLiteral() || t.isTemplateLiteral()) add(code, 'text/html', { type: 'string' });
        else if (t.getSymbol()?.getName() === 'Buffer') add(code, 'application/octet-stream', { type: 'string', format: 'binary' });
        else add(code, 'application/json', schemaOf(arg));
        break;
      }
      case 'sendStatus':
        add(code, 'text/plain', { type: 'string' });
        break;
      case 'render':
        add(code, 'text/html', { type: 'string' }, `Rendered view "${strValue(arg) ?? '?'}"`);
        break;
      case 'sendFile':
      case 'download':
        add(code, 'application/octet-stream', { type: 'string', format: 'binary' });
        break;
      default: // redirect, end
        add(code);
    }
  }

  // 2) `res.status(404);` isolé, jamais suivi d'un terminal → réponse sans corps
  for (const chain of chains) {
    const last = chain.at(-1)!;
    if (TERMINALS.has(last.name) || consumed.has(last.call)) continue;
    const st = statusOf(chain);
    if (st) add(st.code);
  }
}

// ───────────────────────────── Main ─────────────────────────────
const project = new Project({ tsConfigFilePath: resolve(opt.tsconfig!) });
const routesDir = resolve(opt.routes!).replace(/\\/g, '/');
project.addSourceFilesAtPaths([`${routesDir}/**/*.ts`, `!${routesDir}/**/*.{test,spec}.ts`, '!**/*.d.ts']);
const inRoutes = (sf: SourceFile) => sf.getFilePath().startsWith(routesDir + '/');

const routes: RouteDef[] = [];
const mounts = new Map<string, { parent: string; prefix: string }[]>();

for (const sf of project.getSourceFiles()) {
  if (sf.isInNodeModules() || sf.isDeclarationFile()) continue;

  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) continue;
    const method = callee.getName();
    const recv = callee.getExpression();
    const args = call.getArguments();

    // app.use('/users', usersRouter) → table de montage (dans tout le projet)
    if (method === 'use' && args.length && isRouterLike(recv)) {
      const child = keyOf(args[args.length - 1]);
      const parent = keyOf(recv);
      if (child && parent) {
        const prefix = args.length > 1 ? (strValue(args[0]) ?? '') : '';
        if (!mounts.has(child)) mounts.set(child, []);
        mounts.get(child)!.push({ parent, prefix });
      }
      continue;
    }

    // router.get(...) / router.route('/x').get(...) (uniquement dans le dossier routes)
    if (!VERBS.has(method) || !inRoutes(sf)) continue;
    let paths: string[] | undefined;
    let handlers: Node[] = args;
    let root = recv;
    const chain = routeChain(recv);
    if (chain) {
      paths = chain.paths;
      root = chain.root;
      if (!isRouterLike(root)) continue;
    } else if (isRouterLike(recv)) {
      paths = pathsOf(args[0]);
      handlers = args.slice(1);
      if (!paths && handlers.length) warn(`${relative(process.cwd(), sf.getFilePath())}:${call.getStartLineNumber()} URL non résolvable statiquement, route ignorée`);
    } else continue;
    if (!paths || !handlers.length) continue; // ex: app.get('port')

    for (const path of paths) routes.push({ verb: method, path, call, handlers, key: keyOf(root), file: sf });
  }
}

function prefixesOf(key: string | undefined, seen = new Set<string>()): string[] {
  const parents = key ? mounts.get(key) : undefined;
  if (!key || !parents || seen.has(key)) return [''];
  return parents.flatMap((m) => prefixesOf(m.parent, new Set([...seen, key])).map((p) => p + m.prefix));
}

const joinPaths = (...p: string[]) => {
  const s = ('/' + p.join('/')).replace(/\/+/g, '/');
  return s.length > 1 ? s.replace(/\/$/, '') : s;
};
const toOpenApiPath = (p: string) =>
  p
    .replace(/:([A-Za-z0-9_]+)(\([^)]*\))?\??/g, '{$1}')
    .replace(/\/\*([A-Za-z0-9_]*)/g, (_, n) => `/{${n || 'wildcard'}}`);
const pascal = (s: string) => s.replace(/(^|[^A-Za-z0-9]+)([A-Za-z0-9])/g, (_, __, c) => c.toUpperCase());

const sb = new SchemaBuilder();
const paths: Record<string, Record<string, any>> = {};
const operationIds = new Set<string>();
let count = 0;

for (const r of routes) {
  sb.loc = r.call;
  const responses = new Map<string, Resp>();
  let body: Schema | undefined;
  const query: any[] = [];

  for (const fn of [...new Set(r.handlers.flatMap((h) => resolveFns(h)))]) {
    const ps = fn.getParameters();
    const ri = ps.length === 4 ? 2 : 1; // (err, req, res, next) vs (req, res, next)
    const reqParam = ps[ri - 1];
    const resParam = ps[ri];
    sb.loc = fn;

    // Request<Params, ResBody, ReqBody, ReqQuery> typé → body & query
    const rt = reqParam?.getType().getTypeArguments() ?? [];
    if (!body && useful(rt[2]) && ['post', 'put', 'patch', 'delete'].includes(r.verb)) body = sb.convert(rt[2]);
    if (!query.length && useful(rt[3]) && rt[3].isObject()) {
      for (const p of rt[3].getProperties()) {
        query.push({
          name: p.getName(),
          in: 'query',
          required: !p.hasFlags(ts.SymbolFlags.Optional),
          schema: sb.convert(p.getTypeAtLocation(fn)),
        });
      }
    }

    if (!resParam || !Node.isIdentifier(resParam.getNameNode())) continue;
    collectResponses(fn, resParam.getName(), resParam.getType().getTypeArguments()[0], responses, sb);
  }

  const rel = relative(routesDir, r.file.getFilePath()).replace(/\\/g, '/').replace(/\.ts$/, '');
  const tag = rel.replace(/(^|\/)index$/, '') || 'index';
  const comment = leadingComment(r.call)?.split('\n');

  for (const prefix of prefixesOf(r.key)) {
    const expressPath = joinPaths(prefix, r.path);
    const oasPath = toOpenApiPath(expressPath);
    let opId = r.verb + (pascal(oasPath.replace(/\{(\w+)\}/g, 'By-$1')) || 'Root');
    for (let i = 2; operationIds.has(opId); i++) opId = `${opId}${i}`;
    operationIds.add(opId);

    const pathParams = [...oasPath.matchAll(/\{(\w+)\}/g)].map((m) => ({
      name: m[1], in: 'path', required: true, schema: { type: 'string' },
    }));

    const respObj: Record<string, any> = {};
    for (const k of [...responses.keys()].sort()) {
      const resp = responses.get(k)!;
      const content: Record<string, any> = {};
      for (const [media, list] of resp.content) content[media] = { schema: list.length === 1 ? list[0] : { anyOf: list } };
      respObj[k] = { description: resp.description, ...(Object.keys(content).length ? { content } : {}) };
    }

    (paths[oasPath] ??= {})[r.verb] = {
      ...(comment?.[0] ? { summary: comment[0] } : {}),
      ...(comment && comment.length > 1 ? { description: comment.slice(1).join('\n').trim() } : {}),
      operationId: opId,
      tags: [tag],
      ...([...pathParams, ...query].length ? { parameters: [...pathParams, ...query] } : {}),
      ...(body ? { requestBody: { required: true, content: { 'application/json': { schema: body } } } } : {}),
      responses: Object.keys(respObj).length ? respObj : { default: { description: 'Response not statically detected' } },
    };
    count++;
  }
}

const doc = {
  openapi: '3.1.0',
  info: { title: opt.title, version: opt['api-version'] },
  servers: [{
    url: opt.baseUrl
  }],
  paths: Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b))),
  ...(Object.keys(sb.components).length ? { components: { schemas: sb.components } } : {}),
};

writeFileSync(resolve(opt.out!), JSON.stringify(doc, null, 2));
console.log(`✔ ${count} opération(s) dans ${Object.keys(paths).length} chemin(s) → ${opt.out}`);