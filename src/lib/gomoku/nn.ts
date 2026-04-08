/**
 * 五目並べ Policy Network の推論エンジン（ResNet + BatchNorm対応）。
 * PyTorchで学習した重みをJSONから読み込み、純粋なTypeScriptで推論する。
 */

import { BOARD_SIZE } from './types';
import type { Board, Color, Position, GameState } from './types';
import { getForbiddenMoves } from './logic';

// --- 型定義 ---

interface ConvLayer {
  weight: number[][][][];
  bias: number[];
}

interface BNLayer {
  weight: number[]; // gamma
  bias: number[]; // beta
  running_mean: number[];
  running_var: number[];
}

interface ResBlockWeights {
  conv1: ConvLayer;
  bn1: BNLayer;
  conv2: ConvLayer;
  bn2: BNLayer;
}

export interface NNWeights {
  input_conv: ConvLayer;
  input_bn: BNLayer;
  blocks: ResBlockWeights[];
  output_conv: ConvLayer;
}

// --- 行列演算 ---

function conv2d(
  input: Float32Array[],
  inH: number,
  inW: number,
  weight: number[][][][],
  bias: number[],
  padding: number,
): Float32Array[] {
  const inCh = input.length;
  const outCh = weight.length;
  const kH = weight[0][0].length;
  const kW = weight[0][0][0].length;
  const outH = inH + 2 * padding - kH + 1;
  const outW = inW + 2 * padding - kW + 1;

  const output: Float32Array[] = [];
  for (let oc = 0; oc < outCh; oc++) {
    const plane = new Float32Array(outH * outW);
    for (let oh = 0; oh < outH; oh++) {
      for (let ow = 0; ow < outW; ow++) {
        let sum = bias[oc];
        for (let ic = 0; ic < inCh; ic++) {
          const w = weight[oc][ic];
          for (let kh = 0; kh < kH; kh++) {
            const ih = oh + kh - padding;
            if (ih < 0 || ih >= inH) continue;
            const inputRow = ih * inW;
            const wRow = w[kh];
            for (let kw = 0; kw < kW; kw++) {
              const iw = ow + kw - padding;
              if (iw >= 0 && iw < inW) {
                sum += input[ic][inputRow + iw] * wRow[kw];
              }
            }
          }
        }
        plane[oh * outW + ow] = sum;
      }
    }
    output.push(plane);
  }
  return output;
}

function batchNorm(input: Float32Array[], bn: BNLayer, size: number): Float32Array[] {
  const eps = 1e-5;
  const output: Float32Array[] = [];
  for (let c = 0; c < input.length; c++) {
    const plane = new Float32Array(size);
    const gamma = bn.weight[c];
    const beta = bn.bias[c];
    const mean = bn.running_mean[c];
    const invStd = 1.0 / Math.sqrt(bn.running_var[c] + eps);
    const scale = gamma * invStd;
    const shift = beta - mean * scale;
    for (let i = 0; i < size; i++) {
      plane[i] = input[c][i] * scale + shift;
    }
    output.push(plane);
  }
  return output;
}

function relu(input: Float32Array[], size: number): Float32Array[] {
  const output: Float32Array[] = [];
  for (let c = 0; c < input.length; c++) {
    const plane = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      plane[i] = Math.max(0, input[c][i]);
    }
    output.push(plane);
  }
  return output;
}

function add(a: Float32Array[], b: Float32Array[], size: number): Float32Array[] {
  const output: Float32Array[] = [];
  for (let c = 0; c < a.length; c++) {
    const plane = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      plane[i] = a[c][i] + b[c][i];
    }
    output.push(plane);
  }
  return output;
}

// --- 推論 ---

function boardToInput(board: Board, currentColor: Color): Float32Array[] {
  const size = BOARD_SIZE * BOARD_SIZE;
  const myStones = new Float32Array(size);
  const oppStones = new Float32Array(size);
  const turnPlane = new Float32Array(size);
  const turnVal = currentColor === 'black' ? 1.0 : 0.0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const idx = r * BOARD_SIZE + c;
      const cell = board[r][c];
      if (cell === currentColor) myStones[idx] = 1.0;
      else if (cell !== null) oppStones[idx] = 1.0;
      turnPlane[idx] = turnVal;
    }
  }

  return [myStones, oppStones, turnPlane];
}

export function nnInfer(weights: NNWeights, board: Board, currentColor: Color): number[] {
  const S = BOARD_SIZE * BOARD_SIZE;
  let x = boardToInput(board, currentColor);

  // Input conv + BN + ReLU
  x = conv2d(x, BOARD_SIZE, BOARD_SIZE, weights.input_conv.weight, weights.input_conv.bias, 1);
  x = batchNorm(x, weights.input_bn, S);
  x = relu(x, S);

  // Residual blocks
  for (const block of weights.blocks) {
    const residual = x;
    x = conv2d(x, BOARD_SIZE, BOARD_SIZE, block.conv1.weight, block.conv1.bias, 1);
    x = batchNorm(x, block.bn1, S);
    x = relu(x, S);
    x = conv2d(x, BOARD_SIZE, BOARD_SIZE, block.conv2.weight, block.conv2.bias, 1);
    x = batchNorm(x, block.bn2, S);
    x = add(x, residual, S);
    x = relu(x, S);
  }

  // Output conv (1x1, no padding)
  x = conv2d(x, BOARD_SIZE, BOARD_SIZE, weights.output_conv.weight, weights.output_conv.bias, 0);

  // Flatten
  const logits: number[] = [];
  for (let i = 0; i < S; i++) {
    logits.push(x[0][i]);
  }
  return logits;
}

export function chooseNNMove(weights: NNWeights, game: GameState): Position | null {
  const logits = nnInfer(weights, game.board, game.currentColor);

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

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseNNWeights(json: any): NNWeights {
  function parseConv(prefix: string): ConvLayer {
    return {
      weight: json[`${prefix}.weight`],
      bias: json[`${prefix}.bias`],
    };
  }
  function parseBN(prefix: string): BNLayer {
    return {
      weight: json[`${prefix}.weight`],
      bias: json[`${prefix}.bias`],
      running_mean: json[`${prefix}.running_mean`],
      running_var: json[`${prefix}.running_var`],
    };
  }

  const blocks: ResBlockWeights[] = [];
  let i = 0;
  while (json[`blocks.${i}.conv1.weight`]) {
    blocks.push({
      conv1: parseConv(`blocks.${i}.conv1`),
      bn1: parseBN(`blocks.${i}.bn1`),
      conv2: parseConv(`blocks.${i}.conv2`),
      bn2: parseBN(`blocks.${i}.bn2`),
    });
    i++;
  }

  return {
    input_conv: parseConv('input_conv'),
    input_bn: parseBN('input_bn'),
    blocks,
    output_conv: parseConv('output_conv'),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
