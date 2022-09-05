# async-queue

管理异步队列的工具，支持任务重试、以及并发和 `stream` 模式。

```sh
# 两种模式下完成任务的时间
tasks = [1s,2s,4s,3s];
max = 2
# 并发
tasks => [1s,2s,4s,3s] => [1s,2s],[4s,3s] => 6s # 取两项之间的最大值
# 流模式
tasks => [1s,2s,4s,3s] => [1s,2s],[4s,3s] => [4s,1s],[3s] => [3s, 3s] => 5s

```

## 快速上手

### 安装

```sh
yarn add @boses/async-queue
```

### 使用方式

```js
import { asyncQueue } from '@boses/async-queue';
// or commonjs 引用方式
// const { asyncQueue } = require('@boses/async-queue');

const App = async () => {
  // 异步请求，隐藏具体过程
  const getRquire = [
    async () => {
      // xxx
    },
    async () => {
      // xxx
    },
  ];
  const result = await asyncQueue(getRquire);
  console.log(result);
};

App();
```

## Api

async-queue 暴露三个 api

- [asyncQueue](#asyncQueue)，管理异步队列
- [SingleOptions](#SingleOptions)，管理单次任务
- [create](#create)，根据 [options](#options) 返回 [asyncQueue](#asyncQueue)、[SingleOptions](#SingleOptions)

### asyncQueue

`(tasks: Array<Function>, options?: Options) => AsyncQueueValue`

创建异步队列任务，具体说明如下

#### tasks

等待执行的任务列表，传递值必须为 `Array<Function>`。

> 你可能会疑惑，为什么要求必须为 `() => xxx` 的形式？
>
> 这是因为大多数的情况下任务都是通过函数形式调用，例如给定一个 tasks 通常情况下它会完成一次网络请求或执行一次操作，如果不通过函数形式调用，它的值始终为固定形式。
>
> 为了方便使用，你可以结合`lodash`之类的函数库使用，下面是一个例子
>
> ```js
> import { asyncQueue } from '@boses/async-queue';
> import _ from 'lodash';
> const fn = () => {};
> // 在这里传递参数
> asyncQueue([_.partial(fn, 'test')]);
> ```

#### options

| 名称         | 类型                                                     | 默认值 | 描述                                                                                                                                        |
| ------------ | -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| max          | `number`                                                 | 2      | 最大请求数                                                                                                                                  |
| waitTime     | `number` or `((index: number, retry: number) => number)` | 0      | 每次请求前等待时间，index 为任务索引 retry 为重试次数（在并发模式下，max > index 的索引都不会执行此选项，而在流模式，第一个索引也不会执行） |
| waitTaskTime | `number` or `(() => number)`                             | 0      | 每批任务结束后等待时间，**注意**在 `flowMode` 模式下不起作用（在最后一批任务不受此影响）                                                    |
| throwError   | `boolean`                                                | true   | 是否抛出错误，如果为 false 会把错误值当结果记录下来                                                                                         |
| retryCount   | `number`                                                 | 0      | 任务重试次数                                                                                                                                |
| flowMode     | `boolean`                                                | true   | 是否为流模式，并发和流的区别可以查看文档开头开头例子                                                                                        |

#### defaults

上述 options 的初始值都包含在 defaults 对象上，因此你可以直接修改这个对象，做到全局修改。

> 注意 asyncQueueSingle 函数的默认值也同样受此影响

```js
import { asyncQueue } from '@boses/async-queue';
asyncQueue.defaults.max = 1;
```

#### AsyncQueueValue

asyncQueue 的返回值，具体返回值如下。

| 名称           | 描述                                     |
| -------------- | ---------------------------------------- |
| addListener    | 添加监听器                               |
| removeListener | 删除监听器，如果不提供 fn 参数则删除全部 |

> 注意：`addListener` 添加的监听器会在任务完成自动 `removeListener`，所以不是中途取消监听，无需手动调用。
>
> 上面的方法返回的都是 this，因此可以很容易链式调用。

### asyncQueueSingle

`(tasks: Function, options?: SingleOptions) => Promise<any>`

与 [asyncQueue](#asyncQueue) 使用基本一致，为了方便使用而封装的单次使用方法，具体 Api 如下

#### SingleOptions

| 名称       | 类型      | 默认值 | 描述         |
| ---------- | --------- | ------ | ------------ |
| throwError | `boolean` | `true` | 是否抛出错误 |
| retryCount | `number`  | `0`    | 任务重试次数 |

### create

`create(options) => ({asyncQueue, asyncQueueSingle})`

每次创建任务都需要填写相同的配置项，你会觉得繁琐这也是为什么有 create 这个方法的原因，它接收一个 [options](#options)。

返回值为 asyncQueue 以及 asyncQueueSingle

## 例子

### 链式调用

```js
import { asyncQueue, wait } from '@boses/async-queue';
const result = await asyncQueue([
  async () => {
    await wait(100);
    return 1;
  },
]).addListener(() => {
  // 监听变化
});

console.log(result);
// 1
```

### 爬虫

```js
const axios = require('axios');
const { asyncQueue } = require('@boses/async-queue');

const getPage = async (page = 1) => {
  const { data } = await axios.get(`xxx?p=${page}`);
  return data;
};

const App = async () => {
  const tasks = Array.from({ length: 4 })
    .fill()
    .map((_, index) => () => getPage(index + 1));
  const data = await asyncQueue(tasks, {
    max: 2,
    waitTime: 1000,
    waitTaskTime: 1000,
    retryCount: 1,
  }).addListener((value) => {
    console.log(`当前完成进度为： ${value.progress.toFixed(2)}, 状态为： ${value.status}`);
  });
  console.log(data);
};

App();
```

### 批量插入 element

```js
import { asyncQueue } from '@boses/async-queue';

const app = document.body.querySelector('#app');

const ul = document.createElement('ul');

const task = (_, index) => {
  return () => {
    const li = document.createElement('li');
    li.textContent = `当前元素为：${index + 1}项`;
    ul.appendChild(li);
  };
};

// 为了防止页面卡顿，分批插入
const tasks = Array.from({ length: 1000 }).fill('').map(task);

asyncQueue(tasks, { max: 100, waitTaskTime: 10 }).then((res) => {
  app.appendChild(ul);
});
```

### 重试

对于爬虫之类的任务，你可能想着可以失败后重试，在 asyncQueue 中可以轻松实现，只需要指定 retryCount 属性即可。

下面是一个示例，在计次小于 3 的时候一致失败

```js
import { asyncQueue } from '@boses/async-queue';

let i = 0;
const fn = async () => {
  if (++i < 3) {
    throw new Error(`error`);
  }
  return i;
};

const result = await asyncQueueSingle(fn, { retryCount: 3 });
// result to 3
```

## 兼容性

支持现代浏览器，因为使用了 `WeakMap`、`proxy` 等特性，所以在使用 `webpack` 等构建工具时，让务必让 `babel` 转译此模块。

### [Vue CLI](https://cli.vuejs.org/zh/)

```js
//  vue.config.js
module.exports = {
  transpileDependencies: ['@boses/async-queue'],
};
```

### [webpack](https://webpack.js.org/)

```js
module: {
  rules: [
    {
      test: /\.m?js$/,
      exclude: (modulePath) => {
        // 禁止过滤
        if (modulePath.includes('@boses/async-queue')) {
          return false;
        }
        return /node_modules/.test(modulePath);
      },
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env'],
        },
      },
    },
  ];
}
```

## 其他

如果你有其他建议欢迎反馈和 pr

### 待完成工作

- jest 测试用例完善
- 如果有必要，使用构建工具完成打包

## 协议

[MIT License](./License)
