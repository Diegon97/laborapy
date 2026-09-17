/**
 * MOTOR SEGURO DE FÓRMULAS Y EVALUADOR SINTÁCTICO (ERP LABORAPY)
 *
 * Pipeline seguro 100% puro sin eval() ni new Function():
 *   Fórmula -> Tokenizer -> Recursive Descent Parser -> AST -> Evaluador
 *
 * Características:
 *   - Operadores aritméticos : + - * / % ^
 *   - Operadores relacionales: > < >= <= == != <>
 *   - Operadores lógicos     : AND OR NOT (con evaluación lazy / cortocircuito)
 *   - Funciones integradas   : SUM, AVG, MIN, MAX, ROUND, FLOOR, CEIL, ABS, IF, AND, OR, NOT
 *   - Referencias a columnas : [Nombre Columna] o [id] (búsqueda insensible a mayúsculas)
 *   - Detección de ciclos    : Pila recursiva defensiva (previene loops infinitos en referencias cruzadas)
 *   - Protección estricta    : División por cero -> 0, prevención de Prototype Pollution (__proto__, etc.)
 *   - Cálculo rápido celda   : evaluateCellMath("=150000+50000") para inputs de planilla
 */

export type FormulaValue = number | string | boolean | null | undefined;
import { findVariableByCodigo } from '../types/payrollConceptsCatalog';

export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'IDENT'
  | 'REF'
  | 'OP'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

/* ===========================================================================
 * NODOS AST
 * ========================================================================= */

export interface NumberNode {
  type: 'Number';
  value: number;
}

export interface StringNode {
  type: 'String';
  value: string;
}

export interface BooleanNode {
  type: 'Boolean';
  value: boolean;
}

export interface RefNode {
  type: 'Ref';
  name: string;
}

export interface UnaryNode {
  type: 'Unary';
  op: '+' | '-' | 'NOT';
  operand: ASTNode;
}

export interface BinaryNode {
  type: 'Binary';
  op: '+' | '-' | '*' | '/' | '%' | '^' | '>' | '<' | '>=' | '<=' | '==' | '!=' | 'AND' | 'OR';
  left: ASTNode;
  right: ASTNode;
}

export interface CallNode {
  type: 'Call';
  name: string;
  args: ASTNode[];
}

export type ASTNode =
  | NumberNode
  | StringNode
  | BooleanNode
  | RefNode
  | UnaryNode
  | BinaryNode
  | CallNode;

export class FormulaSyntaxError extends Error {
  public readonly pos: number;
  constructor(message: string, pos = 0) {
    super(`${message} (posición ${pos})`);
    this.name = 'FormulaSyntaxError';
    this.pos = pos;
  }
}

/* ===========================================================================
 * TOKENIZER
 * ========================================================================= */

const NUMBER_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;
const IDENT_PATTERN = /^[A-Za-z_ñÑáéíóúÁÉÍÓÚ][A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ]*/;
const TWO_CHAR_OPS = ['>=', '<=', '==', '!=', '<>'];

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\u00a0';
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    if (isWhitespace(ch)) {
      i++;
      continue;
    }

    // Referencia de columna entre corchetes [Columna]
    if (ch === '[') {
      const close = input.indexOf(']', i + 1);
      if (close === -1) {
        throw new FormulaSyntaxError('Referencia de columna sin cerrar con "]"', i);
      }
      const name = input.slice(i + 1, close).trim();
      if (name === '') {
        throw new FormulaSyntaxError('Nombre de columna vacío entre corchetes', i);
      }
      tokens.push({ type: 'REF', value: name, pos: i });
      i = close + 1;
      continue;
    }

    // String literals entre comillas dobles o simples
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let val = '';
      while (j < len && input[j] !== quote) {
        if (input[j] === '\\' && j + 1 < len) {
          val += input[j + 1];
          j += 2;
          continue;
        }
        val += input[j];
        j++;
      }
      if (j >= len) {
        throw new FormulaSyntaxError('Cadena de texto sin cerrar', i);
      }
      tokens.push({ type: 'STRING', value: val, pos: i });
      i = j + 1;
      continue;
    }

    // Números
    const rest = input.slice(i);
    const numMatch = NUMBER_PATTERN.exec(rest);
    if (numMatch) {
      tokens.push({ type: 'NUMBER', value: numMatch[0], pos: i });
      i += numMatch[0].length;
      continue;
    }

    // Identificadores (funciones, booleanos)
    const idMatch = IDENT_PATTERN.exec(rest);
    if (idMatch) {
      tokens.push({ type: 'IDENT', value: idMatch[0], pos: i });
      i += idMatch[0].length;
      continue;
    }

    // Operadores de 2 caracteres
    const two = input.slice(i, i + 2);
    if (TWO_CHAR_OPS.includes(two)) {
      tokens.push({ type: 'OP', value: two === '<>' ? '!=' : two, pos: i });
      i += 2;
      continue;
    }

    // Paréntesis y comas
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', pos: i });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', pos: i });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ',', pos: i });
      i++;
      continue;
    }

    // Operadores de 1 carácter
    if ('+-*/%^><!'.includes(ch)) {
      tokens.push({ type: 'OP', value: ch === '!' ? 'NOT' : ch, pos: i });
      i++;
      continue;
    }

    if (ch === '=') {
      tokens.push({ type: 'OP', value: '==', pos: i });
      i++;
      continue;
    }

    throw new FormulaSyntaxError(`Carácter no reconocido "${ch}"`, i);
  }

  tokens.push({ type: 'EOF', value: '', pos: i });
  return tokens;
}

