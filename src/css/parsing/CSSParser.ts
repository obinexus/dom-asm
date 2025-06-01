import { CSSToken } from '../tokenization/CSSToken';
import { CSSTokenType } from '../tokenization/CSSTokenType';
import { CSSAST } from '../ast/CSSAST';
import { CSSNode } from '../ast/CSSNode';
import { CSSParserError } from './CSSParserError';

/**
 * Parser options
 */
export interface CSSParserOptions {
  errorRecovery?: boolean;
  preserveComments?: boolean;
  strict?: boolean;
}

/**
 * CSS Parser
 * Parses tokens into an AST
 */
export class CSSParser {
  /**
   * The tokens to parse
   */
  private tokens: CSSToken[];
  
  /**
   * Current position in the token stream
   */
  private position: number;
  
  /**
   * Parser errors
   */
  public errors: CSSParserError[];
  
  /**
   * Parser options
   */
  private options: CSSParserOptions;
  
  /**
   * Creates a new CSS parser
   * 
   * @param tokens - The tokens to parse
   * @param options - Parser options
   */
  constructor(tokens: CSSToken[], options: CSSParserOptions = {}) {
    this.tokens = tokens;
    this.position = 0;
    this.errors = [];
    this.options = {
      errorRecovery: true,
      preserveComments: false,
      strict: false,
      ...options
    };
  }
  
  /**
   * Parses tokens into an AST
   * 
   * @returns The parsed AST
   */
  public parse(): CSSAST {
    const ast = this.parseStylesheet();
    
    // Validate parsing completed
    if (this.position < this.tokens.length - 1) { // -1 for EOF
      this.addError('Unexpected tokens at end of input');
    }
    
    return ast;
  }
  
  /**
   * Parses the entire stylesheet
   * 
   * @returns The parsed AST
   */
  private parseStylesheet(): CSSAST {
    const root = new CSSNode('stylesheet');
    
    // Main parsing loop
    while (this.position < this.tokens.length) {
      const token = this.peek();
      
      // Handle EOF
      if (!token || token.type === CSSTokenType.EOF) {
        break;
      }
      
      // Skip comments if not preserving them
      if (token.type === CSSTokenType.Comment) {
        if (this.options.preserveComments) {
          const commentNode = new CSSNode('comment', token.value.toString());
          root.addChild(commentNode);
        }
        this.consume();
        continue;
      }
      
      // Skip whitespace
      if (token.type === CSSTokenType.Whitespace) {
        this.consume();
        continue;
      }
      
      // Parse at-rules or regular rules
      if (token.type === CSSTokenType.AtKeyword) {
        try {
          const atRule = this.parseAtRule();
          if (atRule) root.addChild(atRule);
        } catch (error) {
          if (error instanceof CSSParserError) {
            this.errors.push(error);
            if (!this.options.errorRecovery) throw error;
            this.recoverFromError();
          } else {
            throw error; // Re-throw unknown errors
          }
        }
      } else {
        try {
          const rule = this.parseRule();
          if (rule) root.addChild(rule);
        } catch (error) {
          if (error instanceof CSSParserError) {
            this.errors.push(error);
            if (!this.options.errorRecovery) throw error;
            this.recoverFromError();
          } else {
            throw error; // Re-throw unknown errors
          }
        }
      }
    }
    
    return new CSSAST(root);
  }
  
  /**
   * Parses an at-rule
   * 
   * @returns The parsed at-rule node
   */
  private parseAtRule(): CSSNode {
    const token = this.consume(); // @-keyword
    const atRule = new CSSNode('at-rule', token.value.toString());
    
    // Parse prelude
    const prelude = new CSSNode('prelude');
    
    while (this.position < this.tokens.length) {
      const token = this.peek();
      
      if (!token || 
          token.type === CSSTokenType.EOF || 
          token.type === CSSTokenType.StartBlock || 
          token.type === CSSTokenType.Semicolon) {
        break;
      }
      
      if (token.type === CSSTokenType.Whitespace || token.type === CSSTokenType.Comment) {
        this.consume();
        continue;
      }
      
      // Add text node for prelude content
      prelude.addChild(new CSSNode('text', token.value.toString()));
      this.consume();
    }
    
    if (prelude.children.length > 0) {
      atRule.addChild(prelude);
    }
    
    // Parse block if present
    if (this.peek()?.type === CSSTokenType.StartBlock) {
      this.consume(); // {
      const block = this.parseBlock();
      atRule.addChild(block);
    } else if (this.peek()?.type === CSSTokenType.Semicolon) {
      this.consume(); // ;
    } else {
      this.addError('Expected { or ; after at-rule');
    }
    
    return atRule;
  }
  
  /**
   * Parses a CSS rule
   * 
   * @returns The parsed rule node
   */
  private parseRule(): CSSNode {
    const rule = new CSSNode('rule');
    const selectors: CSSNode[] = [];
    let hasBlock = false;
    
    // Parse selectors
    while (this.position < this.tokens.length) {
      const token = this.peek();
      
      if (!token || token.type === CSSTokenType.EOF) {
        break;
      }
      
      if (token.type === CSSTokenType.StartBlock) {
        hasBlock = true;
        this.consume();
        break;
      }
      
      if (token.type === CSSTokenType.Whitespace || token.type === CSSTokenType.Comment) {
        this.consume();
        continue;
      }
      
      if (token.type === CSSTokenType.Comma) {
        this.consume();
        continue;
      }
      
      if (token.type === CSSTokenType.Selector || token.type === CSSTokenType.Property) {
        selectors.push(new CSSNode('selector', token.value.toString()));
        this.consume();
      } else {
        // Skip unknown tokens
        this.consume();
      }
    }
    
    // Add selectors to rule
    for (const selector of selectors) {
      rule.addChild(selector);
    }
    
    // Parse declarations if we found a block
    if (hasBlock) {
      const declarations = this.parseDeclarations();
      
      // Add declarations to rule
      for (const declaration of declarations) {
        rule.addChild(declaration);
      }
      
      // Consume closing brace
      if (this.peek()?.type === CSSTokenType.EndBlock) {
        this.consume();
      } else {
        this.addError('Expected } at end of rule');
      }
    }
    
    // Only return a rule if we have valid selectors
    if (selectors.length > 0) {
      return rule;
    }
    
    return null;
  }
  
