import WebSocket from 'ws';

export interface Position {
  x: number;
  y: number;
}

export interface Ship {
  position: Position;
  direction: boolean;
  length: number;
  type: 'small' | 'medium' | 'large' | 'huge';
}

export interface ShipState extends Ship {
  hits: Set<string>;
}

export interface Player {
  name: string;
  index: string;
  password: string;
  wins: number;
  ws?: WebSocket;
}

export interface GamePlayer {
  playerIndex: string;
  idPlayer: string;
  ships: ShipState[];
  board: Map<string, 'miss' | 'hit'>;
}

export interface Room {
  roomId: string;
  players: string[];
  status: 'waiting' | 'ready' | 'playing';
}

export interface Game {
  idGame: string;
  roomId: string;
  players: Map<string, GamePlayer>;
  currentTurn: string;
  started: boolean;
  finished: boolean;
}

export interface Message {
  type: string;
  data: any;
  id: number;
}

export interface RegRequest {
  name: string;
  password: string;
}

export interface RegResponse {
  name: string;
  index: string;
  error: boolean;
  errorText: string;
}

export interface AddUserToRoomRequest {
  indexRoom: string;
}

export interface CreateGameResponse {
  idGame: string;
  idPlayer: string;
}

export interface AddShipsRequest {
  gameId: string;
  ships: Ship[];
  indexPlayer: string;
}

export interface StartGameResponse {
  ships: Ship[];
  currentPlayerIndex: string;
}

export interface AttackRequest {
  gameId: string;
  x: number;
  y: number;
  indexPlayer: string;
}

export interface AttackResponse {
  position: Position;
  currentPlayer: string;
  status: 'miss' | 'killed' | 'shot';
}

export interface RandomAttackRequest {
  gameId: string;
  indexPlayer: string;
}

export interface TurnResponse {
  currentPlayer: string;
}

export interface FinishResponse {
  winPlayer: string;
}

export interface RoomUpdate {
  roomId: string;
  roomUsers: Array<{
    name: string;
    index: string;
  }>;
}

export interface Winner {
  name: string;
  wins: number;
}