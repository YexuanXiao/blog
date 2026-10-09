---
title: 使用代码监听和更改 Windows11 主题色
date: "2026-10-08 19:52:00"
tags: [Windows, docs]
category: blog
---

Windows11 添加了对亮暗主题色的支持，但并没有任何公开文档说明如何查询和监听主题色。但实际上微软半公开的提供了API。

<!-- more -->

Windows在C:\Windows\SystemApps\MicrosoftWindows.UndockedDevKit_cw5n1h2txyewy\windowsudk.winmd公开了一部分Shell API，包括修改和监听主题色所需要的。

使用C++/WinRT或者C#/WinRT可以根据这个winmd文件生成接口的投影，其中 `WindowsUdk.UI.Theme.SystemVisualTheme` 和 `WindowsUdk.UI.Theme.AppVisualTheme` 两个类提供了我们需要的功能。

这两个类各自实现了一个静态成员 `Current` 和一个事件 `Changed`。`Current` 的类型为 `WindowsUdk.UI.Theme.VisualTheme`，定义了4个值为 `Dark`，`Light`，`HighContrastBlack`，`HighContrastWhite` 分别为0，1，2，3，只有 `Dark` 和 `Light` 是合法的，在Windows11 28120上传递另外两个值会返回未实现。注册 `Changed` 事件就可以监听主题色更改。

相比于读写和监听注册表，使用UDK提供的这两个类方便了很多。
