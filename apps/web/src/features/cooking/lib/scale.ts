export const SCALE_FACTORS = [0.5, 1, 2, 3];

/** The servings a factor gives, to one decimal */
export const scaledServings = (servings: number, scale: number) =>
  Math.round(servings * scale * 10) / 10;
