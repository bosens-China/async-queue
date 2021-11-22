export const isFunction = (fn: any): fn is Function => typeof fn === 'function';

export const isObjectLink = (obj: any): obj is Record<any, any> => typeof obj === 'object' && obj;

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

export const packing = (value: any) => {
  if (isFunction(value)) {
    return value;
  }
  return () => value;
};

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
