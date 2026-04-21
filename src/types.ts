export type TokenType = 'move' | 'link' | 'modifier';

export interface MoveDef {
  id: string;
  name: string; // Display Name (e.g., "S.MP")
  input: string; // Input Notation (e.g., "5MP")
  type: 'normal' | 'special' | 'super' | 'other';
}

export interface MoveToken {
  type: 'move';
  id: string; // References MoveDef.id
}

export interface LinkToken {
  type: 'link';
  kind: 'normal' | 'cancel';
}

export interface ModifierToken {
  type: 'modifier';
  kind: 'delay'; // extensible
  // value?: number; // Future extension: delay in frames?
}

export type ComboToken = MoveToken | LinkToken | ModifierToken;

// Helper type guards
export const isMoveToken = (token: ComboToken): token is MoveToken => token.type === 'move';
export const isLinkToken = (token: ComboToken): token is LinkToken => token.type === 'link';
export const isModifierToken = (token: ComboToken): token is ModifierToken => token.type === 'modifier';
