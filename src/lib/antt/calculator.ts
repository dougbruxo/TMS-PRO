import { connectToDatabase } from '@/lib/database';
import { AnttCoefficient, Vehicle } from '@/lib/types';
import { parseCapacity, findBestFitVehicle } from '../vehicle-utils';

export { parseCapacity, findBestFitVehicle };

export async function calculateMinimumFreight(distanceKm: number, vehicle: Vehicle, cargoType: string = 'Geral') {
  if (!vehicle.axles || vehicle.axles < 2) return null;

  try {
    const { db } = await connectToDatabase();
    
    // Busca o coeficiente exato para o número de eixos e tipo de carga
    const coefficient = await db.collection('antt_coefficients').findOne({
      axles: vehicle.axles,
      cargoType: { $regex: new RegExp(cargoType, 'i') }
    }) as AnttCoefficient | null;

    if (!coefficient) {
      console.warn(`Coeficiente ANTT não encontrado para ${vehicle.axles} eixos e carga ${cargoType}`);
      return null;
    }

    // Fórmula ANTT: (Distância * CCD) + CC
    const minFreight = (distanceKm * coefficient.ccd) + coefficient.cc;

    return {
      total: minFreight,
      ccd: coefficient.ccd,
      cc: coefficient.cc,
      axles: vehicle.axles,
      cargoType: coefficient.cargoType
    };
  } catch (error) {
    console.error('Erro ao calcular frete mínimo ANTT:', error);
    return null;
  }
}

export function validateFreightAgainstPiso(currentValue: number, minFreight: number) {
  return {
    isCompliant: currentValue >= minFreight,
    difference: currentValue - minFreight,
    percentage: (currentValue / minFreight) * 100
  };
}