/* ===========================================================================
 * PARSER (RECURSIVE DESCENT)
 * Precedencia:
 *   OR < AND < Comparación (==, !=, <, >, <=, >=) <
 *   Aditiva (+, -) < Multiplicativa (*, /, %) < Potencia (^) < Unaria (+, -, NOT) < Primaria
 * ========================================================================= */

export class FormulaParser {
  private pos = 0;
  private readonly tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public parse(): ASTNode {
    if (this.peek().type === 'EOF') {
      throw new FormulaSyntaxError('Expresión vacía', 0);
    }
    const node = this.parseExpression();
    if (this.peek().type !== 'EOF') {
      throw new FormulaSyntaxError(`Token inesperado "${this.peek().value}"`, this.peek().pos);
    }
    return node;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const t = this.tokens[this.pos];
    if (t.type !== 'EOF') this.pos++;
    return t;
  }

  private matchOp(...ops: string[]): string | null {
    const t = this.peek();
    if ((t.type === 'OP' || t.type === 'IDENT') && ops.includes(t.value.toUpperCase())) {
      this.pos++;
      return t.value.toUpperCase();
    }
    return null;
  }

  private expect(type: TokenType): Token {
    const t = this.peek();
    if (t.type !== type) {
      throw new FormulaSyntaxError(`Se esperaba "${type}" pero se encontró "${t.value}"`, t.pos);
    }
    this.pos++;
    return t;
  }

  private parseExpression(): ASTNode {
    return this.parseLogicalOr();
  }

  private parseLogicalOr(): ASTNode {
    let left = this.parseLogicalAnd();
    for (;;) {
      const op = this.matchOp('OR');
      if (!op) break;
      const right = this.parseLogicalAnd();
      left = { type: 'Binary', op: 'OR', left, right };
    }
    return left;
  }

  private parseLogicalAnd(): ASTNode {
    let left = this.parseComparison();
    for (;;) {
      const op = this.matchOp('AND');
      if (!op) break;
      const right = this.parseComparison();
      left = { type: 'Binary', op: 'AND', left, right };
    }
    return left;
  }

