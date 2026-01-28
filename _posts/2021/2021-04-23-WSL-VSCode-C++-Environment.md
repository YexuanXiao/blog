---
title: WSL 2和VS Code C++开发环境
date: "2021-04-23 18:54:00"
tags: [Windows,VSCode,C++,GCC,docs,WSL]
category: blog
---
WSL 2最近支持在Explorer中简单管理文件，并且WSL 2还可以自动配置端口转发，正巧我想把博客里的Liquid代码整理一下，但Github Page不给Jeklly解析错误的错误信息，Ruby for Windows又过于臃肿。

我在几年前用过一段时间Ubuntu，对Linux不陌生，便趁此机会转投WSL 2，使用VSCode Server + VSCode进行开发。

<!-- more -->

安装步骤如下：

1. PowerShell执行 `wsl --install`

这个是WSL 2傻瓜化安装方法，不过多数会失败。

下面是手动安装步骤：

1. WSL 2首先要在BIOS中开启虚拟化。

2. PowerShell执行如下命令，给Windows 10添加WSL功能

   ```powershell
   
   dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
   
   ```

3. PowerShell执行如下命令，给Windows 10添加 虚拟机平台 功能

   ```powershell
   
   dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
   
   ```

4. 点击链接下载WSL 2更新并安装：[WSL2 Linux kernel update package for x64 machines](https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi)

5. 去Github下载WSLg [Realease](https://github.com/microsoft/wslg/releases)

准备步骤如下：

1. PowerShell执行 `wsl --set-default-version 2`，设置默认使用WSL 2

2. 去Microsoft Store下载Linux发行版，有以下系统可供选择：

   - Ubuntu
   - openSUSE
   - SUSE Linux Enterprise
   - Kali Linux
   - Debian

   我推荐使用Ubuntu 20.04

3. PowerShell执行wsl或者直接在开始菜单打开对应的Linux发行版

4. 第一次会提示你创建用户名和密码，注意用户名不能有空格，并且一定记住密码

5. 使用WSL 2上的Linux发行版

参考：[Windows Subsystem for Linux Installation Guide for Windows 10](https://docs.microsoft.com/en-us/windows/wsl/install-win10)

G++ 安装部署：

这里我选择安装gcc-11和g++-11

PowerShell执行如下内容：

1. `sudo add-apt-repository ppa:ubuntu-toolchain-r/test`
2. `sudo apt-get update`
3. `sudo apt install gcc-11`
4. `sudo apt install g++-11`
5. `sudo apt install gdb`

VSCode配置步骤：

1. 安装Windows版VSCode

2. Win+R执行 `wsl code`，或者开始菜单打开Ubuntu，执行 `code`。

3. 此时WSL会自动安装VSCode Server并自动配置，然后会自动打开Windows的VSCode。

4. 此时打开Explorer，左下角会有一个Linux，打开后进入home目录，这个文件夹下面有一个以你的用户名命名的文件夹，这个文件夹就是开始菜单的WSL Shell默认进入的目录。

5. 在Linux上，`~` 也代表 那个以你的用户名命名的目录。

6. 在项目文件夹下面建立 .vscode文件夹，其中建立三个文件内容如下：

launch.json

```json
{
    // 使用IntelliSense了解相关属性。 
    // 悬停以查看现有属性的描述。
    // 欲了解更多信息，请访问: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [
        {
            "name": "gcc-11 - 生成和调试活动文件",
            "type": "cppdbg",
            "request": "launch",
            "program": "${fileDirname}/${fileBasenameNoExtension}",
            "args": [],
            "stopAtEntry": false,
            "cwd": "${workspaceFolder}",
            "environment": [],
            "externalConsole": false,
            "MIMode": "gdb",
            "miDebuggerPath": "gdb",
            "setupCommands": [
                {
                    "description": "为gdb启用整齐打印",
                    "text": "-enable-pretty-printing",
                    "ignoreFailures": true
                }
            ],
            "preLaunchTask": "Launch: build active file"
        }
    ]
}
```

tasks.json

```json
{
	"version": "2.0.0",
	"tasks": [
		{
			"type": "cppbuild",
			"label": "Launch: build active file",
			"command": "/usr/bin/gcc-11",//改成自己需要用的编译器
			"args": [
				"-g",
				"${file}",
				"-o",
				"${fileDirname}/${fileBasenameNoExtension}"
			],
			"options": {
				"cwd": "${workspaceFolder}"
			},
			"problemMatcher": [
				"$gcc"
			],
			"group": "build",
			"detail": "use /usr/bin/gcc-11"
		}
	]
}
```

有时候会遇到VSCode提示更新includePath，这时候需要在wsl里执行 `gcc-11 -v -E -x c++ -`

此时程序会输出一些信息，按下ctrl+C终止程序，然后找到这句：`#include <...> search starts here:`

直到这句：`End of search list.`

把中间的内容处理为如下格式并储存为 .vscode下的文件：

c\_cpp\_properties.json

```json
{
    "configurations": [
        {
            "name": "Linux",
            "includePath": [
                "${workspaceFolder}/**",
                "/usr/include/c++/11",
                "/usr/include/x86_64-linux-gnu/c++/11",
                "/usr/include/c++/11/backward",
                "/usr/lib/gcc/x86_64-linux-gnu/11/include",
                "/usr/local/include",
                "/usr/include/x86_64-linux-gnu",
                "/usr/include"//最后一行没逗号
            ],
            "defines": [],
            "compilerPath": "/usr/bin/cpp",
            "cStandard": "gnu11",
            "cppStandard": "c++20",
            "intelliSenseMode": "linux-gcc-x64"
        }
    ],
    "version": 4
}
```
