---
title: 一个Chrome的Bug
date: "2020-07-05 19:16:00"
tags: [Chrome,HTML,JavaScript]
category: blog
---
从任意文章页使用超链接跳转到分类页，使用 `window.getComputedStyle(container, null).getPropertyValue("margin-left");` 获取到默认值0px。

滑动到顶部该问题消失。

container的 `margin-left` 属性的值是 `margin:auto` 分配的，`window.getComputedStyle` 用于获取值。

<!-- more -->

与 `element.propertyName` 获取到元素的 被赋予的属性的值 不同， `window.getComputedStyle`  获取到的值是元素实际拥有的值（不会因CSS的 `filter` 改变）。

由于我是为了让导航栏自适应页面两侧的留白，本身就是通过获取main-container的margin-left得到，所以改用 `container.offsetLeft` 获取main-container距离窗口左侧的距离便可以解决这个问题。

注意，`container.offsetLeft` 和上述两种方法的最大区别在于 `offsetLeft` 给出的值的数据类型是BigInt （整数，无单位），而前两者给出Value。

虽然实际上三者读取到的值的单位都为px。
