
import { Vehicle } from './types';

/**
 * Converte strings de capacidade (ex: "12 m³", "1.500 kg") em números.
 */
export function parseCapacity(val: string): number {
  if (!val) return 0;
  const numericStr = val.replace(/[^\d.,]/g, '').replace(',', '.');
  return parseFloat(numericStr) || 0;
}

interface CubageItem {
  length: number;
  width: number;
  height: number;
  quantity: number;
}

/**
 * Resultado do cálculo de ocupação da carroceria (modo "não empilhar").
 * Simula a colocação dos itens lado a lado no piso da carroceria.
 */
export interface FloorOccupancyResult {
  /** Comprimento total de carroceria ocupado em metros */
  totalLengthUsed: number;
  /** Detalhamento das fileiras */
  rows: { widthUsed: number; lengthUsed: number; items: string[] }[];
  /** Se excede a maior carroceria disponível */
  exceedsLargest: boolean;
  /** Dados da maior carroceria para referência */
  largestVehicle?: { name: string; comprimento: number; largura: number };
}

/**
 * Calcula a ocupação do piso da carroceria quando os itens NÃO podem ser empilhados.
 * 
 * Algoritmo "First Fit Decreasing Row Packing":
 * 1. Expande cada item pela sua quantidade (cada unidade é uma peça separada)
 * 2. Para cada peça, pega as 2 maiores dimensões como "pegada" (largura x comprimento no piso)
 * 3. Ordena as peças pela maior dimensão (comprimento) decrescente
 * 4. Empacota as peças em "fileiras" — cada fileira tem largura máxima = largura da carroceria
 * 5. O comprimento da fileira = maior comprimento das peças nela
 * 6. Total de comprimento ocupado = soma dos comprimentos das fileiras
 * 
 * @param items - Lista de itens de cubagem
 * @param truckWidth - Largura da carroceria em metros (2.40 para fracionado)
 * @param vehicles - Lista de veículos (para verificar o maior disponível)
 */
export function calculateFloorOccupancy(
  items: CubageItem[],
  truckWidth: number,
  vehicles: Vehicle[]
): FloorOccupancyResult {
  // Expandir itens pela quantidade — cada unidade é uma peça individual
  const pieces: { w: number; l: number; label: string }[] = [];
  for (const item of items) {
    // Os 2 maiores lados formam a "pegada" no piso (o menor lado = altura, ignorada)
    const sides = [item.length, item.width, item.height].sort((a, b) => b - a);
    const pieceLength = sides[0]; // Maior lado → comprimento no piso
    const pieceWidth = sides[1];  // Segundo maior → largura no piso
    const label = `${pieceWidth.toFixed(2)}m x ${pieceLength.toFixed(2)}m`;

    for (let i = 0; i < item.quantity; i++) {
      pieces.push({ w: pieceWidth, l: pieceLength, label });
    }
  }

  // Ordenar peças pelo comprimento decrescente (First Fit Decreasing)
  pieces.sort((a, b) => b.l - a.l);

  // Empacotamento em fileiras
  const rows: { widthUsed: number; lengthUsed: number; items: string[] }[] = [];

  for (const piece of pieces) {
    // Tentar encaixar a peça em cada orientação (normal e girada)
    let placed = false;

    for (const row of rows) {
      // Tentar na orientação normal
      if (row.widthUsed + piece.w <= truckWidth + 0.001) {
        row.widthUsed += piece.w;
        row.lengthUsed = Math.max(row.lengthUsed, piece.l);
        row.items.push(piece.label);
        placed = true;
        break;
      }
      // Tentar girada (trocar largura e comprimento)
      if (row.widthUsed + piece.l <= truckWidth + 0.001) {
        row.widthUsed += piece.l;
        row.lengthUsed = Math.max(row.lengthUsed, piece.w);
        row.items.push(piece.label);
        placed = true;
        break;
      }
    }

    if (!placed) {
      // Criar nova fileira
      // Decidir melhor orientação: preferir a que deixa a largura menor
      if (piece.w <= truckWidth + 0.001) {
        rows.push({ widthUsed: piece.w, lengthUsed: piece.l, items: [piece.label] });
      } else if (piece.l <= truckWidth + 0.001) {
        rows.push({ widthUsed: piece.l, lengthUsed: piece.w, items: [piece.label] });
      } else {
        // Peça individual não cabe na largura da carroceria em nenhuma orientação
        rows.push({ widthUsed: piece.w, lengthUsed: piece.l, items: [piece.label] });
      }
    }
  }

  const totalLengthUsed = rows.reduce((acc, row) => acc + row.lengthUsed, 0);

  // Encontrar o maior veículo cadastrado
  let largestVehicle: { name: string; comprimento: number; largura: number } | undefined;
  let maxComp = 0;
  for (const v of vehicles) {
    if (v.disabled) continue;
    const comp = v.comprimento || 0;
    if (comp > maxComp) {
      maxComp = comp;
      largestVehicle = { name: v.displayName, comprimento: comp, largura: v.largura || 0 };
    }
  }

  const exceedsLargest = maxComp > 0 && totalLengthUsed > maxComp;

  return { totalLengthUsed, rows, exceedsLargest, largestVehicle };
}


/**
 * Encontra o veículo mais adequado para uma carga usando um sistema de scoring
 * multi-critério que considera: Peso, Cubagem, Comprimento e Largura.
 * 
 * @param stackItems - Se false, usa o cálculo de ocupação do piso (sem empilhar)
 */
