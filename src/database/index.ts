import { Player, Room, Game } from '../types';

class Database {
  private players: Map<string, Player> = new Map();
  private rooms: Map<string, Room> = new Map();
  private games: Map<string, Game> = new Map();
  private playerIndexCounter = 1;
  private roomIdCounter = 1;
  private gameIdCounter = 1;

  registerPlayer(name: string, password: string): { player: Player; isNew: boolean } {
    const existingPlayer = Array.from(this.players.values()).find(p => p.name === name);

    if (existingPlayer) {
      if (existingPlayer.password === password) {
        return { player: existingPlayer, isNew: false };
      } else {
        throw new Error('Invalid password');
      }
    }

    const newPlayer: Player = {
      name,
      index: String(this.playerIndexCounter++),
      password,
      wins: 0,
    };

    this.players.set(newPlayer.index, newPlayer);
    return { player: newPlayer, isNew: true };
  }

  getPlayer(index: string): Player | undefined {
    return this.players.get(index);
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  incrementWins(playerIndex: string): void {
    const player = this.players.get(playerIndex);
    if (player) {
      player.wins++;
    }
  }

  createRoom(playerIndex: string): Room {
    const roomId = String(this.roomIdCounter++);
    const room: Room = {
      roomId,
      players: [playerIndex],
      status: 'waiting',
    };
    this.rooms.set(roomId, room);
    return room;
  }

  addPlayerToRoom(roomId: string, playerIndex: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room || room.players.length >= 2) {
      return null;
    }

    room.players.push(playerIndex);
    room.status = 'ready';
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getAvailableRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(room => room.status === 'waiting');
  }

  removeRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }

  createGame(roomId: string): Game {
    const room = this.rooms.get(roomId);
    if (!room || room.players.length !== 2) {
      throw new Error('Cannot create game: room not ready');
    }

    const gameId = String(this.gameIdCounter++);
    const game: Game = {
      idGame: gameId,
      roomId,
      players: new Map(),
      currentTurn: '',
      started: false,
      finished: false,
    };

    room.players.forEach((playerIndex, idx) => {
      const idPlayer = `${gameId}_player${idx + 1}`;
      game.players.set(idPlayer, {
        playerIndex,
        idPlayer,
        ships: [],
        board: new Map(),
      });
    });

    this.games.set(gameId, game);
    return game;
  }

  getGame(gameId: string): Game | undefined {
    return this.games.get(gameId);
  }

  removeGame(gameId: string): void {
    this.games.delete(gameId);
  }
}

export const db = new Database();