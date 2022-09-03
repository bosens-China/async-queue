import type { Fn } from './asyncQueue';

export const isFunction = (fn: any): fn is Fn => typeof fn === 'function';

/**
 * 等待
 *
 * @param {number} time
 * @return {*}
 */
export const wait = (time: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(undefined);
    }, time);
  });
};

/**
 * 返回随机数
 *
 * @param {number} min
 * @param {number} max
 * @param {boolean} [integer=true] 是否为整数
 * @return {*}
 */
export const random = (min: number, max: number, integer = true) => {
  const large = Math.max(min, max);
  const small = Math.min(min, max);
  if (integer) {
    return Math.floor(Math.random() * (large - small + 1)) + small;
  }
  return Math.random() * (large - small) + small;
};
