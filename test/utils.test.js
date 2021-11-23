import { isFunction, isObjectLink, wait, isObject, assign } from '../src/utils';

test(`isFunction`, () => {
  expect(isFunction(() => {})).toBeTruthy();
  expect(isFunction({})).toBeFalsy();
});

test('isObjectLink', () => {
  expect(isObjectLink({})).toBeTruthy();
  expect(isObjectLink(null)).toBeFalsy();
  expect(isObjectLink(() => {})).toBeFalsy();
  expect(isObjectLink([])).toBeTruthy();
});

test(`wait`, async () => {
  const time = +new Date();
  await wait(100);
  expect(+new Date() - time >= 100).toBeTruthy();
});

test(`isObject`, () => {
  expect(isObject({})).toBeTruthy();
  expect(() => {}).toBeTruthy();
});

test(`assign`, () => {
  expect(assign({}, { b: 123 })).toEqual({ b: 123 });
  const obj = { value: 123 };
  const value = {
    get b() {
      return obj.value;
    },
  };
  obj.value = 1;
  expect(assign({}, value).b).toBe(1);
});
