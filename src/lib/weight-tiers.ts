import type { PricingSettings, WeightTier } from './types';

/**
 * Resolve o fator da faixa de peso com fallback em cascata:
 * rota (UF×UF) → região → global → 1.0
 */
export function getWeightTierFactor(
    pricingSettings: PricingSettings,
    pesoTaxavel: number,
    ufOrigem: string,
    ufDestino: string
): number {
    const mode = pricingSettings.weightTiersMode || 'global';
    let tiers: WeightTier[] = [];

    // 1. Tentar faixas específicas da rota (UF×UF)
    if (mode === 'route') {
        tiers = pricingSettings.routeWeightTiers?.[ufOrigem]?.[ufDestino] || [];
    }

    // 2. Tentar faixas regionais (fallback se rota não tem ou se modo é 'region')
    if (mode === 'region' || (mode === 'route' && tiers.length === 0)) {
        const regionOrigem = getRegionForUf(pricingSettings, ufOrigem);
        const regionDestino = getRegionForUf(pricingSettings, ufDestino);
        if (regionOrigem && regionDestino) {
            const regionTiers = pricingSettings.regionWeightTiers?.[regionOrigem]?.[regionDestino] || [];
            if (regionTiers.length > 0) tiers = regionTiers;
        }
    }

    // 3. Fallback para faixas globais
    if (tiers.length === 0) {
        tiers = pricingSettings.weightTiers || [];
    }

    // 4. Sem faixas configuradas = fator 1.0 (sem alteração)
    if (tiers.length === 0) return 1.0;

    return resolveFactorFromTiers(tiers, pesoTaxavel);
}

/**
 * Dado um array de faixas e um peso, resolve o fator aplicável.
 */
function resolveFactorFromTiers(tiers: WeightTier[], peso: number): number {
    const sorted = [...tiers].sort((a, b) => a.maxWeight - b.maxWeight);
    const matched = sorted.find(t => peso <= t.maxWeight);
    return matched ? matched.factor : sorted[sorted.length - 1].factor;
}

/**
 * Encontra a região de uma UF usando o mapa de regiões do pricingSettings.
 */
function getRegionForUf(pricingSettings: PricingSettings, uf: string): string | null {
    for (const region in pricingSettings.regions) {
        if (pricingSettings.regions[region].includes(uf)) return region;
    }
    return null;
}
