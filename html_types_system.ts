/**
 * HTML Domain Type System
 * Single-Pass Architecture Type Definitions
 * 
 * Behavioral Equivalence: These types preserve all semantic information
 * required for Ship of Theseus validation while enabling state minimization.
 */

// ===== TOKEN SYSTEM =====

export enum HTMLTokenType {
  StartTag = 'StartTag',
  EndTag = 'EndTag',
  Text = 'Text',
  Comment = 'Comment',
  ConditionalComment = 'ConditionalComment',
  Doctype = 'Doctype',
  CDATA = 'CDATA',
  EOF = 'EOF'
}

export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface HTMLBaseToken {
  type: HTMLTokenType;
  start: number;
  end: number;
  line: number;
  column: number;
  raw?: string; // Original source text for behavioral verification
}

export interface StartTagToken extends HTMLBaseToken {
  type: HTMLTokenType.StartTag;
  name: string;
  attributes: Map<string, string>;
  selfClosing: boolean;
  namespace?: string;
}

export interface EndTagToken extends HTMLBaseToken {
  type: HTMLTokenType.EndTag;
  name: string;
  namespace?: string;
}

export interface TextToken extends HTMLBaseToken {
  type: HTMLTokenType.Text;
  content: string;
  isWhitespace: boolean;
}

export interface CommentToken extends HTMLBaseToken {
  type: HTMLTokenType.Comment;
  data: string;
  isConditional?: boolean;
}

export interface ConditionalCommentToken extends HTMLBaseToken {
  type: HTMLTokenType.ConditionalComment;
  condition: string;
  content: string;
}

export interface DoctypeToken extends HTMLBaseToken {
  type: HTMLTokenType.Doctype;
  name: string;
  publicId?: string;
  systemId?: string;
}

export interface CDATAToken extends HTMLBaseToken {
  type: HTMLTokenType.CDATA;
  content: string;
}

export interface EOFToken extends HTMLBaseToken {
  type: HTMLTokenType.EOF;
}

export type HTMLToken = 
  | StartTagToken 
  | EndTagToken 
  | TextToken 
  | CommentToken 
  | ConditionalCommentToken 
  | DoctypeToken 
  | CDATAToken 
  | EOFToken;

// ===== AST NODE SYSTEM =====

export enum HTMLNodeType {
  Document = 'Document',
  Element = 'Element',
  Text = 'Text',
  Comment = 'Comment',
  Doctype = 'Doctype',
  CDATA = 'CDATA'
}

export interface HTMLASTNode {
  id: string; // Unique identifier for state machine tracking
  type: HTMLNodeType;
  parent?: HTMLASTNode;
  children: HTMLASTNode[];
  equivalenceClass?: string; // State minimization signature
  metadata: Map<string, any>;
}

export interface DocumentNode extends HTMLASTNode {
  type: HTMLNodeType.Document;
  doctype?: DoctypeNode;
  documentElement?: ElementNode;
}

export interface ElementNode extends HTMLASTNode {
  type: HTMLNodeType.Element;
  tagName: string;
  attributes: Map<string, string>;
  namespace?: string;
  selfClosing: boolean;
}

export interface TextNode extends HTMLASTNode {
  type: HTMLNodeType.Text;
  content: string;
  isWhitespace: boolean;
}

export interface CommentNode extends HTMLASTNode {
  type: HTMLNodeType.Comment;
  data: string;
}

export interface DoctypeNode extends HTMLASTNode {
  type: HTMLNodeType.Doctype;
  name: string;
  publicId?: string;
  systemId?: string;
}

export interface CDATANode extends HTMLASTNode {
  type: HTMLNodeType.CDATA;
  content: string;
}

// ===== PARSER STATE SYSTEM =====

export interface HTMLParserState {
  id: string;
  transitions: Map<string, string>; // input symbol -> target state
  metadata: Map<string, any>;
  isAccepting: boolean;
}

export interface HTMLParsingContext {
  input: string;
  position: number;
  line: number;
  column: number;
  stack: ElementNode[];
  errors: HTMLParsingError[];
}

export interface HTMLParsingError {
  message: string;
  position: Position;
  severity: 'error' | 'warning';
  token?: HTMLToken;
}

// ===== TOKENIZER CONFIGURATION =====

export interface HTMLTokenizerOptions {
  preserveWhitespace: boolean;
  includeComments: boolean;
  includeConditionalComments: boolean;
  strictMode: boolean;
  errorRecovery: boolean;
}

export interface HTMLTokenizerResult {
  tokens: HTMLToken[];
  errors: HTMLParsingError[];
  metadata: {
    totalTokens: number;
    processingTime: number;
    memoryUsage?: number;
  };
}

// ===== PARSER CONFIGURATION =====

export interface HTMLParserOptions {
  allowSelfClosingTags: boolean;
  strictNesting: boolean;
  preserveCase: boolean;
  errorRecovery: boolean;
  stateMinimization: boolean;
}

export interface HTMLParserResult {
  ast: DocumentNode;
  errors: HTMLParsingError[];
  metadata: {
    nodeCount: number;
    stateOptimizations: number;
    processingTime: number;
  };
}

// ===== BEHAVIORAL EQUIVALENCE SYSTEM =====

export interface BehavioralSignature {
  nodeType: HTMLNodeType;
  attributes?: string; // Sorted attribute signature
  children?: string[]; // Child node signatures
  textContent?: string;
}

export interface EquivalenceClass {
  id: string;
  signature: string;
  nodes: Set<HTMLASTNode>;
  representative: HTMLASTNode;
}

export interface StateMinimizationResult {
  originalStateCount: number;
  minimizedStateCount: number;
  equivalenceClasses: EquivalenceClass[];
  optimizationRatio: number;
  behavioralEquivalence: boolean;
}

// ===== COMPILATION INTERFACE =====

export interface HTMLCompilationOptions extends HTMLTokenizerOptions, HTMLParserOptions {
  optimizeAST: boolean;
  validateBehavior: boolean;
  generateSourceMap: boolean;
}

export interface HTMLCompilationResult {
  ast: DocumentNode;
  tokens: HTMLToken[];
  errors: HTMLParsingError[];
  minimization: StateMinimizationResult;
  metadata: {
    inputSize: number;
    outputSize: number;
    compressionRatio: number;
    processingTime: number;
  };
}

// ===== SINGLE-PASS PIPELINE INTERFACE =====

export interface HTMLPipeline {
  tokenize(input: string, options?: HTMLTokenizerOptions): HTMLTokenizerResult;
  parse(tokens: HTMLToken[], options?: HTMLParserOptions): HTMLParserResult;
  buildAST(parseResult: HTMLParserResult, optimize?: boolean): DocumentNode;
  compile(input: string, options?: HTMLCompilationOptions): HTMLCompilationResult;
}

// ===== ERROR HANDLING =====

export class HTMLTokenizerError extends Error {
  constructor(
    message: string,
    public position: Position,
    public token?: HTMLToken
  ) {
    super(message);
    this.name = 'HTMLTokenizerError';
  }
}

export class HTMLParsingError extends Error {
  constructor(
    message: string,
    public position: Position,
    public state?: HTMLParserState,
    public token?: HTMLToken
  ) {
    super(message);
    this.name = 'HTMLParsingError';
  }
}

export class HTMLOptimizationError extends Error {
  constructor(
    message: string,
    public node?: HTMLASTNode,
    public equivalenceClass?: EquivalenceClass
  ) {
    super(message);
    this.name = 'HTMLOptimizationError';
  }
}