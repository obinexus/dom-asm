import { 
    HTMLToken, 
    TokenType,
    HTMLTokenType, 
    StartTagToken, 
    EndTagToken, 
    TextToken, 
    CommentToken, 
    ConditionalCommentToken,
    DoctypeToken, 
    CDATAToken, 
    EOFToken,
    TokenizerError,
    TokenizerOptions,
    HTMLTokenBuilder
  } from './HTMLToken';
  
  /**
   * Result of the tokenization process
   */
  export interface TokenizerResult {
    tokens: HTMLToken[];
    errors: TokenizerError[];
  }
  
  /**
   * HTMLTokenizer
   * 
   * Converts HTML string input into a stream of tokens that can be processed by a parser.
   * Handles various HTML elements including tags, attributes, text content, comments, etc.
   */
  export class HTMLTokenizer {
    private _input: string;
    private _position: number;
    private _line: number;
    private _column: number;
    private _tokens: HTMLToken[];
    private _errors: TokenizerError[];
    private _options: TokenizerOptions;
    private _tagStack: string[];
  
    /**
     * Creates a new HTML tokenizer
     * 
     * @param input - The HTML string to tokenize
     * @param options - Configuration options for the tokenizer
     */
    constructor(input: string, options: TokenizerOptions = {}) {
      this._input = input;
      this._position = 0;
      this._line = 1;
      this._column = 1;
      this._tokens = [];
      this._errors = [];
      this._tagStack = [];
      this._options = Object.assign({
        xmlMode: false,
        recognizeCDATA: true,
        recognizeConditionalComments: true,
        preserveWhitespace: false,
        allowUnclosedTags: true,
        advanced: false,
      }, options);
    }
  
    /**
     * Tokenizes the input HTML string
     * 
     * @returns A result object containing tokens and any errors encountered
     */
    public tokenize(): TokenizerResult {
      while (this._position < this._input.length) {
        const char = this._input[this._position];
  
        if (char === '<') {
          this.processTag();
        } else {
          this.processText();
        }
      }
  
      // Add EOF token
      const eofToken: EOFToken = HTMLTokenBuilder.createEOF(
        this._position,
        this._position,
        this._line,
        this._column
      );
      this._tokens.push(eofToken);
  
      return {
        tokens: this._tokens,
        errors: this._errors
      };
    }
  
    /**
     * Processes a tag (opening tag, closing tag, or special tag)
     */
    private processTag(): void {
      const start = this._position;
      const startLine = this._line;
      const startColumn = this._column;
      
      this.advance(); // Skip '<'
  
      if (this._input[this._position] === '/') {
        // End tag
        this.advance(); // Skip '/'
        const tagName = this.readTagName();
  
        if (tagName) {
          const endToken: EndTagToken = HTMLTokenBuilder.createEndTag(
            tagName.toLowerCase(),
            start,
            this._position,
            startLine,
            startColumn,
            undefined // namespace
          );
          this._tokens.push(endToken);
        } else {
          this.reportError('Malformed end tag', start, this._position);
        }
  
        this.skipUntil('>');
      } else if (this._input[this._position] === '!') {
        // Comment, DOCTYPE, or CDATA
        this.advance(); // Skip '!'
        
        if (this.match('--')) {
          // Comment
          this.advance(2); // Skip '--'
          this.handleComment(start, startLine, startColumn);
        } else if (this._options.recognizeCDATA && this.match('[CDATA[')) {
          // CDATA section
          this.advance(7); // Skip '[CDATA['
          this.handleCDATA(start, startLine, startColumn);
        } else if (this.match('DOCTYPE', true)) {
          // DOCTYPE declaration
          this.advance(7); // Skip 'DOCTYPE'
          this.handleDoctype(start, startLine, startColumn);
        } else {
          this.reportError('Malformed special tag', start, this._position);
          this.skipUntil('>');
        }
      } else if (this._input[this._position] === '?') {
        // Processing instruction (e.g., <?xml ...?>)
        this.advance(); // Skip '?'
        this.skipUntil('?>');
        this.advance(); // Skip additional '>'
      } else {
        // Start tag
        const tagName = this.readTagName();
  
        if (tagName) {
          const attributes = this.readAttributes();
          let selfClosing = false;
          
          this.skipWhitespace();
          
          if (this._input[this._position] === '/' && this._input[this._position + 1] === '>') {
            selfClosing = true;
            this.advance(); // Skip '/'
          } else if (this._input[this._position] === '>') {
            selfClosing = this.isSelfClosingTag(tagName);
          }
  
          const startToken: StartTagToken = HTMLTokenBuilder.createStartTag(
            tagName.toLowerCase(),
            attributes,
            selfClosing,
            start,
            this._position,
            startLine,
            startColumn,
            undefined // namespace
          );
          this._tokens.push(startToken);
        } else {
          this.reportError('Malformed start tag', start, this._position);
        }
  
        this.skipUntil('>');
      }
    }
  
    /**
     * Processes text content
     */
    private processText(): void {
      const start = this._position;
      const startLine = this._line;
      const startColumn = this._column;
      let content = '';
  
      while (this._position < this._input.length && this._input[this._position] !== '<') {
        content += this._input[this._position];
        this.advance();
      }
  
      if (content.trim() || this._options.preserveWhitespace) {
        const textToken: TextToken = HTMLTokenBuilder.createText(
          content,
          content.trim().length === 0,
          start,
          this._position,
          startLine,
          startColumn
        );
        this._tokens.push(textToken);
      }
    }
  
    /**
     * Handles comment tokens
     */
    private handleComment(start: number, startLine: number, startColumn: number): void {
      let content = '';
      let isConditional = false;
      
      // Check for conditional comments (IE-specific)
      if (this._options.recognizeConditionalComments && 
          this._position < this._input.length && 
          this._input[this._position] === '[') {
        isConditional = true;
      }
  
      while (this._position < this._input.length) {
        if (this.match('-->')) {
          break;
        }
        content += this._input[this._position];
        this.advance();
      }
  
      this.advance(3); // Skip '-->'
  
      if (isConditional && this._options.recognizeConditionalComments) {
        // Parse conditional comment
        const match = content.match(/^\[if\s+([^\]]+)\]>?([\s\S]*?)<!\[endif\]$/i);
        
        if (match) {
          const condition = match[1].trim();
          const conditionalContent = match[2].trim();
          
          const commentToken: ConditionalCommentToken = HTMLTokenBuilder.createConditionalComment(
            condition,
            conditionalContent,
            start,
            this._position,
            startLine,
            startColumn
          );
          this._tokens.push(commentToken);
        } else {
          // Fallback to regular comment if malformed conditional comment
          const commentToken: CommentToken = HTMLTokenBuilder.createComment(
            content.trim(),
            start,
            this._position,
            startLine,
            startColumn,
            false
          );
          this._tokens.push(commentToken);
        }
      } else {
        // Regular comment
        const commentToken: CommentToken = HTMLTokenBuilder.createComment(
          content.trim(),
          start,
          this._position,
          startLine,
          startColumn,
          false
        );
        this._tokens.push(commentToken);
      }
    }
  
    /**
     * Handles CDATA section tokens
     */
    private handleCDATA(start: number, startLine: number, startColumn: number): void {
      let content = '';
  
      while (this._position < this._input.length) {
        if (this.match(']]>')) {
          break;
        }
        content += this._input[this._position];
        this.advance();
      }
  
      this.advance(3); // Skip ']]>'
  
      const cdataToken: CDATAToken = HTMLTokenBuilder.createCDATA(
        content,
        start,
        this._position,
        startLine,
        startColumn
      );
      this._tokens.push(cdataToken);
    }
  
    /**
     * Handles DOCTYPE declaration tokens
     */
    private handleDoctype(start: number, startLine: number, startColumn: number): void {
      this.skipWhitespace();
      
      // Read DOCTYPE name
      let name = 'html'; // Default name
      let publicId = undefined;
      let systemId = undefined;
      
      // Simple approach for now - more robust parsing would handle quoted strings properly
      if (/[a-zA-Z]/.test(this._input[this._position])) {
        name = this.readUntil(c => /[\s>]/.test(c)).toLowerCase();
      }
      
      // Look for PUBLIC or SYSTEM identifiers
      this.skipWhitespace();
      if (this.match('PUBLIC', true)) {
        this.advance(6);
        this.skipWhitespace();
        
        // Read public identifier
        const quote = this._input[this._position];
        if (quote === '"' || quote === "'") {
          this.advance();
          publicId = this.readUntil(c => c === quote);
          this.advance();
        }
        
        // Check for system identifier
        this.skipWhitespace();
        const nextQuote = this._input[this._position];
        if (nextQuote === '"' || nextQuote === "'") {
          this.advance();
          systemId = this.readUntil(c => c === nextQuote);
          this.advance();
        }
      } else if (this.match('SYSTEM', true)) {
        this.advance(6);
        this.skipWhitespace();
        
        // Read system identifier
        const quote = this._input[this._position];
        if (quote === '"' || quote === "'") {
          this.advance();
          systemId = this.readUntil(c => c === quote);
          this.advance();
        }
      }
      
      // Skip to the end of the DOCTYPE
      while (this._position < this._input.length && this._input[this._position] !== '>') {
        this.advance();
      }
      this.advance(); // Skip '>'
  
      const doctypeToken: DoctypeToken = HTMLTokenBuilder.createDoctype(
        name,
        start,
        this._position,
        startLine,
        startColumn,
        publicId,
        systemId
      );
      this._tokens.push(doctypeToken);
    }
  
    /**
     * Reads attributes from a start tag
     * 
     * @returns A map of attribute names to their values
     */
    private readAttributes(): Map<string, string> {
      const attributes = new Map<string, string>();
      
      while (this._position < this._input.length) {
        this.skipWhitespace();
        
        if (this._input[this._position] === '>' || 
            this._input[this._position] === '/' || 
            this._input[this._position] === '?') {
          break;
        }
        
        const attributeName = this.readAttributeName();
        if (!attributeName) break;
        
        let attributeValue = '';
        this.skipWhitespace();
        
        if (this._input[this._position] === '=') {
          this.advance(); // Skip '='
          this.skipWhitespace();
          attributeValue = this.readAttributeValue();
        }
        
        attributes.set(attributeName.toLowerCase(), attributeValue);
      }
      
      return attributes;
    }
  
    /**
     * Reads an attribute name
     * 
     * @returns The attribute name or empty string if none found
     */
    private readAttributeName(): string {
      let name = '';
      
      while (this._position < this._input.length) {
        const char = this._input[this._position];
        if (/[\s=\/>\?]/.test(char)) break;
        name += char;
        this.advance();
      }
      
      return name;
    }
  
    /**
     * Reads an attribute value
     * 
     * @returns The attribute value
     */
    private readAttributeValue(): string {
      const quote = this._input[this._position];
      
      if (quote === '"' || quote === "'") {
        this.advance(); // Skip opening quote
        const value = this.readUntil(c => c === quote);
        this.advance(); // Skip closing quote
        return value;
      }
      
      // Unquoted attribute value
      return this.readUntil(c => /[\s>\/]/.test(c));
    }
  
    /**
     * Reads a tag name
     * 
     * @returns The tag name or empty string if none found
     */
    private readTagName(): string {
      let name = '';
      
      while (this._position < this._input.length) {
        const char = this._input[this._position];
        if (!/[a-zA-Z0-9\-\_\:\.]/.test(char)) break;
        name += char;
        this.advance();
      }
      
      return name;
    }
  
    /**
     * Checks if a tag is self-closing by HTML specification
     * 
     * @param tagName - The tag name to check
     * @returns Whether the tag is self-closing
     */
    private isSelfClosingTag(tagName: string): boolean {
      // These elements are self-closing by HTML5 spec
      const selfClosingTags = [
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 
        'link', 'meta', 'param', 'source', 'track', 'wbr'
      ];
      
      return selfClosingTags.includes(tagName.toLowerCase());
    }
  
    /**
     * Skips to a specific character and advances past it
     * 
     * @param char - The character to skip to
     */
    private skipUntil(char: string): void {
      while (this._position < this._input.length && 
             !this.match(char)) {
        this.advance();
      }
      
      if (this._position < this._input.length) {
        this.advance(char.length); // Skip the target sequence
      }
    }
  
    /**
     * Reads until a predicate function returns true
     * 
     * @param predicate - The function to test each character
     * @returns The read string
     */
    private readUntil(predicate: (char: string) => boolean): string {
      let result = '';
      
      while (this._position < this._input.length && 
             !predicate(this._input[this._position])) {
        result += this._input[this._position];
        this.advance();
      }
      
      return result;
    }
  
    /**
     * Skips whitespace characters
     */
    private skipWhitespace(): void {
      while (this._position < this._input.length && 
             this.isWhitespace(this._input[this._position])) {
        this.advance();
      }
    }
  
    /**
     * Checks if a character is whitespace
     * 
     * @param char - The character to check
     * @returns Whether the character is whitespace
     */
    private isWhitespace(char: string): boolean {
      return /\s/.test(char);
    }
  
    /**
     * Checks if the input at current position matches a string
     * 
     * @param str - The string to match
     * @param caseInsensitive - Whether to match case-insensitively
     * @returns Whether the string matches
     */
    private match(str: string, caseInsensitive: boolean = false): boolean {
      if (this._position + str.length > this._input.length) {
        return false;
      }
      
      if (caseInsensitive) {
        return this._input.substring(this._position, this._position + str.length)
                         .toLowerCase() === str.toLowerCase();
      }
      
      return this._input.substring(this._position, this._position + str.length) === str;
    }
  
    /**
     * Advances the position by a number of characters
     * 
     * @param count - The number of characters to advance by (default: 1)
     * @returns The character at the previous position
     */
    private advance(count: number = 1): string {
      const char = this._input[this._position];
      
      for (let i = 0; i < count && this._position < this._input.length; i++) {
        if (this._input[this._position] === '\n') {
          this._line++;
          this._column = 1;
        } else {
          this._column++;
        }
        this._position++;
      }
      
      return char;
    }
  
    /**
     * Reports an error during tokenization
     * 
     * @param message - The error message
     * @param start - The start position of the error
     * @param end - The end position of the error
     * @param severity - The severity of the error
     */
    private reportError(message: string, start: number, end: number, severity: 'warning' | 'error' = 'error'): void {
      this._errors.push({
        message,
        severity,
        line: this._line,
        column: this._column,
        start,
        end
      });
    }
  
    /**
     * Checks if there are any unclosed tags
     * 
     * @returns Whether there are unclosed tags
     */
    public hasUnclosedTags(): boolean {
      const stack: string[] = [];
      
      for (const token of this._tokens) {
        if (token.type === HTMLTokenType.StartTag) {
          const startToken = token as StartTagToken;
          if (!startToken.selfClosing) {
            stack.push(startToken.name);
          }
        } else if (token.type === HTMLTokenType.EndTag) {
          const endToken = token as EndTagToken;
          
          if (stack.length > 0 && stack[stack.length - 1] === endToken.name) {
            stack.pop();
          }
        }
      }
      
      return stack.length > 0;
    }
  }