/**
 * Enum-like object defining HTML token types
 */
export const HTMLTokenType = {
    StartTag: 'StartTag',
    EndTag: 'EndTag',
    Text: 'Text',
    Comment: 'Comment',
    ConditionalComment: 'ConditionalComment',
    Doctype: 'Doctype',
    CDATA: 'CDATA',
    EOF: 'EOF'
  } as const;
  
  export type TokenType = typeof HTMLTokenType[keyof typeof HTMLTokenType];
  
  /**
   * Base token interface with common properties
   */
  export interface BaseToken {
    type: TokenType;
    start: number;
    end: number;
    line: number;
    column: number;
  }
  
  /**
   * StartTag token with attributes
   */
  export interface StartTagToken extends BaseToken {
    type: 'StartTag';
    name: string;
    attributes: Map<string, string>;
    selfClosing: boolean;
    namespace?: string;
  }
  
  /**
   * EndTag token
   */
  export interface EndTagToken extends BaseToken {
    type: 'EndTag';
    name: string;
    namespace?: string;
  }
  
  /**
   * Text content token
   */
  export interface TextToken extends BaseToken {
    type: 'Text';
    content: string;
    isWhitespace: boolean;
  }
  
  /**
   * Comment token
   */
  export interface CommentToken extends BaseToken {
    type: 'Comment';
    data: string;
    isConditional?: boolean;
  }
  
  /**
   * Conditional comment token (IE-specific)
   */
  export interface ConditionalCommentToken extends BaseToken {
    type: 'ConditionalComment';
    condition: string;
    content: string;
  }
  
  /**
   * DOCTYPE declaration token
   */
  export interface DoctypeToken extends BaseToken {
    type: 'Doctype';
    name: string;
    publicId?: string;
    systemId?: string;
  }
  
  /**
   * CDATA section token
   */
  export interface CDATAToken extends BaseToken {
    type: 'CDATA';
    content: string;
  }
  
  /**
   * End-of-file token
   */
  export interface EOFToken extends BaseToken {
    type: 'EOF';
  }
  
  /**
   * Union type of all possible token types
   */
  export type HTMLToken = 
    | StartTagToken 
    | EndTagToken 
    | TextToken 
    | CommentToken 
    | ConditionalCommentToken 
    | DoctypeToken 
    | CDATAToken 
    | EOFToken;
  
  /**
   * Error information for tokenization errors
   */
  export interface TokenizerError {
    message: string;
    severity: 'warning' | 'error';
    line: number;
    column: number;
    start: number;
    end: number;
  }
  
  /**
   * Configuration options for the HTML tokenizer
   */
  export interface TokenizerOptions {
    xmlMode?: boolean;
    recognizeCDATA?: boolean;
    recognizeConditionalComments?: boolean;
    preserveWhitespace?: boolean;
    allowUnclosedTags?: boolean;
    advanced?: boolean;
  }
  
  /**
   * Base class for HTML tokens with validation
   */
  export class HTMLBaseToken {
    readonly type: TokenType;
    readonly start: number;
    readonly end: number;
    readonly line: number;
    readonly column: number;
  
    constructor(type: TokenType, start: number, end: number, line: number, column: number) {
      if (!Object.values(HTMLTokenType).includes(type)) {
        throw new TypeError(`Invalid token type: ${type}`);
      }
      
      this.validateNumber('start', start);
      this.validateNumber('end', end);
      this.validateNumber('line', line);
      this.validateNumber('column', column);
      
      this.type = type;
      this.start = start;
      this.end = end;
      this.line = line;
      this.column = column;
      
      Object.freeze(this);
    }
    
    protected validateNumber(field: string, value: number): void {
      if (typeof value !== 'number' || isNaN(value)) {
        throw new TypeError(`${field} must be a valid number`);
      }
    }
  }
  
  /**
   * Start tag token implementation
   */
  export class StartTagTokenImpl extends HTMLBaseToken implements StartTagToken {
    readonly name: string;
    readonly attributes: Map<string, string>;
    readonly selfClosing: boolean;
    readonly namespace?: string;
  
    constructor(
      name: string, 
      attributes: Map<string, string>, 
      selfClosing: boolean, 
      start: number, 
      end: number, 
      line: number, 
      column: number, 
      namespace?: string
    ) {
      super(HTMLTokenType.StartTag, start, end, line, column);
      
      if (typeof name !== 'string') {
        throw new TypeError('name must be a string');
      }
      if (!(attributes instanceof Map)) {
        throw new TypeError('attributes must be a Map');
      }
      if (typeof selfClosing !== 'boolean') {
        throw new TypeError('selfClosing must be a boolean');
      }
      if (namespace && typeof namespace !== 'string') {
        throw new TypeError('namespace must be a string if provided');
      }
      
      this.name = name;
      this.attributes = attributes;
      this.selfClosing = selfClosing;
      this.namespace = namespace;
      
      Object.freeze(this);
    }
  }
  
  /**
   * End tag token implementation
   */
  export class EndTagTokenImpl extends HTMLBaseToken implements EndTagToken {
    readonly name: string;
    readonly namespace?: string;
  
    constructor(
      name: string, 
      start: number, 
      end: number, 
      line: number, 
      column: number, 
      namespace?: string
    ) {
      super(HTMLTokenType.EndTag, start, end, line, column);
      
      if (typeof name !== 'string') {
        throw new TypeError('name must be a string');
      }
      if (namespace && typeof namespace !== 'string') {
        throw new TypeError('namespace must be a string if provided');
      }
      
      this.name = name;
      this.namespace = namespace;
      
      Object.freeze(this);
    }
  }
  
  /**
   * Text token implementation
   */
  export class TextTokenImpl extends HTMLBaseToken implements TextToken {
    readonly content: string;
    readonly isWhitespace: boolean;
  
    constructor(
      content: string, 
      isWhitespace: boolean, 
      start: number, 
      end: number, 
      line: number,
      column: number
    ) {
      super(HTMLTokenType.Text, start, end, line, column);
      
      if (typeof content !== 'string') {
        throw new TypeError('content must be a string');
      }
      if (typeof isWhitespace !== 'boolean') {
        throw new TypeError('isWhitespace must be a boolean');
      }
      
      this.content = content;
      this.isWhitespace = isWhitespace;
      
      Object.freeze(this);
    }
  }
  
  /**
   * Comment token implementation
   */
  export class CommentTokenImpl extends HTMLBaseToken implements CommentToken {
    readonly data: string;
    readonly isConditional: boolean;
  
    constructor(
      data: string, 
      start: number, 
      end: number, 
      line: number, 
      column: number, 
      isConditional: boolean = false
    ) {
      super(HTMLTokenType.Comment, start, end, line, column);
      
      if (typeof data !== 'string') {
        throw new TypeError('data must be a string');
      }
      if (typeof isConditional !== 'boolean') {
        throw new TypeError('isConditional must be a boolean');
      }
      
      this.data = data;
      this.isConditional = isConditional;
      
      Object.freeze(this);
    }
  }
  
  /**
   * Conditional comment token implementation
   */
  export class ConditionalCommentTokenImpl extends HTMLBaseToken implements ConditionalCommentToken {
    readonly condition: string;
    readonly content: string;
  
    constructor(
      condition: string, 
      content: string, 
      start: number, 
      end: number, 
      line: number, 
      column: number
    ) {
      super(HTMLTokenType.ConditionalComment, start, end, line, column);
      
      if (typeof condition !== 'string') {
        throw new TypeError('condition must be a string');
      }
      if (typeof content !== 'string') {
        throw new TypeError('content must be a string');
      }
      
      this.condition = condition;
      this.content = content;
      
      Object.freeze(this);
    }
  }
  
  /**
   * DOCTYPE token implementation
   */
  export class DoctypeTokenImpl extends HTMLBaseToken implements DoctypeToken {
    readonly name: string;
    readonly publicId?: string;
    readonly systemId?: string;
  
    constructor(
      name: string, 
      start: number, 
      end: number, 
      line: number, 
      column: number, 
      publicId?: string, 
      systemId?: string
    ) {
      super(HTMLTokenType.Doctype, start, end, line, column);
      
      if (typeof name !== 'string') {
        throw new TypeError('name must be a string');
      }
      if (publicId && typeof publicId !== 'string') {
        throw new TypeError('publicId must be a string if provided');
      }
      if (systemId && typeof systemId !== 'string') {
        throw new TypeError('systemId must be a string if provided');
      }
      
      this.name = name;
      this.publicId = publicId;
      this.systemId = systemId;
      
      Object.freeze(this);
    }
  }
  
  /**
   * CDATA token implementation
   */
  export class CDATATokenImpl extends HTMLBaseToken implements CDATAToken {
    readonly content: string;
  
    constructor(
      content: string, 
      start: number, 
      end: number, 
      line: number, 
      column: number
    ) {
      super(HTMLTokenType.CDATA, start, end, line, column);
      
      if (typeof content !== 'string') {
        throw new TypeError('content must be a string');
      }
      
      this.content = content;
      
      Object.freeze(this);
    }
  }
  
  /**
   * EOF token implementation
   */
  export class EOFTokenImpl extends HTMLBaseToken implements EOFToken {
    constructor(start: number, end: number, line: number, column: number) {
      super(HTMLTokenType.EOF, start, end, line, column);
      Object.freeze(this);
    }
  }
  
  /**
   * Factory class for creating tokens with validation
   */
  export class HTMLTokenBuilder {
    /**
     * Creates a start tag token
     */
    static createStartTag(
      name: string, 
      attributes: Map<string, string>, 
      selfClosing: boolean,
      start: number, 
      end: number, 
      line: number, 
      column: number, 
      namespace?: string
    ): StartTagToken {
      return new StartTagTokenImpl(name, attributes, selfClosing, start, end, line, column, namespace);
    }
    
    /**
     * Creates an end tag token
     */
    static createEndTag(
      name: string, 
      start: number, 
      end: number, 
      line: number, 
      column: number, 
      namespace?: string
    ): EndTagToken {
      return new EndTagTokenImpl(name, start, end, line, column, namespace);
    }
    
    /**
     * Creates a text token
     */
    static createText(
      content: string, 
      isWhitespace: boolean, 
      start: number, 
      end: number, 
      line: number, 
      column: number
    ): TextToken {
      return new TextTokenImpl(content, isWhitespace, start, end, line, column);
    }
    
    /**
     * Creates a comment token
     */
    static createComment(
      data: string, 
      start: number, 
      end: number, 
      line: number, 
      column: number, 
      isConditional: boolean
    ): CommentToken {
      return new CommentTokenImpl(data, start, end, line, column, isConditional);
    }
    
    /**
     * Creates a conditional comment token
     */
    static createConditionalComment(
      condition: string, 
      content: string, 
      start: number, 
      end: number, 
      line: number, 
      column: number
    ): ConditionalCommentToken {
      return new ConditionalCommentTokenImpl(condition, content, start, end, line, column);
    }
    
    /**
     * Creates a DOCTYPE token
     */
    static createDoctype(
      name: string, 
      start: number, 
      end: number, 
      line: number, 
      column: number,
      publicId?: string, 
      systemId?: string
    ): DoctypeToken {
      return new DoctypeTokenImpl(name, start, end, line, column, publicId, systemId);
    }
    
    /**
     * Creates a CDATA token
     */
    static createCDATA(
      content: string, 
      start: number, 
      end: number, 
      line: number, 
      column: number
    ): CDATAToken {
      return new CDATATokenImpl(content, start, end, line, column);
    }
    
    /**
     * Creates an EOF token
     */
    static createEOF(
      start: number, 
      end: number, 
      line: number, 
      column: number
    ): EOFToken {
      return new EOFTokenImpl(start, end, line, column);
    }
  }