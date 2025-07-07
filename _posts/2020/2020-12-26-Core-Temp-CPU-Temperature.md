---
title: Windows 显示 CPU 温度 Core Temp
date: "2020-12-26 12:38:00"
tags: [Windows]
category: blog
---
众所周知，Windows 虽然提供了获得 CPU 温度的各种接口，但是却没有提供现成的显示 CPU 温度的控件。虽然市面上很多软件都可以显示 CPU 温度，但是大多过于臃肿。Core Temp 就是一个非常小巧的软件，可以方便的查看 CPU 温度。

<!-- more -->

![20201226123256](//static.nykz.org/blog/images/2020-12-26/20201226123256.avif "candark")

这个软件就是一个查看 CPU 基础信息和温度的小工具，安装程序只有 1.22MB，非常小巧

![20201226123220](//static.nykz.org/blog/images/2020-12-26/20201226123220.avif "candark")
![20201226123225](//static.nykz.org/blog/images/2020-12-26/20201226123225.avif "candark")

这样设置就可以让 Core Temp 开机自启，并且 Core Temp 的开机自启，由于需要管理员权限，所以是用计划任务方式实现的。

![20201226123334](//static.nykz.org/blog/images/2020-12-26/20201226123334.avif "candark")
![20201226123230](//static.nykz.org/blog/images/2020-12-26/20201226123230.avif "candark")
![20201226123426](//static.nykz.org/blog/images/2020-12-26/20201226123426.avif "candark")

内存占用非常小，只有 17.9MB，而且几乎不占用 CPU。

![20201226124145](//static.nykz.org/blog/images/2020-12-26/20201226124145.avif "candark")

托盘区的温度颜色调整成黑色之后也比较美观。
