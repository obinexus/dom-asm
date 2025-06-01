/**
 * HTMLTokenizer - Single-Pass Tokenization Engine
 * 
 * Implements O(n) tokenization with state minimization for optimal performance.
 * Behavioral equivalence preserved through comprehensive token metadata capture.
 */

import {
  HTMLToken,
  HTMLTokenType,
  HTMLTokenizerOptions,
  HTMLTokenizerResult,
  HTMLTokenizerError,
  StartTagToken,
  EndTagToken,
  TextToken,
  CommentToken,
  ConditionalCommentToken,
  DoctypeToken,
  CDATAToken,
  EOFToken,
  Position,
  HTMLParsingError
} from '@dom-asm/html/types';

export class HTMLTokenizer {
  private input: string = '';
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: HTMLToken[] = [];
  private errors: HTMLParsingError[] = [];
  private options: HTMLTokenizerOptions;

  constructor(options: Partial<HTMLTokenizerOptions> = {}) {
    this.options = {
      preserveWhitespace: options.preserveWhitespace ?? true,
      includeComments: options.includeComments ?? true,
      includeConditionalComments: options.includeConditionalComments ?? true,
      strictMode: options.strictMode ?? false,
      errorRecovery: options.errorRecovery ?? true,
      ...options
    };
  }

  /**
   * Single-pass tokenization with O(n) complexity
   * Implements deterministic finite automaton for HTML lexical analysis
   */
  public tokenize(input: string): HTMLTokenizerResult {
    const startTime = performance.now();
    
    this.initialize(input);
    
    while (!this.isAtEnd()) {
      this.scanToken();
    }
    
    // Add EOF token for parser completeness
    this.addToken(this.createEOFToken());
    
    const endTime = performance.now();
    
    return {
      tokens: this.tokens,
      errors: this.errors,
      metadata: {
        totalTokens: this.tokens.length,
        processingTime: endTime - startTime,
        memoryUsage: this.estimateMemoryUsage()
      }
    };
  }

