import { HTMLToken, HTMLTokenType } from './HTMLToken';
import { HTMLTokenizer } from './HTMLTokenizer';
import { StateMachineMinimizer } from '../core/StateMachineMinimizer';

/**
 * Interface for HTML node structure
 */
export interface HTMLNode {
  type: string;
  name?: string;
  value?: string;
  attributes?: Map<string, string>;
  children: HTMLNode[];
  metadata: {
    equivalenceClass: number | null;
    isMinimized: boolean;
    commentCount?: number;
    textCount?: number;
    nodeCount?: number;
  };
}

/**
 * Interface for HTML AST structure
 */
export interface HTMLAst {
  root: HTMLNode;
  metadata: {
    minimizationMetrics?: {
      originalStateCount: number;
      minimizedStateCount: number;
      optimizationRatio: number;
    };
    [key: string]: any;
  };
}

/**
 * Interface for parser state
 */
interface ParserState {
  type: string;
  isAccepting: boolean;
  transitions: Map<string, ParserState>;
}

/**
 * Error class for HTML parsing errors
 */
export class HTMLParserError extends Error {
  readonly token: HTMLToken;
  readonly state: ParserState;
  readonly position: number;

  constructor(params: {
    message: string;
    token: HTMLToken;
    state: ParserState;
    position: number;
  }) {
    super(`${params.message} at position ${params.position}`);
    this.name = 'HTMLParserError';
    this.token = params.token;
    this.state = params.state;
    this.position = params.position;
  }
}

/**
 * HTMLParser
 * 
 * Parses HTML tokens into an Abstract Syntax Tree (AST) representation.
 * Implements automaton-based parsing with state minimization for optimization.
 */
export class HTMLParser {
  private states: Set<ParserState>;
  private currentState: ParserState | null;
  private equivalenceClasses: Map<number, Set<ParserState>>;
  private optimizedStateMap: Map<ParserState, ParserState>;

  /**
   * Creates a new HTML parser
   */
  constructor() {
    this.states = new Set();
    this.currentState = null;
    this.equivalenceClasses = new Map();
    this.optimizedStateMap = new Map();
    this.initializeStates();
  }

  /**
   * Initializes the state machine for HTML parsing
   */
  private initializeStates(): void {
    // Create base states
    const initialState: ParserState = {
      type: 'Initial',
      isAccepting: false,
      transitions: new Map()
    };

    const inTagState: ParserState = {
      type: 'InTag',
      isAccepting: false,
      transitions: new Map()
    };

    const inContentState: ParserState = {
      type: 'InContent',
      isAccepting: true,
      transitions: new Map()
    };

    const inCommentState: ParserState = {
      type: 'InComment',
      isAccepting: false,
      transitions: new Map()
    };

    const inDoctypeState: ParserState = {
      type: 'InDoctype',
      isAccepting: false,
      transitions: new Map()
    };

    const finalState: ParserState = {
      type: 'Final',
      isAccepting: true,
      transitions: new Map()
    };

    // Set up transitions
    initialState.transitions.set('<', inTagState);
    initialState.transitions.set('text', inContentState);
    inTagState.transitions.set('>', inContentState);
    inTagState.transitions.set('!', inDoctypeState);
    inTagState.transitions.set('<!--', inCommentState);
    inContentState.transitions.set('<', inTagState);
    inContentState.transitions.set('EOF', finalState);
    inCommentState.transitions.set('-->', inContentState);
    inDoctypeState.transitions.set('>', inContentState);

    // Initialize state collections
    this.states.clear();
    this.states.add(initialState);
    this.states.add(inTagState);
    this.states.add(inContentState);
    this.states.add(inCommentState);
    this.states.add(inDoctypeState);
    this.states.add(finalState);

    // Set initial state
    this.currentState = initialState;

    // Clear maps
    this.equivalenceClasses.clear();
    this.optimizedStateMap.clear();
  }

  /**
   * Parses HTML input string into an AST
   * 
   * @param input - The HTML string to parse
   * @returns The parsed HTML AST
   */
  public parse(input: string): HTMLAst {
    const tokenizer = new HTMLTokenizer(input);
    const { tokens } = tokenizer.tokenize();
    
    this.minimizeStates();
    const ast = this.buildOptimizedAST(tokens);
    return this.optimizeAST(ast);
  }

  /**
   * Minimizes the parser states using Hopcroft's algorithm
   */
  private minimizeStates(): void {
    const accepting = new Set([...this.states].filter(s => s.isAccepting));
    const nonAccepting = new Set([...this.states].filter(s => !s.isAccepting));
    
    let partition = [accepting, nonAccepting];
    let newPartition: Set<ParserState>[] = [];
    
    do {
      partition = newPartition.length > 0 ? newPartition : partition;
      newPartition = [];
      
      for (const block of partition) {
        const splits = this.splitBlock(block, partition);
        newPartition.push(...splits);
      }
    } while (newPartition.length !== partition.length);
    
    partition.forEach((block, index) => {
      this.equivalenceClasses.set(index, block);
    });
    
    // Create mapping from original states to optimized states
    for (const [classId, stateSet] of this.equivalenceClasses) {
      const representativeState = stateSet.values().next().value;
      for (const state of stateSet) {
        this.optimizedStateMap.set(state, representativeState);
      }
    }
  }

