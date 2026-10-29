---
title: Windows 控制台代码页
date: "2026-10-12 20:13:00"
tags: [Windows, docs]
category: blog
---

一年多以前我写了个博文[理解C和C++程序的编码](/blog/2025/07/01/Undestand-Encoding-In-C/)介绍了C和C++中字符串编码的情况，但对Windows控制台的解释还不够好。本文是对这部分内容的补全。

<!-- more -->

Windows控制台可以基本理解为程序和condrv.sys通信，condrv.sys通过类似管道的文件和conhost.exe通信，这些文件是可以被共享的，父进程在启动子进程的时候选择继承控制台可以让控制台被子进程继承。共享的控制台共享这些用于通信的文件和同一个conhost进程。调用前文指出的API实际上就会通过这几个文件和conhost通信。

如果使用第三方终端，那么第三方终端和conhost通过管道和conhost通信。openconsole.exe是conhost.exe的可分发版本。

conhost进程持有所有控制台API需要的控制台状态。`ConsoleOutputCP` 和 `ConsoleCP` 两个代码页是控制台状态的一部分，它们的默认值是系统代码页也就是 `GetACP` 的值。如果在Windows设置/语言和区域中开启了UTF-8选项，会使得系统代码页变为UTF-8，进而导致conhost的这两个代码页被初始化为UTF-8。

`SetConsoleOutputCP`，`SetConsoleCP`，`GetConsoleOutputCP`，`GetConsoleCP` 的作用就是读写 `ConsoleOutputCP` 和 `ConsoleCP`。

Windows中有两类API能读写控制台，一类是所有文件系统共用的三组API：`ReadFile`/`ReadFileEx`/`NtReadFile`、`WriteFile`/`WriteFileEx`/`NtWriteFile`、`FlushFileBuffers`/`NtFlushBuffersFile`/`NtFlushBuffersFileEx`，一类是Win32控制台API，也就是名字中包括Console，且第一个参数为句柄的那些。

所有Win32控制台API的W版本都固定将参数传递的字节解释为UTF-16；所有不是W版本的向控制台写入字节API调用后，写入的字节根据 `ConsoleOutputCP` 进行解码；所有不是W版本的向控制读取字节API调用后，读取的字节根据 `ConsoleCP` 进行编码。

注意，由于控制台是可继承的，所以继承了控制台的子进程也可以改变和父进程共享的控制台的状态，并且不会自动恢复。

因此，要让Windows控制台正确使用Unicode输入输出，有两个方案，一个方案是始终使用W版本的控制台API，一个方案是在程序启动时使用 `SetConsoleOutputCP` 和 `SetConsoleCP` 设置控制台代码页为UTF-8，然后使用通用API进行读写，最后还原控制台代码页。注意如果你的程序使用第二个方案，那么你不需要使用A版本的控制台API，它们是过时的并且不方便，见最后一段。

在Windows上启动一个未知的程序并且继承当前的控制台的正确流程是，先记录当前的 `ConsoleOutputCP` 和 `ConsoleCP` 的值，然后设置 `ConsoleOutputCP` 和 `ConsoleCP` 为OEMCP，因为有些程序只支持使用OEMCP进行输出，当程序执行完成时，再还原OEMCP。如果在开发一个Shell程序，就需要这么做。

判断一个句柄是不是控制台，应该使用 `NtQueryVolumeInformationFile` 函数，配合 `FileFsDeviceInformation` 参数，检查结果是不是 `FILE_DEVICE_CONSOLE`，这是唯一有效判断控制台的方法（Windows8开始支持）。C++标准里写的用的 `GetConsoleMode` 进行的判断，这函数极端情况下比 `NtQueryVolumeInformationFile` 慢一百倍，因为要走上述的通信流程。而控制台文档给出的 `GetFileType` 得到的结果不准，对NUL这种设备也返回`FILE_TYPE_CHAR`。我最近发现了这个问题，正在纠正标准，标准库实现和Windows文档。

当程序的输入输出被重定向时，`GetStdhandle` 获得的句柄就不指向控制台。只有真正的控制台句柄才能调用控制台API，如果不想做这个判断，就应该设置控制台代码页为UTF-8然后用通用文件读写函数来写入控制台，通用文件读写函数对任何能读写的句柄都有效。
