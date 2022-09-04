import type { Fn } from './event';

/**
 * 让程序休眠指定时间
 *
 * @param {number} time
 */
export const sleep = (time: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
};

export const isFunction = (obj: any): obj is Fn => {
  return typeof obj === 'function';
};

/**
 * 生成指定区间随机数
 *
 * @param {number} min 最小值
 * @param {number} max 最大值
 * @param {boolean} [integer=true] 是否为整数
 */
export const random = (min: number, max: number, integer = true) => {
  const large = Math.max(min, max);
  const small = Math.min(min, max);
  if (integer) {
    return Math.floor(Math.random() * (large - small + 1)) + small;
  }
  return Math.random() * (large - small) + small;
};
