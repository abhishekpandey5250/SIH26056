/**
 * Normalizes route weights so their sum is exactly 1.0.
 *
 * @param {Array<{routeKey: string, weight: number}>} weights
 * @returns {Array}
 */
export function normalizeWeights(weights) {
  if (!Array.isArray(weights) || weights.length === 0) {
    return [];
  }

  const validWeights = weights.filter((weight) => (
    weight && typeof weight.weight === 'number' && weight.weight > 0
  ));
  const totalWeight = validWeights.reduce((sum, weight) => sum + weight.weight, 0);

  if (totalWeight <= 0) {
    throw new Error('Total configured route weight must be strictly positive');
  }

  return validWeights.map((weight) => ({
    ...weight,
    weight: weight.weight / totalWeight,
    rawWeight: weight.weight,
  }));
}