  /**
   * Splits a block of states based on their transitions
   * 
   * @param block - The block of states to split
   * @param partition - The current partition of states
   * @returns The split blocks
   */
  private splitBlock(block: Set<ParserState>, partition: Set<ParserState>[]): Set<ParserState>[] {
    if (block.size <= 1) return [block];
    
    const splits = new Map<string, Set<ParserState>>();
    
    for (const state of block) {
      const signature = this.getStateSignature(state, partition);
      if (!splits.has(signature)) {
        splits.set(signature, new Set());
      }
      splits.get(signature)!.add(state);
    }
    
    return Array.from(splits.values());
  }

  /**
   * Creates a signature for a state based on its transitions
   * 
   * @param state - The state to create a signature for
   * @param partition - The current partition of states
   * @returns A string signature uniquely identifying the state's behavior
   */
  private getStateSignature(state: ParserState, partition: Set<ParserState>[]): string {
    const transitions: string[] = [];
    
    for (const [symbol, targetState] of state.transitions) {
      const targetPartition = partition.findIndex(block => block.has(targetState));
      transitions.push(`${symbol}:${targetPartition}`);
    }
    
    return transitions.sort().join('|');
  }

  /**
   * Builds an optimized AST from tokens using the minimized state machine
   * 
   * @param tokens - The tokens to build the AST from
   * @returns The built HTML AST
   */
  private buildOptimizedAST(tokens: HTMLToken[]): HTMLAst {
    const root: HTMLNode = {
      type: 'Element',
      name: 'root',
      children: [],
      metadata: {
        equivalenceClass: 0,
        isMinimized: false
      }
    };

    const stack: HTMLNode[] = [root];
    let currentNode: HTMLNode = root;
    
    for (const token of tokens) {
      try {
        currentNode = this.processTokenWithOptimizedState(token, currentNode, stack);
      } catch (error) {
        if (error instanceof HTMLParserError) {
          this.handleParserError(error, currentNode);
        } else {
          // Re-throw unknown errors
          throw error;
        }
      }
    }

    return {
      root,
      metadata: {}
    };
  }

  /**
   * Processes a token using the optimized state machine
   * 
   * @param token - The token to process
   * @param currentNode - The current node being built
   * @param stack - The node stack for tracking nested elements
   * @returns The new current node
   */
  private processTokenWithOptimizedState(
    token: HTMLToken,
    currentNode: HTMLNode,
    stack: HTMLNode[]
  ): HTMLNode {
    const optimizedState = this.optimizedStateMap.get(this.currentState!) || this.currentState!;
    
    switch (token.type) {
      case HTMLTokenType.StartTag: {
        const element: HTMLNode = {
          type: 'Element',
          name: token.name,
          attributes: token.attributes ?? new Map(),
          children: [],
          metadata: {
            equivalenceClass: this.getEquivalenceClass(optimizedState),
            isMinimized: true
          }
        };
        
        currentNode.children.push(element);
        if (!token.selfClosing) {
          stack.push(element);
          currentNode = element;
        }
        break;
      }

      case HTMLTokenType.EndTag: {
        if (stack.length > 1) {
          // Try to find matching start tag
          let matchFound = false;
          for (let i = stack.length - 1; i >= 1; i--) {
            if (stack[i].name === token.name) {
              // Found matching start tag, pop back to it
              currentNode = stack[i];
              stack.length = i + 1;
              // Move up one level
              currentNode = stack[i - 1];
              matchFound = true;
              break;
            }
          }
          
          // Handle unmatched end tag
          if (!matchFound) {
            // Just pop one level (more tolerant approach)
            if (stack.length > 1) {
              stack.pop();
              currentNode = stack[stack.length - 1];
            }
          }
        }
        break;
      }

      case HTMLTokenType.Text: {
        // Skip empty text nodes unless preserveWhitespace is enabled
        if ((token.content?.trim() || '').length > 0 || token.isWhitespace) {
          const node: HTMLNode = {
            type: 'Text',
            value: token.content,
            children: [],
            metadata: {
              equivalenceClass: this.getEquivalenceClass(optimizedState),
              isMinimized: true
            }
          };
          currentNode.children.push(node);
        }
        break;
      }

      case HTMLTokenType.Comment: {
        const node: HTMLNode = {
          type: 'Comment',
          value: token.data,
          children: [],
          metadata: {
            equivalenceClass: this.getEquivalenceClass(optimizedState),
            isMinimized: true
          }
        };
        currentNode.children.push(node);
        break;
      }
      
      case HTMLTokenType.Doctype: {
        const node: HTMLNode = {
          type: 'Doctype',
          name: token.name,
          children: [],
          metadata: {
            equivalenceClass: this.getEquivalenceClass(optimizedState),
            isMinimized: true
          }
        };
        currentNode.children.push(node);
        break;
      }
      
      case HTMLTokenType.CDATA: {
        const node: HTMLNode = {
          type: 'CDATA',
          value: token.content,
          children: [],
          metadata: {
            equivalenceClass: this.getEquivalenceClass(optimizedState),
            isMinimized: true
          }
        };
        currentNode.children.push(node);
        break;
      }
      
      case HTMLTokenType.ConditionalComment: {
        const node: HTMLNode = {
          type: 'ConditionalComment',
          value: token.content,
          attributes: new Map([['condition', token.condition]]),
          children: [],
          metadata: {
            equivalenceClass: this.getEquivalenceClass(optimizedState),
            isMinimized: true
          }
        };
        currentNode.children.push(node);
        break;
      }
      
      // Ignore EOF token
      case HTMLTokenType.EOF:
        break;
        
      default:
        throw new HTMLParserError({
          message: `Unknown token type: ${token.type}`,
          token,
          state: optimizedState,
          position: token.start
        });
    }

    return currentNode;
  }