  private parseComparison(): ASTNode {
    let left = this.parseAdditive();
    for (;;) {
      const op = this.matchOp('==', '!=', '<=', '>=', '<', '>');
      if (!op) break;
      const right = this.parseAdditive();
      left = { type: 'Binary', op: op as BinaryNode['op'], left, right };
    }
    return left;
  }

  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative();
    for (;;) {
      const op = this.matchOp('+', '-');
      if (!op) break;
      const right = this.parseMultiplicative();
      left = { type: 'Binary', op: op as '+' | '-', left, right };
    }
    return left;
  }

  private parseMultiplicative(): ASTNode {
    let left = this.parsePower();
    for (;;) {
      const op = this.matchOp('*', '/', '%');
      if (!op) break;
      const right = this.parsePower();
      left = { type: 'Binary', op: op as '*' | '/' | '%', left, right };
    }
    return left;
  }

  private parsePower(): ASTNode {
    const base = this.parseUnary();
    if (this.matchOp('^')) {
      const exponent = this.parsePower(); // Asociatividad por derecha
      return { type: 'Binary', op: '^', left: base, right: exponent };
    }
    return base;
  }

  private parseUnary(): ASTNode {
    const t = this.peek();
    if (t.type === 'OP' && (t.value === '-' || t.value === '+')) {
      this.advance();
      return { type: 'Unary', op: t.value as '+' | '-', operand: this.parseUnary() };
    }
    if ((t.type === 'OP' && t.value === 'NOT') || (t.type === 'IDENT' && t.value.toUpperCase() === 'NOT')) {
      if (this.tokens[this.pos + 1]?.type !== 'LPAREN') {
        this.advance();
        return { type: 'Unary', op: 'NOT', operand: this.parseUnary() };
      }
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    const t = this.peek();

    if (t.type === 'NUMBER') {
      this.advance();
      return { type: 'Number', value: Number(t.value) || 0 };
    }

    if (t.type === 'STRING') {
      this.advance();
      return { type: 'String', value: t.value };
    }

    if (t.type === 'REF') {
      this.advance();
      return { type: 'Ref', name: t.value };
    }

    if (t.type === 'LPAREN') {
      this.advance();
      const expr = this.parseExpression();
      this.expect('RPAREN');
      return expr;
    }

    if (t.type === 'IDENT') {
      this.advance();
      const upper = t.value.toUpperCase();

      if (this.peek().type === 'LPAREN') {
        this.advance();
        const args: ASTNode[] = [];
        if (this.peek().type !== 'RPAREN') {
          args.push(this.parseExpression());
          while (this.peek().type === 'COMMA') {
            this.advance();
            args.push(this.parseExpression());
          }
        }
        this.expect('RPAREN');
        return { type: 'Call', name: upper, args };
      }

      if (upper === 'TRUE') return { type: 'Boolean', value: true };
      if (upper === 'FALSE') return { type: 'Boolean', value: false };

      return { type: 'Ref', name: t.value };
    }

    throw new FormulaSyntaxError(`Token inesperado "${t.value || t.type}"`, t.pos);
  }
}

export function parseFormula(formula: string): ASTNode {
  const tokens = tokenize(formula);
  const parser = new FormulaParser(tokens);
  return parser.parse();
}

/* ===========================================================================
 * EVALUADOR
 * ========================================================================= */

interface EvalContext {
  rowValues: Record<string, any>;
  visited: Set<string>;
}

function safeGet(obj: Record<string, any>, key: string): any {
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];

  const target = key.toLowerCase().replace(/[\s_-]+/g, '');
  for (const k of Object.keys(obj)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    if (k.toLowerCase().replace(/[\s_-]+/g, '') === target) {
      return obj[k];
    }
  }
  return undefined;
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s === '') return 0;
    const cleaned = s.replace(/Gs\.?|₲/gi, '').trim();
    if (/^-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(cleaned)) {
      const standard = cleaned.replace(/\./g, '').replace(',', '.');
      const num = Number(standard);
      return Number.isFinite(num) ? num : 0;
    }
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
}

function isTruthy(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) && v !== 0;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    return t !== '' && t !== '0' && t !== 'false' && t !== 'null' && t !== 'undefined';
  }
  return !!v;
}

function resolveReference(name: string, ctx: EvalContext): any {
  const normKey = name.toLowerCase().trim();

  if (ctx.visited.has(normKey)) {
    return 0;
  }

  const rawVal = safeGet(ctx.rowValues, name);
  if (rawVal === undefined || rawVal === null) {
    const defVar = findVariableByCodigo(name);
    if (defVar?.formulaDefault) {
      return evaluateFormula(defVar.formulaDefault, ctx.rowValues, ctx.visited);
    }
    return 0;
  }

  if (typeof rawVal === 'string' && rawVal.trim().startsWith('=')) {
    ctx.visited.add(normKey);
    try {
      const subExpr = rawVal.trim().slice(1).trim();
      if (subExpr === '') return 0;
      const subAst = parseFormula(subExpr);
      return evalNode(subAst, ctx);
    } catch {
      return 0;
    } finally {
      ctx.visited.delete(normKey);
    }
  }

  if (typeof rawVal === 'number' || typeof rawVal === 'boolean') return rawVal;
  return rawVal;
}

