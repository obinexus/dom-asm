import { CSSToken, Position } from '../tokenization/CSSToken';

/**
 * CSS Parser Error
 * Represents an error that occurred during parsing
 */
export class CSSParserError extends Error {
  /**
   * The position where the error occurred
   */
  public readonly position: Position;
  
  /**
   * The token that caused the error
   */
  public readonly token: CSSToken | null;
  
  /**
   * Creates a new parser error
   * 
   * @param message - The error message
   * @param position - The position where the error occurred
   * @param token - The token that caused the error
   */
  constructor(message: string, position: Position, token: CSSToken | null = null) {
    super(`${message} at line ${position.line}, column ${position.column}`);
    this.name = 'CSSParserError';
    this.position = position;
    this.token = token;
  }
  
  /**
   * Creates a string representation of the error
   * 
   * @returns A string representation
   */
  public toString(): string {
    return `${this.name}: ${this.message}`;
  }
}