  /**
   * Optimizes an AST by merging text nodes and removing redundant nodes
   * 
   * @param ast - The AST to optimize
   * @returns The optimized AST
   */
  private optimizeAST(ast: HTMLAst): HTMLAst {
    this.mergeTextNodes(ast.root);
    this.removeRedundantNodes(ast.root);
    this.optimizeAttributes(ast.root);
    
    ast.metadata.minimizationMetrics = {
      originalStateCount: this.states.size,
      minimizedStateCount: this.equivalenceClasses.size,
      optimizationRatio: this.equivalenceClasses.size / this.states.size
    };
    
    return ast;
  }

  /**
   * Merges adjacent text nodes
   * 
   * @param node - The node to process
   */
  private mergeTextNodes(node: HTMLNode): void {
    if (!node.children.length) return;

    // Process children first (depth-first)
    for (const child of node.children) {
      if (child.type === 'Element') {
        this.mergeTextNodes(child);
      }
    }

    // Merge adjacent text nodes
    let i = 0;
    while (i < node.children.length - 1) {
      const current = node.children[i];
      const next = node.children[i + 1];
      
      if (current.type === 'Text' && next.type === 'Text') {
        current.value = (current.value || '') + (next.value || '');
        node.children.splice(i + 1, 1);
      } else {
        i++;
      }
    }
  }

  /**
   * Removes redundant nodes like empty text nodes
   * 
   * @param node - The node to process
   */
  private removeRedundantNodes(node: HTMLNode): void {
    node.children = node.children.filter(child => {
      if (child.type === 'Text') {
        return child.value && child.value.trim().length > 0;
      }
      this.removeRedundantNodes(child);
      return true;
    });
  }

  /**
   * Optimizes attributes by normalizing keys
   * 
   * @param node - The node to process
   */
  private optimizeAttributes(node: HTMLNode): void {
    if (node.attributes) {
      const optimizedAttributes = new Map<string, string>();
      for (const [key, value] of node.attributes.entries()) {
        const normalizedKey = key.toLowerCase();
        optimizedAttributes.set(normalizedKey, value);
      }
      node.attributes = optimizedAttributes;
    }
    
    node.children.forEach(child => this.optimizeAttributes(child));
  }

  /**
   * Gets the equivalence class for a state
   * 
   * @param state - The state to get the equivalence class for
   * @returns The equivalence class ID
   */
  private getEquivalenceClass(state: ParserState): number {
    for (const [classId, states] of this.equivalenceClasses) {
      if (states.has(state)) return classId;
    }
    return -1;
  }

  /**
   * Handles a parser error
   * 
   * @param error - The error to handle
   * @param currentNode - The current node when the error occurred
   */
  private handleParserError(error: HTMLParserError, currentNode: HTMLNode): void {
    console.error(`Parser error in state ${error.state.type}:`, error.message);
    // Add error info to the current node's metadata
    currentNode.metadata.error = {
      message: error.message,
      position: error.position,
      state: error.state.type
    };
  }

  /**
   * Computes metadata for an AST
   * 
   * @param node - The root node
   * @returns The computed metadata
   */
  private computeOptimizedMetadata(root: HTMLNode): void {
    const countNodes = (node: HTMLNode): void => {
      switch (node.type) {
        case 'Element':
          node.metadata.nodeCount = (node.metadata.nodeCount || 0) + 1;
          break;
        case 'Text':
          node.metadata.textCount = (node.metadata.textCount || 0) + 1;
          break;
        case 'Comment':
          node.metadata.commentCount = (node.metadata.commentCount || 0) + 1;
          break;
      }
      node.children.forEach(countNodes);
    };

    countNodes(root);
  }
}
    