  private initialize(input: string): void {
    this.input = input;
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];
    this.errors = [];
  }

  private scanToken(): void {
    const char = this.advance();
    
    switch (char) {
      case '<':
        this.handleLessThan();
        break;
      default:
        this.handleText();
        break;
    }
  }

  private handleLessThan(): void {
    if (this.peek() === '!') {
      this.advance(); // consume '!'
      
      if (this.match('--')) {
        this.handleComment();
      } else if (this.match('[CDATA[')) {
        this.handleCDATA();
      } else if (this.matchIgnoreCase('DOCTYPE')) {
        this.handleDoctype();
      } else if (this.peek() === '[') {
        this.handleConditionalComment();
      } else {
        this.handleInvalidMarkup();
      }
    } else if (this.peek() === '/') {
      this.advance(); // consume '/'
      this.handleEndTag();
    } else if (this.isAlpha(this.peek()) || this.peek() === '_') {
      this.handleStartTag();
    } else {
      this.handleText(); // Invalid < treated as text in recovery mode
    }
  }

  private handleStartTag(): void {
    const start = this.position - 1; // Include '<'
    const tagName = this.readTagName();
    const attributes = this.readAttributes();
    
    this.skipWhitespace();
    
    const selfClosing = this.match('/');
    
    if (!this.match('>')) {
      this.reportError('Expected ">" after tag', this.position);
      if (this.options.errorRecovery) {
        this.skipUntil('>');
        this.advance(); // consume '>'
      }
    }
    
    const token: StartTagToken = {
      type: HTMLTokenType.StartTag,
      name: tagName,
      attributes,
      selfClosing,
      start,
      end: this.position,
      line: this.line,
      column: this.column,
      raw: this.input.slice(start, this.position)
    };
    
    this.addToken(token);
  }

  private handleEndTag(): void {
    const start = this.position - 2; // Include '</'
    const tagName = this.readTagName();
    
    this.skipWhitespace();
    
    if (!this.match('>')) {
      this.reportError('Expected ">" after end tag', this.position);
      if (this.options.errorRecovery) {
        this.skipUntil('>');
        this.advance(); // consume '>'
      }
    }
    
    const token: EndTagToken = {
      type: HTMLTokenType.EndTag,
      name: tagName,
      start,
      end: this.position,
      line: this.line,
      column: this.column,
      raw: this.input.slice(start, this.position)
    };
    
    this.addToken(token);
  }

  private handleText(): void {
    const start = this.position - 1;
    let content = this.previous();
    
    while (!this.isAtEnd() && this.peek() !== '<') {
      content += this.advance();
    }
    
    const isWhitespace = /^\s+$/.test(content);
    
    if (!isWhitespace || this.options.preserveWhitespace) {
      const token: TextToken = {
        type: HTMLTokenType.Text,
        content,
        isWhitespace,
        start,
        end: this.position,
        line: this.line,
        column: this.column,
        raw: content
      };
      
      this.addToken(token);
    }
  }

  private handleComment(): void {
    const start = this.position - 3; // Include '<!--'
    let data = '';
    
    while (!this.isAtEnd() && !this.match('-->')) {
      data += this.advance();
    }
    
    if (this.isAtEnd()) {
      this.reportError('Unterminated comment', start);
    }
    
    if (this.options.includeComments) {
      const token: CommentToken = {
        type: HTMLTokenType.Comment,
        data,
        start,
        end: this.position,
        line: this.line,
        column: this.column,
        raw: this.input.slice(start, this.position)
      };
      
      this.addToken(token);
    }
  }

  private handleConditionalComment(): void {
    if (!this.options.includeConditionalComments) {
      this.skipUntil(']>');
      this.advance(); // consume '>'
      return;
    }
    
    const start = this.position - 2; // Include '<!'
    this.advance(); // consume '['
    
    let condition = '';
    while (!this.isAtEnd() && this.peek() !== ']') {
      condition += this.advance();
    }
    
    if (this.match(']>')) {
      // Simple conditional comment
      const token: ConditionalCommentToken = {
        type: HTMLTokenType.ConditionalComment,
        condition,
        content: '',
        start,
        end: this.position,
        line: this.line,
        column: this.column,
        raw: this.input.slice(start, this.position)
      };
      
      this.addToken(token);
    }
  }

  private handleCDATA(): void {
    const start = this.position - 9; // Include '<![CDATA['
    let content = '';
    
    while (!this.isAtEnd() && !this.match(']]>')) {
      content += this.advance();
    }
    
    if (this.isAtEnd()) {
      this.reportError('Unterminated CDATA section', start);
    }
    
    const token: CDATAToken = {
      type: HTMLTokenType.CDATA,
      content,
      start,
      end: this.position,
      line: this.line,
      column: this.column,
      raw: this.input.slice(start, this.position)
    };
    
    this.addToken(token);
  }

  private handleDoctype(): void {
    const start = this.position - 9; // Include '<!DOCTYPE'
    this.skipWhitespace();
    
    const name = this.readIdentifier();
    this.skipWhitespace();
    
    let publicId: string | undefined;
    let systemId: string | undefined;
    
    if (this.matchIgnoreCase('PUBLIC')) {
      this.skipWhitespace();
      publicId = this.readQuotedString();
      this.skipWhitespace();
      systemId = this.readQuotedString();
    } else if (this.matchIgnoreCase('SYSTEM')) {
      this.skipWhitespace();
      systemId = this.readQuotedString();
    }
    
    this.skipWhitespace();
    
    if (!this.match('>')) {
      this.reportError('Expected ">" after DOCTYPE', this.position);
    }
    
    const token: DoctypeToken = {
      type: HTMLTokenType.Doctype,
      name,
      publicId,
      systemId,
      start,
      end: this.position,
      line: this.line,
      column: this.column,
      raw: this.input.slice(start, this.position)
    };
    
    this.addToken(token);
  }

  private readTagName(): string {
    let name = '';
    
    while (!this.isAtEnd() && 
           (this.isAlphaNumeric(this.peek()) || 
            this.peek() === '-' || 
            this.peek() === '_' || 
            this.peek() === ':')) {
      name += this.advance();
    }
    
    return name;
  }

  private readAttributes(): Map<string, string> {
    const attributes = new Map<string, string>();
    
    while (!this.isAtEnd() && 
           this.peek() !== '>' && 
           this.peek() !== '/' && 
           !this.checkString('?>')) {
      
      this.skipWhitespace();
      
      if (this.peek() === '>' || this.peek() === '/') break;
      
      const name = this.readAttributeName();
      
      this.skipWhitespace();
      
      let value = '';
      if (this.match('=')) {
        this.skipWhitespace();
        value = this.readAttributeValue();
      }
      
      attributes.set(name, value);
    }
    
    return attributes;
  }

  private readAttributeName(): string {
    let name = '';
    
    while (!this.isAtEnd() && 
           this.peek() !== '=' && 
           this.peek() !== '>' && 
           this.peek() !== '/' && 
           !this.isWhitespace(this.peek())) {
      name += this.advance();
    }
    
    return name;
  }

  private readAttributeValue(): string {
    const quote = this.peek();
    
    if (quote === '"' || quote === "'") {
      return this.readQuotedString();
    } else {
      // Unquoted value
      let value = '';
      while (!this.isAtEnd() && 
             !this.isWhitespace(this.peek()) && 
             this.peek() !== '>') {
        value += this.advance();
      }
      return value;
    }
  }

  private readQuotedString(): string {
    const quote = this.advance(); // consume opening quote
    let value = '';
    
    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance(); // consume escape
        if (!this.isAtEnd()) {
          value += this.advance(); // consume escaped character
        }
      } else {
        value += this.advance();
      }
    }
    
    if (!this.isAtEnd()) {
      this.advance(); // consume closing quote
    } else {
      this.reportError('Unterminated quoted string', this.position);
    }
    
    return value;
  }

  private readIdentifier(): string {
    let identifier = '';
    
    while (!this.isAtEnd() && 
           (this.isAlphaNumeric(this.peek()) || 
            this.peek() === '-' || 
            this.peek() === '_')) {
      identifier += this.advance();
    }
    
    return identifier;
  }

  // Utility methods for character classification and navigation

  private advance(): string {
    if (this.isAtEnd()) return '\0';
    
    const char = this.input[this.position++];
    
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    
    return char;
  }

  private peek(offset: number = 0): string {
    const pos = this.position + offset;
    return pos >= this.input.length ? '\0' : this.input[pos];
  }

  private previous(): string {
    return this.input[this.position - 1];
  }

  private match(expected: string): boolean {
    if (this.checkString(expected)) {
      for (let i = 0; i < expected.length; i++) {
        this.advance();
      }
      return true;
    }
    return false;
  }

  private matchIgnoreCase(expected: string): boolean {
    if (this.checkStringIgnoreCase(expected)) {
      for (let i = 0; i < expected.length; i++) {
        this.advance();
      }
      return true;
    }
    return false;
  }

  private checkString(str: string): boolean {
    for (let i = 0; i < str.length; i++) {
      if (this.peek(i) !== str[i]) return false;
    }
    return true;
  }

  private checkStringIgnoreCase(str: string): boolean {
    for (let i = 0; i < str.length; i++) {
      if (this.peek(i).toLowerCase() !== str[i].toLowerCase()) return false;
    }
    return true;
  }

  private skipWhitespace(): void {
    while (!this.isAtEnd() && this.isWhitespace(this.peek())) {
      this.advance();
    }
  }

  private skipUntil(target: string): void {
    while (!this.isAtEnd() && !this.checkString(target)) {
      this.advance();
    }
  }

  private isAtEnd(): boolean {
    return this.position >= this.input.length;
  }

  private isWhitespace(char: string): boolean {
    return /\s/.test(char);
  }

  private isAlpha(char: string): boolean {
    return /[a-zA-Z]/.test(char);
  }

  private isDigit(char: string): boolean {
    return /[0-9]/.test(char);
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }

  private addToken(token: HTMLToken): void {
    this.tokens.push(token);
  }

  private createEOFToken(): EOFToken {
    return {
      type: HTMLTokenType.EOF,
      start: this.position,
      end: this.position,
      line: this.line,
      column: this.column
    };
  }

  private reportError(message: string, position: number): void {
    const error: HTMLParsingError = {
      message,
      position: {
        line: this.line,
        column: this.column,
        offset: position
      },
      severity: 'error'
    };
    
    this.errors.push(error);
  }

  private handleInvalidMarkup(): void {
    this.reportError('Invalid markup sequence', this.position);
    
    if (this.options.errorRecovery) {
      // Skip to next valid position
      this.skipUntil('>');
      if (!this.isAtEnd()) {
        this.advance(); // consume '>'
      }
    }
  }

  private estimateMemoryUsage(): number {
    // Rough estimation in bytes
    const tokenSize = this.tokens.reduce((sum, token) => {
      return sum + JSON.stringify(token).length * 2; // Unicode characters
    }, 0);
    
    return tokenSize + this.input.length * 2;
  }
}