function evalNode(node: ASTNode, ctx: EvalContext): any {
  switch (node.type) {
    case 'Number':
      return node.value;
    case 'String':
      return node.value;
    case 'Boolean':
      return node.value;
    case 'Ref':
      return resolveReference(node.name, ctx);

    case 'Unary': {
      if (node.op === 'NOT') {
        const val = evalNode(node.operand, ctx);
        return isTruthy(val) ? 0 : 1;
      }
      const num = toNumber(evalNode(node.operand, ctx));
      return node.op === '-' ? -num : num;
    }

    case 'Binary': {
      if (node.op === 'AND') {
        const leftVal = evalNode(node.left, ctx);
        if (!isTruthy(leftVal)) return 0;
        const rightVal = evalNode(node.right, ctx);
        return isTruthy(rightVal) ? 1 : 0;
      }
      if (node.op === 'OR') {
        const leftVal = evalNode(node.left, ctx);
        if (isTruthy(leftVal)) return 1;
        const rightVal = evalNode(node.right, ctx);
        return isTruthy(rightVal) ? 1 : 0;
      }

      const left = evalNode(node.left, ctx);
      const right = evalNode(node.right, ctx);

      if (node.op === '+') {
        if (typeof left === 'string' && isNaN(Number(left))) {
          return left + String(right);
        }
        if (typeof right === 'string' && isNaN(Number(right))) {
          return String(left) + right;
        }
        return toNumber(left) + toNumber(right);
      }

      const a = toNumber(left);
      const b = toNumber(right);

      switch (node.op) {
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          return b === 0 ? 0 : a / b;
        case '%':
          return b === 0 ? 0 : a % b;
        case '^':
          return Math.pow(a, b);
        case '>':
          return a > b ? 1 : 0;
        case '<':
          return a < b ? 1 : 0;
        case '>=':
          return a >= b ? 1 : 0;
        case '<=':
          return a <= b ? 1 : 0;
        case '==':
          return String(left).toLowerCase() === String(right).toLowerCase() || a === b ? 1 : 0;
        case '!=':
          return String(left).toLowerCase() !== String(right).toLowerCase() && a !== b ? 1 : 0;
      }
      return 0;
    }

    case 'Call': {
      const fn = node.name.toUpperCase();

      if (fn === 'IF') {
        if (node.args.length < 2) return 0;
        const cond = evalNode(node.args[0], ctx);
        if (isTruthy(cond)) {
          return evalNode(node.args[1], ctx);
        }
        return node.args.length > 2 ? evalNode(node.args[2], ctx) : 0;
      }

      if (fn === 'AND') {
        for (const arg of node.args) {
          if (!isTruthy(evalNode(arg, ctx))) return 0;
        }
        return node.args.length > 0 ? 1 : 0;
      }
      if (fn === 'OR') {
        for (const arg of node.args) {
          if (isTruthy(evalNode(arg, ctx))) return 1;
        }
        return 0;
      }
      if (fn === 'NOT') {
        if (node.args.length === 0) return 0;
        return isTruthy(evalNode(node.args[0], ctx)) ? 0 : 1;
      }

      const numArgs = node.args.map((arg) => toNumber(evalNode(arg, ctx)));

      switch (fn) {
        case 'SUM':
          return numArgs.reduce((acc, curr) => acc + curr, 0);

        case 'AVG':
        case 'AVERAGE': {
          if (numArgs.length === 0) return 0;
          const sum = numArgs.reduce((acc, curr) => acc + curr, 0);
          return sum / numArgs.length;
        }

        case 'MIN':
          return numArgs.length === 0 ? 0 : Math.min(...numArgs);

        case 'MAX':
          return numArgs.length === 0 ? 0 : Math.max(...numArgs);

        case 'ROUND': {
          if (numArgs.length === 0) return 0;
          const val = numArgs[0];
          const decimals = numArgs.length > 1 ? Math.max(0, Math.min(10, Math.round(numArgs[1]))) : 0;
          const factor = Math.pow(10, decimals);
          return Math.round(val * factor) / factor;
        }

        case 'FLOOR':
          return numArgs.length === 0 ? 0 : Math.floor(numArgs[0]);

        case 'CEIL':
        case 'CEILING':
          return numArgs.length === 0 ? 0 : Math.ceil(numArgs[0]);

        case 'ABS':
          return numArgs.length === 0 ? 0 : Math.abs(numArgs[0]);

        default:
          return 0;
      }
    }
  }
}

