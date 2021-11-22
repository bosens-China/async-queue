/*
 * 简易版发布订阅
 */

import { isFunction } from './utils';

class Event {
  list: Array<Function> = [];
  addListener(listener: Function) {
    if (!isFunction(listener)) {
      throw new Error(`listener must be a function!`);
    }
    this.list.push(listener);
  }

  removeListener(listener: Function) {
    const index = this.list.indexOf(listener);
    if (index <= -1) {
      return;
    }
    this.list.splice(index, 1);
  }

  emit<T = any>(...rest: Array<T>) {
    this.list.forEach((fn) => {
      fn(...rest);
    });
  }
}

export default Event;
