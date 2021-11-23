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
