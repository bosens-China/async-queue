export const isFunction = (fn: any): fn is Function => typeof fn === 'function';

export const isObjectLink = (obj: any): obj is Record<any, any> => typeof obj === 'object' && obj;

export const wait = (time: number) => {
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

export const packingArray = (...value: Array<any>) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => packing(item));
};