  /**
   * Parses a block of declarations
   * 
   * @returns An array of declaration nodes
   */
  private parseBlock(): CSSNode {
    const block = new CSSNode('block');
    const declarations = this.parseDeclarations();
    
    // Add declarations to block
    for (const declaration of declarations) {
      block.addChild(declaration);
    }
    
    // Consume closing brace
    if (this.peek()?.type === CSSTokenType.EndBlock) {
      this.consume();
    } else {
      this.addError('Expected } at end of block');
    }
    
    return block;
  }
  
  /**
   * Parses declarations inside a block
   * 
   * @returns An array of declaration nodes
   */
  private parseDeclarations(): CSSNode[] {
    const declarations: CSSNode[] = [];
    
    while (this.position < this.tokens.length) {
      const token = this.peek();
      
      if (!token || 
          token.type === CSSTokenType.EOF || 
          token.type === CSSTokenType.EndBlock) {
        break;
      }
      
      if (token.type === CSSTokenType.Whitespace || token.type === CSSTokenType.Comment) {
        this.consume();
        continue;
      }
      
      try {
        const declaration = this.parseDeclaration();
        if (declaration) {
          declarations.push(declaration);
        }
      } catch (error) {
        if (error instanceof CSSParserError) {
          this.errors.push(error);
          if (!this.options.errorRecovery) throw error;
          this.recoverFromError();
        } else {
          throw error; // Re-throw unknown errors
        }
      }
    }
    
    return declarations;
  }
  
  /**
   * Parses a single declaration
   * 
   * @returns A declaration node
   */
  private parseDeclaration(): CSSNode | null {
    // Get property
    const token = this.peek();
    if (!token || (token.type !== CSSTokenType.Property && token.type !== CSSTokenType.Selector)) {
      return null;
    }
    
    const property = new CSSNode('property', token.value.toString());
    this.consume();
    
    // Skip whitespace
    this.skipWhitespace();
    
    // Expect colon
    if (this.peek()?.type !== CSSTokenType.Colon) {
      this.addError('Expected : after property name');
      this.skipToSemicolon();
      return null;
    }
    this.consume(); // :
    
    // Skip whitespace
    this.skipWhitespace();
    
    // Parse values
    const values: CSSNode[] = [];
    while (this.position < this.tokens.length) {
      const token = this.peek();
      
      if (!token || 
          token.type === CSSTokenType.EOF || 
          token.type === CSSTokenType.Semicolon || 
          token.type === CSSTokenType.EndBlock) {
        break;
      }
      
      if (token.type === CSSTokenType.Whitespace || token.type === CSSTokenType.Comment) {
        this.consume();
        continue;
      }
      
      // Add value
      values.push(new CSSNode('value', token.value.toString()));
      this.consume();
    }
    
    // Create declaration node
    const declaration = new CSSNode('declaration');
    declaration.addChild(property);
    
    // Add values to declaration
    for (const value of values) {
      declaration.addChild(value);
    }
    
    // Optional semicolon
    if (this.peek()?.type === CSSTokenType.Semicolon) {
      this.consume();
    }
    
    return declaration;
  }
  
  /**
   * Skips whitespace tokens
   */
  private skipWhitespace(): void {
    while (this.position < this.tokens.length && 
           this.peek()?.type === CSSTokenType.Whitespace) {
      this.consume();
    }
  }
  
  /**
   * Skips to the next semicolon (error recovery)
   */
  private skipToSemicolon(): void {
    while (this.position < this.tokens.length) {
      const token = this.peek();
      if (!token || 
          token.type === CSSTokenType.Semicolon || 
          token.type === CSSTokenType.EndBlock) {
        break;
      }
      this.consume();
    }
    
    if (this.peek()?.type === CSSTokenType.Semicolon) {
      this.consume();
    }
  }
  
  /**
   * Recovers from an error by skipping to the next rule
   */
  private recoverFromError(): void {
    while (this.position < this.tokens.length) {
      const token = this.peek();
      
      if (!token || token.type === CSSTokenType.EOF) {
        break;
      }
      
      // Skip to the end of the current block
      if (token.type === CSSTokenType.EndBlock) {
        this.consume();
        break;
      }
      
      // Skip to the next semicolon
      if (token.type === CSSTokenType.Semicolon) {
        this.consume();
        break;
      }
      
      // Found potential start of new rule
      if (token.type === CSSTokenType.Selector || token.type === CSSTokenType.AtKeyword) {
        break;
      }
      
      this.consume();
    }
  }
  
  /**
   * Peeks at the current token
   * 
   * @returns The current token or null
   */
  private peek(): CSSToken | null {
    return this.tokens[this.position] || null;
  }
  
  /**
   * Consumes the current token
   * 
   * @returns The consumed token
   */
  private consume(): CSSToken {
    return this.tokens[this.position++];
  }
  
  /**
   * Adds a parser error
   * 
   * @param message - The error message
   */
  private addError(message: string): void {
    const token = this.peek();
    this.errors.push(new CSSParserError(
      message,
      token ? token.position : { line: 0, column: 0 },
      token
    ));
  }
}