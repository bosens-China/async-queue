/*
 * 简易版发布订阅
 */

import { isFunction } from './utils';
import type { Fn } from './asyncQueue';

class Event {
  list: Array<Fn> = [];
  addListener(listener: Fn) {
    if (!isFunction(listener)) {
      throw new Error(`listener must be a function!`);
    }
    this.list.push(listener);
  }

  removeListener(listener: Fn) {
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

  destroy() {
    this.list = [];
  }
}

export default Event;
