---
title: Windows Console Code Pages
date: "2026-10-12 20:13:00"
tags: [Windows, docs]
category: blog
---

More than a year ago I wrote a blog post [Understanding Encoding in C and C++ Programs](/blog/2025/07/01/Undestand-Encoding-In-C/) that introduced the situation of string encoding in C and C++, but the explanation of the Windows console was not good enough. This article is a supplement to that part.

<!-- more -->

The Windows console can basically be understood as programs communicating with condrv.sys, and condrv.sys communicating with conhost.exe through pipe-like files. These files can be shared, and when a parent process starts a child process, choosing to inherit the console allows the console to be inherited by the child process. A shared console shares these files used for communication and the same conhost process. Calling the APIs pointed out in the previous article actually communicates with conhost through these files.

If a third-party terminal is used, then the third-party terminal communicates with conhost through a pipe. openconsole.exe is the distributable version of conhost.exe.

The conhost process holds all the console state needed by the console APIs. The two code pages `ConsoleOutputCP` and `ConsoleCP` are part of the console state, and their default value is the system code page, that is, the value of `GetACP`. If the UTF-8 option is enabled in Windows Settings/Language and Region, the system code page will become UTF-8, which in turn causes these two code pages of conhost to be initialized to UTF-8.

The role of `SetConsoleOutputCP`, `SetConsoleCP`, `GetConsoleOutputCP`, and `GetConsoleCP` is to read and write `ConsoleOutputCP` and `ConsoleCP`.

There are two types of APIs in Windows that can read and write the console. One type is the three groups of APIs shared by all file systems: `ReadFile`/`ReadFileEx`/`NtReadFile`, `WriteFile`/`WriteFileEx`/`NtWriteFile`, and `FlushFileBuffers`/`NtFlushBuffersFile`/`NtFlushBuffersFileEx`. The other type is the Win32 console APIs, that is, those whose names include Console and whose first parameter is a handle.

All W versions of the Win32 console APIs always interpret the bytes passed as parameters as UTF-16; after all non-W versions of the APIs that write bytes to the console are called, the written bytes are decoded according to `ConsoleOutputCP`; after all non-W versions of the APIs that read bytes from the console are called, the read bytes are encoded according to `ConsoleCP`.

Note that because the console is inheritable, a child process that inherits the console can also change the state of the console shared with the parent process, and it will not be automatically restored.

Therefore, to make the Windows console correctly use Unicode input and output, there are two solutions. One solution is to always use the W versions of the console APIs. The other solution is to use `SetConsoleOutputCP` and `SetConsoleCP` at program startup to set the console code pages to UTF-8, then use the generic APIs for reading and writing, and finally restore the console code pages. Note that if your program uses the second solution, then you do not need to use the A versions of the console APIs; they are outdated and inconvenient, see the last paragraph.

The correct process for starting an unknown program on Windows and inheriting the current console is to first record the current values of `ConsoleOutputCP` and `ConsoleCP`, then set `ConsoleOutputCP` and `ConsoleCP` to OEMCP, because some programs only support output using OEMCP, and when the program finishes executing, restore OEMCP. If you are developing a Shell program, you need to do this.

To determine whether a handle is a console, you should use the `NtQueryVolumeInformationFile` function with the `FileFsDeviceInformation` parameter, and check whether the result is `FILE_DEVICE_CONSOLE`. This is the only effective way to determine a console (supported starting from Windows 8). The C++ standard says to use `GetConsoleMode` for the determination. In extreme cases, this function is a hundred times slower than `NtQueryVolumeInformationFile`, because it has to go through the aforementioned communication process. The result given by `GetFileType` in the console documentation is inaccurate; it also returns `FILE_TYPE_CHAR` for devices such as NUL. I recently discovered this problem and am correcting the standard, standard library implementations, and Windows documentation.

When the program's input and output are redirected, the handle obtained by `GetStdhandle` no longer points to the console. Only a real console handle can call the console APIs. If you do not want to make this determination, you should set the console code pages to UTF-8 and then use the generic file read and write functions to write to the console. The generic file read and write functions are valid for any handle that can be read from or written to.
