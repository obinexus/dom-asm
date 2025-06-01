import { CSSTokenType, TokenType } from './CSSTokenType';

/**
 * Position information for tokens
 */
export interface Position {
  line: number;
  column: number;
  offset?: number;
}

/**
 * Metadata for tokens including state minimization information
 */
export interface TokenMetadata {
  stateSignature?: string;
  equivalenceClass?: number | null;
  transitions?: Map<string, CSSToken>;
  [key: string]: any;
}

/**
 * CSS Token with support for state minimization
 */
export class CSSToken {
  readonly type: TokenType;
  readonly value: string | number;
  readonly position: Position;
  readonly metadata: TokenMetadata;

  /**
   * Creates a new CSS token with state minimization capabilities
   */
  constructor(type: TokenType, value: string | number, position: Position, metadata: TokenMetadata = {}) {
    this.validateType(type);
    this.validatePosition(position);
    
    this.type = type;
    this.value = value;
    this.position = position;
    this.metadata = {
      ...metadata,
      stateSignature: metadata.stateSignature || null,
      equivalenceClass: metadata.equivalenceClass || null,
      transitions: metadata.transitions || new Map()
    };
    
    Object.freeze(this);
  }
  
  /**
   * Validates the token type
   */
  private validateType(type: TokenType): void {
    if (!Object.values(CSSTokenType).includes(type)) {
      throw new TypeError(`Invalid token type: ${type}`);
    }
  }
  
  /**
   * Validates the position information
   */
  private validatePosition(position: Position): void {
    if (!position || 
        typeof position.line !== 'number' || 
        typeof position.column !== 'number' ||
        position.line < 1 || 
        position.column < 1) {
      throw new TypeError('Invalid position object. Must have line and column numbers >= 1');
    }
  }
  
  /**
   * Computes a state signature for this token based on its transitions
   * Used for state minimization
   */
  public computeStateSignature(): string {
    const components = [
      this.type,
      this.getTransitionsSignature(),
      this.getMetadataSignature()
    ];
    
    const signature = components.join('|');
    
    // Create a new token with the updated signature
    return signature;
  }
  
  /**
   * Gets a signature for transitions
   */
  private getTransitionsSignature(): string {
    const transitions = this.metadata.transitions as Map<string, CSSToken>;
    if (!transitions) return '';
    
    return Array.from(transitions.entries())
      .map(([symbol, target]) => `${symbol}->${target.type}`)
      .sort()
      .join(',');
  }
  
  /**
   * Gets a signature for metadata
   */
  private getMetadataSignature(): string {
    const relevantMetadata = {
      equivalenceClass: this.metadata.equivalenceClass
    };
    return JSON.stringify(relevantMetadata);
  }
  
  /**
   * Adds a transition to the token and returns a new token
   */
  public addTransition(symbol: string, targetToken: CSSToken): CSSToken {
    if (!(targetToken instanceof CSSToken)) {
      throw new TypeError('Target must be a CSSToken instance');
    }
    
    // Create a new token with updated transitions
    const newTransitions = new Map(this.metadata.transitions as Map<string, CSSToken>);
    newTransitions.set(symbol, targetToken);
    
    return new CSSToken(
      this.type,
      this.value,
      this.position,
      {
        ...this.metadata,
        transitions: newTransitions
      }
    );
  }
  
  /**
   * Sets an equivalence class for the token and returns a new token
   */
  public setEquivalenceClass(classId: number): CSSToken {
    return new CSSToken(
      this.type,
      this.value,
      this.position,
      {
        ...this.metadata,
        equivalenceClass: classId
      }
    );
  }
  
  /**
   * Checks if this token equals another token
   */
  public equals(other: CSSToken): boolean {
    if (!(other instanceof CSSToken)) return false;
    
    return this.type === other.type &&
           this.value === other.value &&
           this.position.line === other.position.line &&
           this.position.column === other.position.column;
  }
  
  /**
   * Checks if this token is of any of the specified types
   */
  public isTypeOf(...types: TokenType[]): boolean {
    return types.includes(this.type);
  }
  
  /**
   * Returns a string representation of this token
   */
  public toString(): string {
    return `${this.type}(${JSON.stringify(this.value)}) at ${this.position.line}:${this.position.column}`;
  }
  
  /**
   * Factory method for creating an EOF token
   */
  public static createEOF(position: Position): CSSToken {
    return new CSSToken(CSSTokenType.EOF, '', position);
  }
  
  /**
   * Factory method for creating an error token
   */
  public static createError(message: string, position: Position): CSSToken {
    return new CSSToken(CSSTokenType.Error, message, position);
  }
  
  /**
   * Factory method for creating a whitespace token
   */
  public static createWhitespace(value: string, position: Position): CSSToken {
    return new CSSToken(CSSTokenType.Whitespace, value, position);
  }
  
  /**
   * Checks if two tokens are equivalent for state minimization
   */
  public static areEquivalent(token1: CSSToken, token2: CSSToken): boolean {
    if (!(token1 instanceof CSSToken) || !(token2 instanceof CSSToken)) {
      return false;
    }
    
    // Compare basic properties
    if (token1.type !== token2.type) return false;
    
    // Compare transitions
    const transitions1 = Array.from((token1.metadata.transitions as Map<string, CSSToken>)?.entries() || []).sort();
    const transitions2 = Array.from((token2.metadata.transitions as Map<string, CSSToken>)?.entries() || []).sort();
    
    if (transitions1.length !== transitions2.length) return false;
    
    for (let i = 0; i < transitions1.length; i++) {
      const [symbol1, target1] = transitions1[i];
      const [symbol2, target2] = transitions2[i];
      
      if (symbol1 !== symbol2 || !target1.equals(target2)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Computes equivalence classes for a set of tokens
   * This is a key part of the state minimization algorithm
   */
  public static computeEquivalenceClasses(tokens: CSSToken[]): Map<number, CSSToken[]> {
    const classes = new Map<number, CSSToken[]>();
    let nextClassId = 0;
    
    for (const token of tokens) {
      let found = false;
      
      for (const [classId, representatives] of classes) {
        if (representatives.some(rep => CSSToken.areEquivalent(rep, token))) {
          // Set the equivalence class on the token
          token.metadata.equivalenceClass = classId;
          representatives.push(token);
          found = true;
          break;
        }
      }
      
      if (!found) {
        // Create a new equivalence class
        const newClassId = nextClassId++;
        token.metadata.equivalenceClass = newClassId;
        classes.set(newClassId, [token]);
      }
    }
    
    return classes;
  }
}
---