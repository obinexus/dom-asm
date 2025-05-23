import { CSSToken, Position } from './CSSToken';
import { CSSTokenType } from './CSSTokenType';

/**
 * Options for CSS tokenization
 */
export interface TokenizerOptions {
  preserveWhitespace?: boolean;
  recognizeColors?: boolean;
  recognizeFunctions?: boolean;
  generateStateTransitions?: boolean;
}

/**
 * Tokenizer result
 */
export interface TokenizerResult {
  tokens: CSSToken[];
  errors: { message: string; position: Position }[];
}

/**
 * CSS Tokenizer with support for state minimization
 * Breaks CSS into tokens that can be used for parsing and AST building
 */
export class CSSTokenizer {
  private input: string;
  private position: number;
  private line: number;
  private column: number;
  private tokens: CSSToken[];
  private errors: { message: string; position: Position }[];
  private options: TokenizerOptions;

  /**
   * Creates a new CSS tokenizer
   */
  constructor(input: string, options: TokenizerOptions = {}) {
    this.input = input;
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];
    this.errors = [];
    this.options = {
      preserveWhitespace: false,
      recognizeColors: true,
      recognizeFunctions: true,
      generateStateTransitions: true,
      ...options
    };
  }

  /**
   * Tokenizes the input CSS string
   */
  public tokenize(): TokenizerResult {
    while (this.position < this.input.length) {
      const char = this.peek();
      
      if (this.isWhitespace(char)) {
        this.tokenizeWhitespace();
      } else if (char === '/' && this.peek(1) === '*') {
        this.tokenizeComment();
      } else if (char === '@') {
        this.tokenizeAtKeyword();
      } else if (char === '#') {
        this.tokenizeHash();
      } else if (this.isNumberStart(char)) {
        this.tokenizeNumber();
      } else if (char === '"' || char === "'") {
        this.tokenizeString();
      } else if (this.isIdentStart(char)) {
        this.tokenizeIdentifier();
      } else if (this.isStructuralChar(char)) {
        this.tokenizeStructural();
      } else {
        this.addError(`Unexpected character: ${char}`);
        this.advance();
      }
    }

    // Add EOF token
    this.tokens.push(CSSToken.createEOF(this.getPosition()));

    // Generate state transitions if requested
    if (this.options.generateStateTransitions) {
      this.generateStateTransitions();
    }

    // Compute equivalence classes if we generated transitions
    if (this.options.generateStateTransitions) {
      this.computeEquivalenceClasses();
    }

    return {
      tokens: this.tokens,
      errors: this.errors
    };
  }

  /**
   * Tokenizes whitespace
   */
  private tokenizeWhitespace(): void {
    const start = this.getPosition();
    let value = '';

    while (this.position < this.input.length && this.isWhitespace(this.peek())) {
      value += this.advance();
    }

    if (this.options.preserveWhitespace) {
      this.tokens.push(CSSToken.createWhitespace(value, start));
    }
  }

  /**
   * Tokenizes a comment
   */
  private tokenizeComment(): void {
    const start = this.getPosition();
    let value = '';
    
    // Skip /*
    this.advance();
    this.advance();

    while (this.position < this.input.length) {
      if (this.peek() === '*' && this.peek(1) === '/') {
        this.advance(); // Skip *
        this.advance(); // Skip /
        break;
      }
      value += this.advance();
    }

    this.tokens.push(new CSSToken(
      CSSTokenType.Comment,
      value,
      start
    ));
  }

  /**
   * Tokenizes an at-keyword
   */
  private tokenizeAtKeyword(): void {
    const start = this.getPosition();
    this.advance(); // Skip @
    
    let value = '';
    while (this.position < this.input.length && this.isIdentChar(this.peek())) {
      value += this.advance();
    }

    this.tokens.push(new CSSToken(
      CSSTokenType.AtKeyword,
      value,
      start
    ));
  }

  /**
   * Tokenizes a hash (id selector or color)
   */
  private tokenizeHash(): void {
    const start = this.getPosition();
    this.advance(); // Skip #
    
    let value = '';
    while (this.position < this.input.length && this.isIdentChar(this.peek())) {
      value += this.advance();
    }

    // Check if it's a valid color
    if (this.options.recognizeColors && this.isValidColor(value)) {
      this.tokens.push(new CSSToken(
        CSSTokenType.Color,
        '#' + value,
        start
      ));
    } else {
      this.tokens.push(new CSSToken(
        CSSTokenType.Selector,
        '#' + value,
        start
      ));
    }
  }

  /**
   * Tokenizes a number and optional unit
   */
  private tokenizeNumber(): void {
    const start = this.getPosition();
    let value = '';
    let hasDecimal = false;

    // Handle sign
    if (this.peek() === '+' || this.peek() === '-') {
      value += this.advance();
    }

    // Handle digits before decimal
    while (this.position < this.input.length && this.isDigit(this.peek())) {
      value += this.advance();
    }

    // Handle decimal point and digits after
    if (this.peek() === '.') {
      hasDecimal = true;
      value += this.advance();
      while (this.position < this.input.length && this.isDigit(this.peek())) {
        value += this.advance();
      }
    }

    // Check for unit
    let unit = '';
    if (this.isIdentStart(this.peek())) {
      while (this.position < this.input.length && this.isIdentChar(this.peek())) {
        unit += this.advance();
      }
    }

    if (unit) {
      this.tokens.push(new CSSToken(
        CSSTokenType.Number,
        parseFloat(value),
        start
      ));
      this.tokens.push(new CSSToken(
        CSSTokenType.Unit,
        unit,
        this.getPosition()
      ));
    } else {
      this.tokens.push(new CSSToken(
        CSSTokenType.Number,
        parseFloat(value),
        start
      ));
    }
  }

  /**
   * Tokenizes a string
   */
  private tokenizeString(): void {
    const start = this.getPosition();
    const quote = this.advance();
    let value = '';

    while (this.position < this.input.length) {
      const char = this.peek();
      
      if (char === quote) {
        this.advance();
        break;
      } else if (char === '\\') {
        this.advance();
        if (this.position < this.input.length) {
          value += this.advance();
        }
      } else {
        value += this.advance();
      }
    }

    this.tokens.push(new CSSToken(
      CSSTokenType.String,
      value,
      start
    ));
  }

  /**
   * Tokenizes an identifier (property, selector, or function)
   */
  private tokenizeIdentifier(): void {
    const start = this.getPosition();
    let value = '';

    while (this.position < this.input.length && this.isIdentChar(this.peek())) {
      value += this.advance();
    }

    // Check if it's a function
    if (this.peek() === '(' && this.options.recognizeFunctions) {
      this.advance(); // Skip (
      this.tokens.push(new CSSToken(
        CSSTokenType.Function,
        value,
        start
      ));
      this.tokens.push(new CSSToken(
        CSSTokenType.OpenParen,
        '(',
        this.getPosition()
      ));
      return;
    }

    // Check for property or value context
    const lastToken = this.tokens[this.tokens.length - 1];
    if (lastToken && lastToken.type === CSSTokenType.Colon) {
      // After a colon, this is a value
      this.tokens.push(new CSSToken(
        CSSTokenType.Value,
        value,
        start
      ));
    } else {
      // Otherwise, it's a property or selector
      // In a more complex tokenizer, we'd have more logic to determine which
      // For now, we're assuming it's a property
      this.tokens.push(new CSSToken(
        CSSTokenType.Property,
        value,
        start
      ));
    }
  }

  /**
   * Tokenizes structural characters like {, }, :, ;, etc.
   */
  private tokenizeStructural(): void {
    const char = this.advance();
    const position = this.getPosition();

    switch (char) {
      case '{':
        this.tokens.push(new CSSToken(CSSTokenType.StartBlock, char, position));
        break;
      case '}':
        this.tokens.push(new CSSToken(CSSTokenType.EndBlock, char, position));
        break;
      case ':':
        this.tokens.push(new CSSToken(CSSTokenType.Colon, char, position));
        break;
      case ';':
        this.tokens.push(new CSSToken(CSSTokenType.Semicolon, char, position));
        break;
      case ',':
        this.tokens.push(new CSSToken(CSSTokenType.Comma, char, position));
        break;
      case '(':
        this.tokens.push(new CSSToken(CSSTokenType.OpenParen, char, position));
        break;
      case ')':
        this.tokens.push(new CSSToken(CSSTokenType.CloseParen, char, position));
        break;
    }
  }

  /**
   * Generates state transitions between tokens
   */
  private generateStateTransitions(): void {
    for (let i = 0; i < this.tokens.length - 1; i++) {
      const current = this.tokens[i];
      const next = this.tokens[i + 1];
      
      // Determine transition symbol
      let transitionSymbol = '';
      
      if (next.type === CSSTokenType.StartBlock) {
        transitionSymbol = '{';
      } else if (next.type === CSSTokenType.EndBlock) {
        transitionSymbol = '}';
      } else if (next.type === CSSTokenType.Semicolon) {
        transitionSymbol = ';';
      } else if (next.type === CSSTokenType.Colon) {
        transitionSymbol = ':';
      } else {
        // Use a simplified transition symbol based on token type
        transitionSymbol = next.type;
      }
      
      // Add transition
      this.tokens[i] = current.addTransition(transitionSymbol, next);
    }
  }

  /**
   * Computes equivalence classes for tokens
   */
  private computeEquivalenceClasses(): void {
    CSSToken.computeEquivalenceClasses(this.tokens);
  }

  /**
   * Helper method to check if a character is whitespace
   */
  private isWhitespace(char: string): boolean {
    return /[\s\n\t\r\f]/.test(char);
  }

  /**
   * Helper method to check if a character is a digit
   */
  private isDigit(char: string): boolean {
    return /[0-9]/.test(char);
  }

  /**
   * Helper method to check if a character is a letter
   */
  private isLetter(char: string): boolean {
    return /[a-zA-Z]/.test(char);
  }

  /**
   * Helper method to check if a character can start an identifier
   */
  private isIdentStart(char: string): boolean {
    return this.isLetter(char) || char === '_' || char === '-';
  }

  /**
   * Helper method to check if a character can be part of an identifier
   */
  private isIdentChar(char: string): boolean {
    return this.isIdentStart(char) || this.isDigit(char);
  }

  /**
   * Helper method to check if a character can start a number
   */
  private isNumberStart(char: string): boolean {
    return this.isDigit(char) || (char === '.' && this.isDigit(this.peek(1))) ||
           ((char === '+' || char === '-') && 
            (this.isDigit(this.peek(1)) || 
             (this.peek(1) === '.' && this.isDigit(this.peek(2)))));
  }

  /**
   * Helper method to check if a character is a structural character
   */
  private isStructuralChar(char: string): boolean {
    return /[{}:;,()]/.test(char);
  }

  /**
   * Helper method to check if a value is a valid color
   */
  private isValidColor(value: string): boolean {
    return /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value);
  }

  /**
   * Helper method to peek at a character
   */
  private peek(offset: number = 0): string {
    return this.input[this.position + offset] || '';
  }

  /**
   * Helper method to advance to the next character
   */
  private advance(): string {
    const char = this.input[this.position++];
    
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    
    return char;
  }

  /**
   * Helper method to get the current position
   */
  private getPosition(): Position {
    return {
      line: this.line,
      column: this.column,
      offset: this.position
    };
  }

  /**
   * Helper method to add an error
   */
  private addError(message: string): void {
    this.errors.push({
      message,
      position: this.getPosition()
    });
    
    this.tokens.push(CSSToken.createError(
      message,
      this.getPosition()
    ));
  }
}