export function findBestFitVehicle(
  weight: number,
  cubage: number,
  vehicles: Vehicle[],
  cubageItems?: CubageItem[],
  stackItems: boolean = true
): Vehicle | null {
  // Calcular dimensão máxima entre todos os itens (maior peça individual)
  let maxItemLength = 0;
  let maxItemWidth = 0;
  let requiredFloorLength = 0;

  if (cubageItems && cubageItems.length > 0) {
    for (const item of cubageItems) {
      // Considerar as 3 dimensões da peça (pode ser girada/tombada)
      // Os 2 maiores lados formam a "pegada" que precisa caber na carroceria
      const sides = [item.length, item.width, item.height].sort((a, b) => b - a);
      const itemLongestSide = sides[0];   // Maior dimensão → comprimento da carroceria
      const itemSecondSide = sides[1];    // Segunda maior → largura da carroceria
      maxItemLength = Math.max(maxItemLength, itemLongestSide);
      maxItemWidth = Math.max(maxItemWidth, itemSecondSide);
    }

    // Se não empilhar, calcular a ocupação real do piso para cada veículo
    if (!stackItems) {
      // Para o filtro inicial, precisamos saber o comprimento mínimo necessário
      // Vamos calcular com a maior largura de veículo disponível como referência
      const activeVehicles = vehicles.filter(v => !v.disabled && (v.comprimento || 0) > 0 && (v.largura || 0) > 0);
      if (activeVehicles.length > 0) {
        // Calcular para cada veículo individualmente no filtro abaixo
        requiredFloorLength = -1; // flag: calcular por veículo
      }
    }
  }

  // Filtra apenas veículos compatíveis (capacidade >= carga) e não desativados
  const compatibleVehicles = vehicles.filter(v => {
    if (v.disabled) return false;

    const vWeight = parseCapacity(v.peso || '');
    const vCubage = parseCapacity(v.cubagem || '');

    // Validação eliminatória: peso
    if (vWeight < weight) return false;
    
    // Cubagem: se empilhando, validar normalmente. Se não empilhando, cubagem é menos relevante
    if (stackItems && vCubage < cubage) return false;

    // Validação eliminatória: dimensões físicas
    if (maxItemLength > 0 && maxItemWidth > 0) {
      const vLength = v.comprimento || 0;
      const vWidth = v.largura || 0;

      if (vLength > 0 && vWidth > 0) {
        if (!stackItems && cubageItems && cubageItems.length > 0) {
          // Modo "não empilhar": calcular se TODOS os itens cabem no piso deste veículo
          const occupancy = calculateFloorOccupancy(cubageItems, vWidth, vehicles);
          if (occupancy.totalLengthUsed > vLength) return false;
        } else {
          // Modo empilhar: apenas a maior peça precisa caber
          const fitsNormal = maxItemLength <= vLength && maxItemWidth <= vWidth;
          const fitsRotated = maxItemWidth <= vLength && maxItemLength <= vWidth;
          if (!fitsNormal && !fitsRotated) return false;
        }
      }
    }

    return true;
  });

  if (compatibleVehicles.length === 0) return null;

  // Calcular o score de proximidade para cada veículo
  const WEIGHT_IMPORTANCE = 0.35;
  const CUBAGE_IMPORTANCE = stackItems ? 0.35 : 0.15; // Cubagem menos importante sem empilhar
  const LENGTH_IMPORTANCE = stackItems ? 0.15 : 0.35; // Comprimento mais importante sem empilhar
  const WIDTH_IMPORTANCE = 0.15;

  const scored = compatibleVehicles.map(v => {
    const vWeight = parseCapacity(v.peso || '');
    const vCubage = parseCapacity(v.cubagem || '');
    const vLength = v.comprimento || 0;
    const vWidth = v.largura || 0;

    const weightRatio = vWeight > 0 ? weight / vWeight : 0;
    const cubageRatio = vCubage > 0 ? cubage / vCubage : 0;

    let lengthRatio = 0;
    let widthRatio = 0;

    if (!stackItems && cubageItems && cubageItems.length > 0 && vWidth > 0 && vLength > 0) {
      // Modo não empilhar: usar o comprimento real de ocupação
      const occupancy = calculateFloorOccupancy(cubageItems, vWidth, vehicles);
      lengthRatio = occupancy.totalLengthUsed / vLength;
    } else {
      if (vLength > 0 && maxItemLength > 0) {
        lengthRatio = maxItemLength / vLength;
      }
    }
    if (vWidth > 0 && maxItemWidth > 0) {
      widthRatio = maxItemWidth / vWidth;
    }

    const hasDimensions = vLength > 0 && vWidth > 0 && maxItemLength > 0;

    let score: number;
    if (hasDimensions) {
      score = (weightRatio * WEIGHT_IMPORTANCE) +
              (cubageRatio * CUBAGE_IMPORTANCE) +
              (lengthRatio * LENGTH_IMPORTANCE) +
              (widthRatio * WIDTH_IMPORTANCE);
    } else {
      score = (weightRatio * 0.5) + (cubageRatio * 0.5);
    }

    return { vehicle: v, score };
  });

  // Ordena por score decrescente (maior utilização = melhor encaixe)
  scored.sort((a, b) => b.score - a.score);

  return scored[0].vehicle;
}
