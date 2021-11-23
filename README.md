# async-queue

让你轻松管理队列的异步，支持并发和流两种模式。

```sh
# 条件
tasks = [1s,2s,4s,3s];
max = 2
# 并发
task => [1s,2s] => [4s,3s] # 完成时间6s
# 流
task => [1s,2s] => [4s,2s] => [4s,3s] # 完成时间5s

```

## 安装

安装

```sh
yarn add @boses/async-queue
```

## 用法

```js
const { asyncQueue } = require('@boses/async-queue');

const App = async () => {
  // 异步请求，隐藏具体细节
  const getRquire = async () => {};
  const result = await asyncQueue(getRquire, getRquire);
};

App();
```

也可以通过 es 模块来使用

```js
import { asyncQueue } from '@boses/async-queue';
```

## asyncQueue

`(tasks: Array<Function>, option?: Option) => ReturnValue`

创建异步队列，具体说明如下

### task

等待执行的任务列表，传递值必须为`Array<Function>`

### option

| 名称         | 类型                                      | 默认值  | 描述                                                          |
| ------------ | ----------------------------------------- | ------- | ------------------------------------------------------------- |
| max          | `number`                                  | `1`     | 最大请求数                                                    |
| waitTime     | `number` or `((index: number) => number)` | `0`     | 每次请求完成后等待时间                                        |
| waitTaskTime | `number` or `(() => number)`              | `0`     | 每批任务结束后等待时间，**注意**在`flowMode`模式下不起作用    |
| throwError   | `boolean` or `false`                      | `false` | 是否抛出错误，默认为`false`，在发生错误的时候将错误值记录下来 |
| retryCount   | `number` or `false`                       | `0`     | 每个任务重试次数                                              |
| flowMode     | `boolean` or `false`                      | `false` | 是否为流模式，默认为并发模式                                  |

### ReturnValue

| 名称           | 类型                                                                     | 描述                                                                              |
| -------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| option         | `Option`                                                                 | 返回处理过的`option`对象                                                          |
| tasks          | `Array<Function>`                                                        | 返回传递的`tasks`列表，注意你不应该直接修改`task`的值，而是通过下面的`push`等方法 |
| state          | `['start', 'suspend','operation','end','error']`                         | 返回当前状态                                                                      |
| push           | `(...rest: Array<Function>): void`                                       | 跟`Array.push`使用方式一致，不过必须传递`Function`的参数                          |
| splice         | `splice(start: number, deleteCount?: number, ...rest?: Array<Function>)` | 跟`Array.splice`使用方式一致，不过添加值必须传递`Function`参数                    |
| suspend        | `() => void`                                                             | 暂停执行                                                                          |
| operation      | `() => void`                                                             | 恢复执行                                                                          |
| termination    | `() => void`                                                             | 终止任务                                                                          |
| addListener    | `(fn: Function): { cancen: () => void }`                                 | 添加监听器，返回的`cancel`方法跟`removeListener`一个作用                          |
| removeListener | `(fn: Function) => void`                                                 | 删除监听器                                                                        |

> 注意：`addListener`添加的监听器会在任务完成自动`removeListener`，所以不是中途取消监听，无需手动调用。

## 例子

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
  const result = asyncQueue(tasks, {
    max: 2,
    waitTime: 1000,
    waitTaskTime: 1000,
    retryCount: 1,
  });
  result.addListener((value) => {
    console.log(`当前完成进度为： ${value.progress.toFixed(2)}, 状态为： ${value.status}`);
  });
  const data = await result;
  // 后续对data进行其他操作
  console.log(data);
};

App();
```

## 批量插入 element

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

## 兼容性

支持现代浏览器，因为使用了`WeakMap`、`definePropertie`等特性，所以在使用`webpack`等构建工具时，让务必让`babel`转译此模块。

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

## 协议

[MIT License](./License)
