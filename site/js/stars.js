// особые ники стримеров — как в Чатобороне: переливаются или горят своим цветом
export const STARS = new Map([['sumaizu', 'rainbow'], ['sukoshissrb', 'white'], ['fra3a', 'thyme'],
  ['welovegames', 'heart'], ['higashi_vo', 'snow'], ['renozis', 'glare'],
  ['sulffur_', 'gem']]);
export const STAR_COLORS = { white: '#ffffff', thyme: '#5edc1f', heart: '#d42426', snow: '#a6d6ff', glare: '#ff2b2b' };
export const RAINBOW = ['#ff2b2b', '#ff8a00', '#ffe100', '#1ee35a', '#00b2ff', '#7b3cff', '#ff2bd2', '#ff2b2b'];
// одна полоса радуги и время её прохода — как в CSS-анимации
export const RAINBOW_W = 120;
export const RAINBOW_CYCLE = 2400;
export const SNOW_CYCLE = 6000;
// блик Renozis: размер раскалённой середины (доля ширины ника) по долям цикла — как в CSS
export const GLARE_CYCLE = 3000;
export const GLARE_SIZE = [[0, 0.7], [0.09, 0.25], [0.13, 1.2], [0.31, 0.55], [0.35, 1], [0.52, 0.3], [0.56, 0.95],
  [0.74, 0.6], [0.78, 1.1], [1, 0.7]];
// переливы sulffur_: полоса нефрит → красный → фиолетовый (по нику идут нефрит → фиолетовый → красный), глянец сверху,
// раз за цикл белый блик, подсветка в цвет букв — как в CSS
export const GEM = [[0, '#00d980'], [0.1, '#4dffb8'], [0.22, '#00d980'], [0.26, '#08704f'], [0.29, '#8a0a26'],
  [0.33, '#ff1a3c'], [0.44, '#ff6680'], [0.55, '#ff1a3c'], [0.66, '#7a2dff'], [0.77, '#b57aff'], [0.88, '#7a2dff'],
  [1, '#00d980']];
export const GEM_W = 360;
export const GEM_CYCLE = 6000;

export const starOf = (login) => (login && STARS.get(String(login).toLowerCase())) || null;
