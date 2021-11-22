export const isFunction = (fn: any): fn is Function => typeof fn === 'function';

export const isObjectLink = (obj: any): obj is Record<any, any> => typeof obj === 'object' && obj;

export const isObject = (obj: any): obj is object => isFunction(obj) || isObjectLink(obj);

/**
 * 等待
 */
export const wait = (time: number) => {
  if (!Number(time)) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(undefined);
    }, time);
  });
};

/**
 * 将参数转化为 () => value 形式
 */
export const packing = (value: any) => {
  if (isFunction(value)) {
    return value;
  }
  return () => value;
};

/**
 * 将参数转化为函数调用，有两种调用方式
 * 1. 直接传递([1,2])的形式
 * 2. 传递(1)形式
 */
export const packingArray = (value: any, ...rest: Array<any>) => {
  const arr: Array<any> = [];
  if (rest.length) {
    arr.push(value);
    arr.push(...rest);
  } else {
    if (Array.isArray(value)) {
      arr.push(...value);
    } else {
      arr.push(value);
    }
  }
  return arr.map((item) => packing(item));
};

/**
 * 简单版oject.assign
 * 主要是为了解决assing拷贝get和set属性失效问题
 */
export const assign = <S, T>(proto: S, ...propertiesObject: Array<T>): S & T => {
  const obj = (isObject(proto) ? proto : {}) as S & T;
  propertiesObject.forEach((item) => {
    if (isObject(item)) {
      Object.defineProperties(obj, Object.getOwnPropertyDescriptors(item));
    }
  });
  return obj;
};
