import Event from '../event';

test(`event addListener`, () => {
  const event = new Event();
  expect(() => event.addListener({} as any)).toThrow();
});

test(`evevt emit`, () => {
  const event = new Event();
  const fn = jest.fn();
  event.addListener(fn);
  event.emit(1, 2, 3);
  expect(fn.mock.calls[0]).toEqual([1, 2, 3]);
  expect(fn.mock.calls.length).toBe(1);
});

test(`event destroy`, () => {
  const event = new Event();
  const fn = () => {
    //
  };
  event.addListener(fn);
  expect(event.list.length).toBe(1);
  event.destroy();
  expect(event.list.length).toBe(0);
});
