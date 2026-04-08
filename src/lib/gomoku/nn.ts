/**
 * 五目並べ Policy Network の推論エンジン。
 * PyTorchで学習した重みをJSONから読み込み、純粋なTypeScriptで推論する。
 */

import { BOARD_SIZE } from './types';
import type { Board, Color, Position } from './types';
import { getForbiddenMoves } from './logic';
import type { GameState } from './types';

// --- 型定義 ---

interface ConvLayer {
  weight: number[][][][]; // [outCh][inCh][kH][kW]
  bias: number[];
}

export interface NNWeights {
  conv1: ConvLayer;
  conv2: ConvLayer;
  conv3: ConvLayer;
  conv4: ConvLayer;
  conv_out: ConvLayer;
}

// --- 行列演算 ---

function conv2d(
  input: number[][][], // [channels][height][width]
  weight: number[][][][], // [outCh][inCh][kH][kW]
  bias: number[],
  padding: number,
): number[][][] {
  const inCh = input.length;
  const h = input[0].length;
  const w = input[0][0].length;
  const outCh = weight.length;
  const kH = weight[0][0].length;
  const kW = weight[0][0][0].length;
  const outH = h + 2 * padding - kH + 1;
  const outW = w + 2 * padding - kW + 1;

  const output: number[][][] = [];
  for (let oc = 0; oc < outCh; oc++) {
    const plane: number[][] = [];
    for (let oh = 0; oh < outH; oh++) {
      const row: number[] = [];
      for (let ow = 0; ow < outW; ow++) {
        let sum = bias[oc];
        for (let ic = 0; ic < inCh; ic++) {
          for (let kh = 0; kh < kH; kh++) {
            for (let kw = 0; kw < kW; kw++) {
              const ih = oh + kh - padding;
              const iw = ow + kw - padding;
              if (ih >= 0 && ih < h && iw >= 0 && iw < w) {
                sum += input[ic][ih][iw] * weight[oc][ic][kh][kw];
              }
            }
          }
        }
        row.push(sum);
      }
      plane.push(row);
    }
    output.push(plane);
  }
  return output;
}

function relu(input: number[][][]): number[][][] {
  return input.map((ch) => ch.map((row) => row.map((v) => Math.max(0, v))));
}

// --- 推論 ---

function boardToInput(board: Board, currentColor: Color): number[][][] {
  const myStones: number[][] = [];
  const oppStones: number[][] = [];
  const turnPlane: number[][] = [];
  const turnVal = currentColor === 'black' ? 1.0 : 0.0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    const myRow: number[] = [];
    const oppRow: number[] = [];
    const turnRow: number[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r][c];
      myRow.push(cell === currentColor ? 1.0 : 0.0);
      oppRow.push(cell !== null && cell !== currentColor ? 1.0 : 0.0);
      turnRow.push(turnVal);
    }
    myStones.push(myRow);
    oppStones.push(oppRow);
    turnPlane.push(turnRow);
  }

  return [myStones, oppStones, turnPlane];
}

export function nnInfer(weights: NNWeights, board: Board, currentColor: Color): number[] {
  const input = boardToInput(board, currentColor);

  let x = relu(conv2d(input, weights.conv1.weight, weights.conv1.bias, 1));
  x = relu(conv2d(x, weights.conv2.weight, weights.conv2.bias, 1));
  x = relu(conv2d(x, weights.conv3.weight, weights.conv3.bias, 1));
  x = relu(conv2d(x, weights.conv4.weight, weights.conv4.bias, 1));
  x = conv2d(x, weights.conv_out.weight, weights.conv_out.bias, 0);

  // x は [1][15][15] → フラット化して225の logits
  const logits: number[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      logits.push(x[0][r][c]);
    }
  }
  return logits;
}

export function chooseNNMove(weights: NNWeights, game: GameState): Position | null {
  const logits = nnInfer(weights, game.board, game.currentColor);

  // 禁じ手と既に石があるマスをマスク
  const forbidden = new Set(getForbiddenMoves(game).map(([r, c]) => r * BOARD_SIZE + c));

  let bestScore = -Infinity;
  let bestMove: Position | null = null;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const idx = r * BOARD_SIZE + c;
      if (game.board[r][c] !== null) continue;
      if (forbidden.has(idx)) continue;
      if (logits[idx] > bestScore) {
        bestScore = logits[idx];
        bestMove = [r, c];
      }
    }
  }

  return bestMove;
}

export function parseNNWeights(json: Record<string, number[] | number[][][][]>): NNWeights {
  return {
    conv1: {
      weight: json['conv1.weight'] as number[][][][],
      bias: json['conv1.bias'] as number[],
    },
    conv2: {
      weight: json['conv2.weight'] as number[][][][],
      bias: json['conv2.bias'] as number[],
    },
    conv3: {
      weight: json['conv3.weight'] as number[][][][],
      bias: json['conv3.bias'] as number[],
    },
    conv4: {
      weight: json['conv4.weight'] as number[][][][],
      bias: json['conv4.bias'] as number[],
    },
    conv_out: {
      weight: json['conv_out.weight'] as number[][][][],
      bias: json['conv_out.bias'] as number[],
    },
  };
}
