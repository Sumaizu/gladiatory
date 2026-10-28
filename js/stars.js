// особые ники стримеров — как в Чатобороне: переливаются или горят своим цветом
export const STARS = new Map([['sumaizu', 'rainbow'], ['sukoshissrb', 'white'], ['fra3a', 'thyme'],
  ['welovegames', 'heart'], ['higashi_vo', 'snow']]);
export const STAR_COLORS = { white: '#ffffff', thyme: '#5edc1f', heart: '#d42426', snow: '#a6d6ff' };
export const RAINBOW = ['#ff6b6b', '#ffb547', '#f2e96e', '#7be3a0', '#6ec3ff', '#b79bff', '#ff8fd0', '#ff6b6b'];
// одна полоса радуги и время её прохода — как в CSS-анимации
export const RAINBOW_W = 120;
export const RAINBOW_CYCLE = 2400;
export const SNOW_CYCLE = 6000;

export const starOf = (login) => (login && STARS.get(String(login).toLowerCase())) || null;
