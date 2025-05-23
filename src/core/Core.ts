/**
 * Core types for the DOM ASM library.
 * These types define the fundamental data structures used throughout the library.
 */

/**
 * Represents a state in a state machine
 */
export interface State {
    id: string;
    transitions: Map<string, string>;
    metadata: Map<string, any>;
    isAccepting: boolean;
  }
  
  /**
   * Represents a state machine
   */
  export interface StateMachine {
    states: Map<string, State>;
    initialState: string;
    currentState: string;
  }
  
  /**
   * Represents a node in an Abstract Syntax Tree
   */
  export interface Node {
    type: string;
    name?: string;
    value?: string;
    attributes?: Map<string, string>;
    children?: Node[];
    metadata?: {
      [key: string]: any;
    };
  }
  
  /**
   * Represents an Abstract Syntax Tree
   */
  export interface AST {
    root: Node;
    metadata: {
      [key: string]: any;
    };
  }
  
  /**
   * Base interface for any element in the DOM ASM system
   */
  export interface DOMElement {
    id: string;
    type: string;
    children: DOMElement[];
    parent?: DOMElement;
    attributes?: Map<string, string>;
    events?: Map<string, Function[]>;
  }
  
  /**
   * Interface for a DOM node
   */
  export interface DOMNode extends DOMElement {
    nodeName: string;
    nodeValue?: string;
    nodeType: number;
  }
  
  /**
   * Interface for a DOM text node
   */
  export interface DOMTextNode extends DOMNode {
    textContent: string;
  }
  
  /**
   * Interface for a DOM element node
   */
  export interface DOMElementNode extends DOMNode {
    tagName: string;
    innerHTML: string;
    outerHTML: string;
    classList: string[];
    style: Map<string, string>;
  }
  
  /**
   * Interface for DOM walker used to traverse the DOM
   */
  export interface DOMWalker {
    nextNode(): DOMNode | null;
    previousNode(): DOMNode | null;
    parentNode(): DOMNode | null;
    firstChild(): DOMNode | null;
    lastChild(): DOMNode | null;
    nextSibling(): DOMNode | null;
    previousSibling(): DOMNode | null;
  }
  
  /**
   * Interface for token position information
   */
  export interface Position {
    line: number;
    column: number;
    offset: number;
  }
  
  /**
   * Interface for a token in a stream
   */
  export interface Token {
    type: string;
    value: string;
    position: Position;
  }
  
  /**
   * Interface for token stream
   */
  export interface TokenStream {
    tokens: Token[];
    position: number;
    peek(): Token | null;
    next(): Token | null;
    back(): void;
    hasNext(): boolean;
    reset(): void;
  }
  
  /**
   * Interface for a compilation unit (such as an HTML file)
   */
  export interface CompilationUnit {
    id: string;
    source: string;
    ast: AST;
    tokens: TokenStream;
    dependencies: CompilationUnit[];
  }
  
  /**
   * Interface for a visitor in the visitor pattern
   */
  export interface Visitor {
    visit(node: Node): void;
    visitChildren(node: Node): void;
  }
  
  /**
   * Interface for a traverser using the visitor pattern
   */
  export interface Traverser {
    traverse(ast: AST, visitor: Visitor): void;
  }
  
  /**
   * Interface for a parser rule
   */
  export interface Rule {
    name: string;
    pattern: RegExp | string | Function;
    action: (match: any, context: any) => any;
  }
  
  /**
   * Interface for a parser
   */
  export interface Parser {
    rules: Rule[];
    parse(input: string): AST;
    parseTokens(tokens: TokenStream): AST;
  }
  
  /**
   * Interface for a tokenizer
   */
  export interface Tokenizer {
    rules: Rule[];
    tokenize(input: string): TokenStream;
  }
  
  /**
   * Interface for a code generator
   */
  export interface CodeGenerator {
    generate(ast: AST): string;
  }
  
  /**
   * Interface for optimization metrics
   */
  export interface OptimizationMetrics {
    before: {
      nodes: number;
      depth: number;
      size: number;
    };
    after: {
      nodes: number;
      depth: number;
      size: number;
    };
    ratio: number;
    time: number;
  }
  
  /**
   * Interface for optimization options
   */
  export interface OptimizationOptions {
    mergeTextNodes?: boolean;
    removeWhitespace?: boolean;
    removeComments?: boolean;
    minimizeDataStructures?: boolean;
    optimizeAttributes?: boolean;
    level?: 'minimal' | 'standard' | 'aggressive';
  }
  
  /**
   * Interface for an optimizer
   */
  export interface Optimizer {
    optimize(ast: AST, options?: OptimizationOptions): AST;
    getMetrics(): OptimizationMetrics;
  }
  
  /**
   * Interface for a renderer
   */
  export interface Renderer {
    render(ast: AST): any;
  }
  
  /**
   * Interface for a diff operation
   */
  export interface DiffOperation {
    type: 'insert' | 'delete' | 'update' | 'move';
    path: string[];
    oldValue?: any;
    newValue?: any;
    from?: string[];
    to?: string[];
  }
  
  /**
   * Interface for a diff result
   */
  export interface DiffResult {
    operations: DiffOperation[];
    similarity: number;
  }
  
  /**
   * Interface for a differ
   */
  export interface Differ {
    diff(oldAst: AST, newAst: AST): DiffResult;
  }
  
  /**
   * Interface for a patch operation
   */
  export interface PatchOperation {
    type: 'insert' | 'delete' | 'update' | 'move';
    path: string[];
    value?: any;
    from?: string[];
    to?: string[];
  }
  
  /**
   * Interface for a patch result
   */
  export interface PatchResult {
    success: boolean;
    ast: AST;
    errors: string[];
  }
  
  /**
   * Interface for a patcher
   */
  export interface Patcher {
    patch(ast: AST, operations: PatchOperation[]): PatchResult;
  }
  
  /**
   * Interface for a logger
   */
  export interface Logger {
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
  }
  
  /**
   * Interface for configuration options
   */
  export interface ConfigOptions {
    optimization?: OptimizationOptions;
    parsing?: {
      strictMode?: boolean;
      errorRecovery?: boolean;
      [key: string]: any;
    };
    rendering?: {
      [key: string]: any;
    };
    [key: string]: any;
  }
  
  /**
   * Interface for the main DOM ASM class
   */
  export interface DOMASM {
    parse(input: string): AST;
    optimize(ast: AST, options?: OptimizationOptions): AST;
    diff(oldAst: AST, newAst: AST): DiffResult;
    patch(ast: AST, operations: PatchOperation[]): PatchResult;
    render(ast: AST): any;
    compile(input: string): any;
  }