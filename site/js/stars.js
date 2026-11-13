// особые ники стримеров — как в Чатобороне: переливаются или горят своим цветом
export const STARS = new Map([['sumaizu', 'rainbow'], ['sukoshissrb', 'white'], ['fra3a', 'thyme'],
  ['welovegames', 'heart'], ['higashi_vo', 'snow'], ['renozis', 'glare']]);
export const STAR_COLORS = { white: '#ffffff', thyme: '#5edc1f', heart: '#d42426', snow: '#a6d6ff', glare: '#ff2b2b' };
export const RAINBOW = ['#ff6b6b', '#ffb547', '#f2e96e', '#7be3a0', '#6ec3ff', '#b79bff', '#ff8fd0', '#ff6b6b'];
// одна полоса радуги и время её прохода — как в CSS-анимации
export const RAINBOW_W = 120;
export const RAINBOW_CYCLE = 2400;
export const SNOW_CYCLE = 6000;
// блик Renozis: размер раскалённой середины (доля ширины ника) и красное свечение (px) по долям цикла — как в CSS
export const GLARE_CYCLE = 3000;
export const GLARE_SIZE = [[0, 0.7], [0.09, 0.25], [0.13, 1.2], [0.31, 0.55], [0.35, 1], [0.52, 0.3], [0.56, 0.95],
  [0.74, 0.6], [0.78, 1.1], [1, 0.7]];
export const GLARE_GLOW = [[0, 3], [0.09, 1], [0.13, 6], [0.35, 5], [0.52, 2], [0.78, 6], [1, 3]];

export const starOf = (login) => (login && STARS.get(String(login).toLowerCase())) || null;
