---
title: 停止使用 AttachConsole
date: "2026-06-13 01:03:00"
tags: [C++,Windows,docs]
category: blog
---

Windows XP开始提供了一个函数 `AttachConsole`，它的用途是使得Subsystem为Windows的GUI/后台程序，在使用控制台执行时可以获得控制台的输入输出句柄，使得它们既可以独立使用也可以和控制台配合使用。但该函数实际上存在缺陷使得它不能很好完成该任务。

<!-- more -->

Windows长期以来的习惯是，Shell不应该等待GUI应用的结束，也就是说，在Shell启动GUI应用后，GUI应用就脱离Shell存在了，可以任意关闭终端。

该行为通常不造成问题，并被很多程序依赖：很多程序使用Shell来间接启动一些GUI程序，在Shell完成工作后，终端会退出，但GUI程序仍然保留。该方法的一个重要缺陷是它会启动一个一闪而过的终端窗口，但无论如何，这种模式长期存在。

既然Shell不等待GUI程序，那么Shell就不拥有GUI程序的控制权。此时，`AttachConsole` 的问题就以两点暴露出来了：

1. `AttachConsole` 会让GUI程序真正拥有控制台，但绕过了Shell。在Shell中运行这种GUI程序后，执行 `exit` 只会退出Shell而不会使得终端被关闭。
2. 由于Shell不等待GUI程序，如果GUI程序向控制台输出了内容，GUI程序的输出会和Shell的输出混叠在一起。

Windows控制台团队在2020年终于发现了该问题，并最终在2023（Windows11 Build 26100）年给出了解决方案：[控制台分配策略](https://learn.microsoft.com/en-us/windows/console/console-allocation-policy)。

通过在应用程序清单中设置该策略，可以延迟Subsystem为Console的程序被系统分配控制台：

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <application>
    <windowsSettings>
      <consoleAllocationPolicy xmlns="http://schemas.microsoft.com/SMI/2024/WindowsSettings">detached</consoleAllocationPolicy>
    </windowsSettings>
  </application>
</assembly>
```

一旦设置 `consoleAllocationPolicy` 为 `detached`，使用 `CreateProcess` 启动该程序并且参数为 `CREATE_NEW_CONSOLE`（这是大部分情况下的默认和合理参数）时，会表现得如同GUI程序一样，不创建控制台。

此时，由于Subsystem还是Console，在Shell中启动该程序时，仍然会等待该程序结束，解决了之前提到的问题。

对于该控制台程序而言，可以在运行早期调用新的 `AllocConsoleWithOptions` 函数以得到旧的 `AllocConsole` 和 `AttachConsole` 的等价行为。

<div class="ref-label">参考</div>
<div class="ref-list">
<a href="https://github.com/microsoft/terminal/blob/main/doc/specs/%237335%20-%20Console%20Allocation%20Policy.md">
Console Allocation Policy (Design Decision)
</a>
<a href="https://learn.microsoft.com/en-us/windows/console/console-allocation-policy">
Console Allocation Policy
</a>
<a href="https://learn.microsoft.com/en-us/windows/console/allocconsolewithoptions">
AllocConsoleWithOptions
</a>
</div>
