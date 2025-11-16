import { Ship, ShipState, Position, GamePlayer, Game } from '../types';

export class GameEngine {
  static addShipsToPlayer(gamePlayer: GamePlayer, ships: Ship[]): void {
    gamePlayer.ships = ships.map(ship => ({
      ...ship,
      hits: new Set<string>(),
    }));
  }

  static attack(game: Game, attackerIdPlayer: string, x: number, y: number): {
    status: 'miss' | 'shot' | 'killed';
    missPositions?: Position[];
  } {
    const defenderIdPlayer = Array.from(game.players.keys()).find(id => id !== attackerIdPlayer);
    if (!defenderIdPlayer) {
      throw new Error('Opponent not found');
    }

    const defender = game.players.get(defenderIdPlayer);
    if (!defender) {
      throw new Error('Defender not found');
    }

    const posKey = `${x},${y}`;

    if (defender.board.has(posKey)) {
      return { status: 'miss' };
    }

    for (const ship of defender.ships) {
      if (this.isHit(ship, x, y)) {
        ship.hits.add(posKey);
        defender.board.set(posKey, 'hit');

        if (this.isShipKilled(ship)) {
          const missPositions = this.getCellsAroundShip(ship);
          for (const pos of missPositions) {
            const key = `${pos.x},${pos.y}`;
            if (!defender.board.has(key)) {
              defender.board.set(key, 'miss');
            }
          }
          return { status: 'killed', missPositions };
        }

        return { status: 'shot' };
      }
    }

    defender.board.set(posKey, 'miss');
    return { status: 'miss' };
  }

  static randomAttack(game: Game, attackerIdPlayer: string): {
    position: Position;
    status: 'miss' | 'shot' | 'killed';
    missPositions?: Position[];
  } {
    const defenderIdPlayer = Array.from(game.players.keys()).find(id => id !== attackerIdPlayer);
    if (!defenderIdPlayer) {
      throw new Error('Opponent not found');
    }

    const defender = game.players.get(defenderIdPlayer);
    if (!defender) {
      throw new Error('Defender not found');
    }

    let x: number, y: number
    let attempts = 0;
    do {
      x = Math.floor(Math.random() * 10);
      y = Math.floor(Math.random() * 10);
      attempts++;
      if (attempts > 200) {
        throw new Error('Cannot find valid position for random attack');
      }
    } while (defender.board.has(`${x},${y}`));

    const result = this.attack(game, attackerIdPlayer, x, y);
    return { position: { x, y }, ...result };
  }

  static isGameFinished(game: Game, defenderIdPlayer: string): boolean {
    const defender = game.players.get(defenderIdPlayer);
    if (!defender) return false;

    return defender.ships.every(ship => this.isShipKilled(ship));
  }

  static getOpponentIdPlayer(game: Game, currentIdPlayer: string): string | undefined {
    return Array.from(game.players.keys()).find(id => id !== currentIdPlayer);
  }

  private static isHit(ship: ShipState, x: number, y: number): boolean {
    const { position, direction, length } = ship;

    if (direction) {
      return y === position.y && x >= position.x && x < position.x + length;
    } else {
      return x === position.x && y >= position.y && y < position.y + length;
    }
  }

  private static isShipKilled(ship: ShipState): boolean {
    return ship.hits.size === ship.length;
  }

  private static getCellsAroundShip(ship: ShipState): Position[] {
    const positions: Position[] = [];
    const { position, direction, length } = ship;

    const minX = position.x - 1;
    const maxX = direction ? position.x + length : position.x + 1;
    const minY = position.y - 1;
    const maxY = direction ? position.y + 1 : position.y + length;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (x >= 0 && x < 10 && y >= 0 && y < 10) {
          const isShipCell = this.isHit(ship, x, y);
          if (!isShipCell) {
            positions.push({ x, y });
          }
        }
      }
    }

    return positions;
  }
}