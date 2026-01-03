---
title: JS中Attribute和Property
date: "2020-05-15 09:34:00"
tags: [JavaScript,docs]
category: blog
---
property和attribute非常容易混淆，网络上常常不区分二者。

但实际上，在HTML中，二者是不同的东西。

<!-- more -->

property是DOM中的属性，JavaScript的对象；

attribute是HTML标签上的属性。

具体的信息可以参考w3c的文档，在这里针对实际操作层面进行一下概括。

1. HTML元素有些自带属性，这些属性对于property和attribute是等效的。
2. attribute会在HTML中体现出来，而property不会。
3. 有些自带属性property和attribute不共有，比如Safari中，`<link>` 的 `disabled` 就只是property。
4. 修改attribute使用 `element.setAttribute(name,value)`。
5. 修改property使用 `element.propertyName = value` 或者 `element.style.styleName = value`。
6. 对于大部分自带属性，attribute被修改后，property会从attribute同步；而attribute不会同步被修改的property。
7. 对于自己定义的属性，attribute和property各自独立。
8. getAttribute在有些浏览器可能会获取到property 。
9. property不限定值的类型，attribute赋值类型只能是字符串。

<div class="ref-label">参考</div>
<div class="ref-list">
<a href="https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLElement/style">
样式
</a>
<a href="https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLLinkElement">
&lt;link&gt; 元素
</a>
<a href="https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLBodyElement">
&lt;body&gt; 元素
</a>
</div>
