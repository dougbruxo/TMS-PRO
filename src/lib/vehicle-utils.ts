
import { Vehicle } from './types';

/**
 * Converte strings de capacidade (ex: "12 m³", "1.500 kg") em números.
 */
export function parseCapacity(val: string): number {
  if (!val) return 0;
  const numericStr = val.replace(/[^\d.,]/g, '').replace(',', '.');
  return parseFloat(numericStr) || 0;
}

/**
 * Encontra o veículo mais adequado para uma carga baseada em peso e cubagem.
 * Dimensões (comprimento/largura) podem ser validadas adicionalmente se fornecidas.
 */
export function findBestFitVehicle(
  weight: number,
  cubage: number,
  vehicles: Vehicle[],
  itemDimensions?: { length: number; width: number }[]
): Vehicle | null {
  // Filtra apenas veículos compatíveis (capacidade >= carga) e não desativados
  const compatibleVehicles = vehicles.filter(v => {
    const vWeight = parseCapacity(v.peso || '');
    const vCubage = parseCapacity(v.cubagem || '');

    // Validação básica de peso e cubagem
    const fitsBasic = vWeight >= weight && vCubage >= cubage && !v.disabled;
    if (!fitsBasic) return false;

    // Validação de dimensões físicas (opcional, se o item for maior que a carroceria)
    if (itemDimensions && itemDimensions.length > 0) {
      const vLength = v.comprimento || 0;
      const vWidth = v.largura || 0;

      // Se o veículo tem dimensões cadastradas, nenhum item pode ser maior que ele
      if (vLength > 0 || vWidth > 0) {
        const hasOversizedItem = itemDimensions.some(item => {
          // O item pode ser girado, então checamos as duas orientações
          const fitsNormal = item.length <= vLength && item.width <= vWidth;
          const fitsRotated = item.width <= vLength && item.length <= vWidth;
          return !fitsNormal && !fitsRotated;
        });
        if (hasOversizedItem) return false;
      }
    }

    return true;
  });

  if (compatibleVehicles.length === 0) return null;

  // Ordena por "proximidade" para escolher o menor veículo possível que atenda
  return compatibleVehicles.sort((a, b) => {
    const aWeight = parseCapacity(a.peso || '');
    const bWeight = parseCapacity(b.peso || '');
    const aCubage = parseCapacity(a.cubagem || '');
    const bCubage = parseCapacity(b.cubagem || '');

    // Prioridade 1: Menor peso excedente
    if (aWeight !== bWeight) return aWeight - bWeight;
    // Prioridade 2: Menor cubagem excedente
    return aCubage - bCubage;
  })[0];
}
