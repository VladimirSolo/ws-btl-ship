import WebSocket from 'ws';
import { db } from '../database';
import {
  Message,
  RegRequest,
  RegResponse,
  AddUserToRoomRequest,
  CreateGameResponse,
  AddShipsRequest,
  StartGameResponse,
  AttackRequest,
  AttackResponse,
  RandomAttackRequest,
  TurnResponse,
  FinishResponse,
  RoomUpdate,
  Winner,
} from '../types';
import { GameEngine } from '../game-engine';

export class MessageHandler {
  private wsConnections: Map<string, WebSocket> = new Map();

  registerConnection(playerIndex: string, ws: WebSocket): void {
    this.wsConnections.set(playerIndex, ws);
    const player = db.getPlayer(playerIndex);
    if (player) {
      player.ws = ws;
    }
  }

  removeConnection(playerIndex: string): void {
    this.wsConnections.delete(playerIndex);
  }

  sendMessage(ws: WebSocket, type: string, data: any): void {
    const message: Message = { type, data: JSON.stringify(data), id: 0 };
    ws.send(JSON.stringify(message));
  }

  broadcastToAll(type: string, data: any): void {
    this.wsConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, type, data);
      }
    });
  }

  broadcastToRoom(roomId: string, type: string, data: any): void {
    const room = db.getRoom(roomId);
    if (!room) return;

    room.players.forEach(playerIndex => {
      const ws = this.wsConnections.get(playerIndex);
      if (ws && ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, type, data);
      }
    });
  }

  broadcastToGame(gameId: string, type: string, data: any): void {
    const game = db.getGame(gameId);
    if (!game) return;

    game.players.forEach(gamePlayer => {
      const ws = this.wsConnections.get(gamePlayer.playerIndex);
      if (ws && ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, type, data);
      }
    });
  }

  handleMessage(ws: WebSocket, message: string): void {
    try {
      const msg: Message = JSON.parse(message);
      console.log(`Received command: ${msg.type}`, msg.data);

      let data;
      if (typeof msg.data === 'string') {
        data = msg.data.trim() === '' ? '' : JSON.parse(msg.data);
      } else {
        data = msg.data;
      }

      switch (msg.type) {
        case 'reg':
          this.handleRegistration(ws, data as RegRequest);
          break;
        case 'create_room':
          this.handleCreateRoom(ws);
          break;
        case 'add_user_to_room':
          this.handleAddUserToRoom(ws, data as AddUserToRoomRequest);
          break;
        case 'add_ships':
          this.handleAddShips(ws, data as AddShipsRequest);
          break;
        case 'attack':
          this.handleAttack(ws, data as AttackRequest);
          break;
        case 'randomAttack':
          this.handleRandomAttack(ws, data as RandomAttackRequest);
          break;
        default:
          console.log(`Unknown command type: ${msg.type}`);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  private handleRegistration(ws: WebSocket, data: RegRequest): void {
    try {
      const { player, isNew } = db.registerPlayer(data.name, data.password);

      const response: RegResponse = {
        name: player.name,
        index: player.index,
        error: false,
        errorText: '',
      };

      this.registerConnection(player.index, ws);
      this.sendMessage(ws, 'reg', response);
      console.log(`Result: Player ${player.name} ${isNew ? 'registered' : 'logged in'} with index ${player.index}`);

      this.sendUpdateRoom();
      this.sendUpdateWinners();
    } catch (error: any) {
      const response: RegResponse = {
        name: data.name,
        index: '',
        error: true,
        errorText: error.message || 'Registration failed',
      };
      this.sendMessage(ws, 'reg', response);
      console.log(`Result: Registration failed - ${response.errorText}`);
    }
  }

  private handleCreateRoom(ws: WebSocket): void {
    const playerIndex = this.getPlayerIndexByWs(ws);
    if (!playerIndex) {
      console.log('Result: Create room failed - player not found');
      return;
    }

    const room = db.createRoom(playerIndex);
    console.log(`Result: Room ${room.roomId} created by player ${playerIndex}`);
    this.sendUpdateRoom();
  }

  private handleAddUserToRoom(ws: WebSocket, data: AddUserToRoomRequest): void {
    const playerIndex = this.getPlayerIndexByWs(ws);
    if (!playerIndex) {
      console.log('Result: Add user to room failed - player not found');
      return;
    }

    const room = db.addPlayerToRoom(data.indexRoom, playerIndex);
    if (!room) {
      console.log(`Result: Failed to add player to room ${data.indexRoom}`);
      return;
    }

    console.log(`Result: Player ${playerIndex} added to room ${room.roomId}`);
    this.sendUpdateRoom();

    const game = db.createGame(room.roomId);
    console.log(`Result: Game ${game.idGame} created for room ${room.roomId}`);

    game.players.forEach(gamePlayer => {
      const playerWs = this.wsConnections.get(gamePlayer.playerIndex);
      if (playerWs && playerWs.readyState === WebSocket.OPEN) {
        const createGameData: CreateGameResponse = {
          idGame: game.idGame,
          idPlayer: gamePlayer.idPlayer,
        };
        this.sendMessage(playerWs, 'create_game', createGameData);
      }
    });
  }

  private handleAddShips(ws: WebSocket, data: AddShipsRequest): void {
    const game = db.getGame(data.gameId);
    if (!game) {
      console.log(`Result: Add ships failed - game ${data.gameId} not found`);
      return;
    }

    const gamePlayer = game.players.get(data.indexPlayer);
    if (!gamePlayer) {
      console.log(`Result: Add ships failed - player ${data.indexPlayer} not found in game`);
      return;
    }

    GameEngine.addShipsToPlayer(gamePlayer, data.ships);
    console.log(`Result: Ships added for player ${data.indexPlayer} in game ${data.gameId}`);

    const allPlayersReady = Array.from(game.players.values()).every(p => p.ships.length > 0);

    if (allPlayersReady && !game.started) {
      game.started = true;

      const playerIds = Array.from(game.players.keys());
      game.currentTurn = playerIds[Math.floor(Math.random() * playerIds.length)];

      console.log(`Result: Game ${game.idGame} started, first turn: ${game.currentTurn}`);

      game.players.forEach(gp => {
        const playerWs = this.wsConnections.get(gp.playerIndex);
        if (playerWs && playerWs.readyState === WebSocket.OPEN) {
          const startGameData: StartGameResponse = {
            ships: gp.ships.map(({ hits, ...ship }) => ship),
            currentPlayerIndex: gp.idPlayer,
          };
          this.sendMessage(playerWs, 'start_game', startGameData);
        }
      });

      const turnData: TurnResponse = {
        currentPlayer: game.currentTurn,
      };
      this.broadcastToGame(game.idGame, 'turn', turnData);
    }
  }

  private handleAttack(ws: WebSocket, data: AttackRequest): void {
    const game = db.getGame(data.gameId);
    if (!game || !game.started) {
      console.log(`Result: Attack failed - game not found or not started`);
      return;
    }

    if (game.currentTurn !== data.indexPlayer) {
      console.log(`Result: Attack failed - not player's turn`);
      return;
    }

    const result = GameEngine.attack(game, data.indexPlayer, data.x, data.y);
    console.log(`Result: Attack at (${data.x}, ${data.y}) - ${result.status}`);

    const attackResponse: AttackResponse = {
      position: { x: data.x, y: data.y },
      currentPlayer: data.indexPlayer,
      status: result.status,
    };
    this.broadcastToGame(game.idGame, 'attack', attackResponse);

    if (result.status === 'killed' && result.missPositions) {
      for (const pos of result.missPositions) {
        const missResponse: AttackResponse = {
          position: pos,
          currentPlayer: data.indexPlayer,
          status: 'miss',
        };
        this.broadcastToGame(game.idGame, 'attack', missResponse);
      }
    }

    const opponentId = GameEngine.getOpponentIdPlayer(game, data.indexPlayer);
    if (opponentId && GameEngine.isGameFinished(game, opponentId)) {
      game.finished = true;
      console.log(`Result: Game ${game.idGame} finished, winner: ${data.indexPlayer}`);

      const finishData: FinishResponse = {
        winPlayer: data.indexPlayer,
      };
      this.broadcastToGame(game.idGame, 'finish', finishData);

      const winner = game.players.get(data.indexPlayer);
      if (winner) {
        db.incrementWins(winner.playerIndex);
        this.sendUpdateWinners();
      }

      const room = db.getRoom(game.roomId);
      if (room) {
        db.removeRoom(room.roomId);
      }
      db.removeGame(game.idGame);
      return;
    }

    if (result.status === 'miss' || result.status === 'killed') {
      game.currentTurn = opponentId || game.currentTurn;
    }

    const turnData: TurnResponse = {
      currentPlayer: game.currentTurn,
    };
    this.broadcastToGame(game.idGame, 'turn', turnData);
  }

  private handleRandomAttack(ws: WebSocket, data: RandomAttackRequest): void {
    const game = db.getGame(data.gameId);
    if (!game || !game.started) {
      console.log(`Result: Random attack failed - game not found or not started`);
      return;
    }

    if (game.currentTurn !== data.indexPlayer) {
      console.log(`Result: Random attack failed - not player's turn`);
      return;
    }

    const result = GameEngine.randomAttack(game, data.indexPlayer);
    console.log(`Result: Random attack at (${result.position.x}, ${result.position.y}) - ${result.status}`);

    const attackResponse: AttackResponse = {
      position: result.position,
      currentPlayer: data.indexPlayer,
      status: result.status,
    };
    this.broadcastToGame(game.idGame, 'attack', attackResponse);

    if (result.status === 'killed' && result.missPositions) {
      for (const pos of result.missPositions) {
        const missResponse: AttackResponse = {
          position: pos,
          currentPlayer: data.indexPlayer,
          status: 'miss',
        };
        this.broadcastToGame(game.idGame, 'attack', missResponse);
      }
    }

    const opponentId = GameEngine.getOpponentIdPlayer(game, data.indexPlayer);
    if (opponentId && GameEngine.isGameFinished(game, opponentId)) {
      game.finished = true;
      console.log(`Result: Game ${game.idGame} finished, winner: ${data.indexPlayer}`);

      const finishData: FinishResponse = {
        winPlayer: data.indexPlayer,
      };
      this.broadcastToGame(game.idGame, 'finish', finishData);

      const winner = game.players.get(data.indexPlayer);
      if (winner) {
        db.incrementWins(winner.playerIndex);
        this.sendUpdateWinners();
      }

      const room = db.getRoom(game.roomId);
      if (room) {
        db.removeRoom(room.roomId);
      }
      db.removeGame(game.idGame);
      return;
    }

    if (result.status === 'miss' || result.status === 'killed') {
      game.currentTurn = opponentId || game.currentTurn;
    }

    const turnData: TurnResponse = {
      currentPlayer: game.currentTurn,
    };
    this.broadcastToGame(game.idGame, 'turn', turnData);
  }

  private sendUpdateRoom(): void {
    const availableRooms = db.getAvailableRooms();
    const roomUpdates: RoomUpdate[] = availableRooms.map(room => ({
      roomId: room.roomId,
      roomUsers: room.players.map(playerIndex => {
        const player = db.getPlayer(playerIndex);
        return {
          name: player?.name || '',
          index: playerIndex,
        };
      }),
    }));

    this.broadcastToAll('update_room', roomUpdates);
    console.log(`Result: Room update sent - ${availableRooms.length} available rooms`);
  }

  private sendUpdateWinners(): void {
    const players = db.getAllPlayers();
    const winners: Winner[] = players
      .map(p => ({
        name: p.name,
        wins: p.wins,
      }))
      .sort((a, b) => b.wins - a.wins);

    this.broadcastToAll('update_winners', winners);
    console.log(`Result: Winners update sent`);
  }

  private getPlayerIndexByWs(ws: WebSocket): string | undefined {
    for (const [playerIndex, playerWs] of this.wsConnections.entries()) {
      if (playerWs === ws) {
        return playerIndex;
      }
    }
    return undefined;
  }
}