/* ===========================================================================
 * FUNCIONES PÚBLICAS PRINCIPALES
 * ========================================================================= */

/**
 * Evalúa una fórmula de planilla con soporte para referencias de columnas,
 * operadores, funciones integradas y prevención de ciclos.
 */
export function evaluateFormula(
  formula: string,
  rowValues: Record<string, any> = {},
  visited?: Set<string>,
): number | string {
  if (typeof formula !== 'string') return 0;

  let expr = formula.trim();
  if (expr.startsWith('=')) expr = expr.slice(1).trim();
  if (expr === '') return 0;

  try {
    const ast = parseFormula(expr);
    const ctx: EvalContext = {
      rowValues: rowValues ?? {},
      visited: visited ? new Set(visited) : new Set<string>(),
    };
    const res = evalNode(ast, ctx);

    if (typeof res === 'number') {
      return Number.isFinite(res) ? res : 0;
    }
    if (typeof res === 'string') {
      return res;
    }
    if (typeof res === 'boolean') {
      return res ? 1 : 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Evalúa una expresión matemática simple ingresada directamente en una celda
 * editable (ej. "=150000+50000" o "50000*3").
 *
 * Rechaza referencias a columnas y cadenas de texto no matemáticas.
 * Retorna el resultado numérico o null si no es válida.
 */
export function evaluateCellMath(expression: string): number | null {
  if (typeof expression !== 'string') return null;

  let expr = expression.trim();
  if (expr.startsWith('=')) expr = expr.slice(1).trim();
  if (expr === '') return null;

  // Rechazar si contiene corchetes de columna
  if (expr.includes('[') || expr.includes(']')) return null;

  try {
    const tokens = tokenize(expr);
    // Si contiene tokens de referencia o cadenas de texto, descartar
    if (tokens.some((t) => t.type === 'REF' || t.type === 'STRING')) return null;

    const parser = new FormulaParser(tokens);
    const ast = parser.parse();

    // Validar que no contenga referencias encubiertas
    if (hasReferenceNodes(ast)) return null;

    const ctx: EvalContext = {
      rowValues: {},
      visited: new Set<string>(),
    };
    const res = evalNode(ast, ctx);

    if (typeof res === 'number' && Number.isFinite(res)) {
      return res;
    }
    return null;
  } catch {
    return null;
  }
}

function hasReferenceNodes(node: ASTNode): boolean {
  if (node.type === 'Ref') return true;
  if (node.type === 'Unary') return hasReferenceNodes(node.operand);
  if (node.type === 'Binary') return hasReferenceNodes(node.left) || hasReferenceNodes(node.right);
  if (node.type === 'Call') return node.args.some(hasReferenceNodes);
  return false;
}

/** Comprueba si un valor es o parece una fórmula (comienza con "=" o corchetes de referencia). */
export function isFormulaLike(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const t = value.trim();
  if (t === '') return false;
  return t.startsWith('=') || (t.includes('[') && t.includes(']'));
}

/** Extrae de forma única los nombres de columna referenciados entre corchetes. */
export function extractReferences(formula: string): string[] {
  if (typeof formula !== 'string' || formula.trim() === '') return [];
  const refs: string[] = [];
  const seen = new Set<string>();

  try {
    const tokens = tokenize(formula);
    for (const t of tokens) {
      if (t.type === 'REF' && !seen.has(t.value)) {
        seen.add(t.value);
        refs.push(t.value);
      }
    }
  } catch {
    const regex = /\[([^\]]+)\]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(formula)) !== null) {
      const name = match[1].trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        refs.push(name);
      }
    }
  }

  return refs;
}
