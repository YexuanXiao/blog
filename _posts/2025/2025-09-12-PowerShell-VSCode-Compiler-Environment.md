---
title: PowerShell和VSCode下的编译器环境
date: "2025-09-11 10:41:00"
tags: [Windows, docs]
category: blog
---

总有人问我使用Windows时如何快速的切换不同编译器环境，实际上在不同层次有不同的方法，可以做到非常灵活。

<!-- more -->

对于Visual Studio，可以编写以下PowerShell函数来实现快速启动：

```powershell

function VS-Env {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$false)]
        [ValidateSet("amd64", "x86", "aarch64")]
        [string]$Arch = "amd64"
    )
    & "C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\Launch-VsDevShell.ps1" -Host amd64 -SkipAutomaticLocation -Arch $Arch
}

```

对于GCC和Clang，用类似的方法添加Path：

```powershell

function Clang-Env {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$false)]
        [ValidateSet("amd64", "x86")]
        [string]$Arch = "amd64"
    )

    $Bin = "D:\Projects\clang\llvm\bin"
    $Runtime = "D:\Projects\clang\x86_64-windows-gnu\bin"
    
    $env:PATH = "$Runtime;$Bin;$env:PATH"
}

function GCC-Env {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$false)]
        [ValidateSet("amd64", "x86")]
        [string]$Arch = "amd64"
    )

    $LibPrefix = "D:\Projects\gcc\lib"
    $Bin = "D:\Projects\gcc\bin"

    switch ($Arch) {
        "amd64" { $Lib = $LibPrefix }
        "x86"   { $Lib = "$($LibPrefix)32" }
    }
    
    $env:PATH = "$Bin;$Lib;$env:PATH"
}

```

如果你使用Windows终端，那么可以设置PowerShell的启动参数，通过下拉菜单快速切换：

```powershell

PowerShell -NoExit -Command "& {VS-Env amd64}"
PowerShell -NoExit -Command "& VS-Env amd64"
& VS-Env amd64

```

三者皆可。

VSCode的CMakeTools提供一个功能叫做用户本地工具包，使用该JSON配置不同编译器后，VSCode的状态栏就可以快速切换编译器。

```json

[
  {
    "name": "Clang 21.0.0 STL Debug",
    "compilers": {
      "C": "D:\\Projects\\clang\\llvm\\bin\\clang.exe",
      "CXX": "D:\\Projects\\clang\\llvm\\bin\\clang++.exe"
    },
    "cmakeSettings": {
      "CMAKE_CXX_FLAGS": "--target=x86_64-windows-msvc --sysroot=D:\\Projects\\windows-msvc-sysroot -fuse-ld=lld -D_DLL=1 -lmsvcrtd -fno-rtti -Wno-unused-command-line-argument",
      "CMAKE_C_FLAGS": "--target=x86_64-windows-msvc --sysroot=D:\\Projects\\windows-msvc-sysroot -fuse-ld=lld -D_DLL=1 -lmsvcrtd -Wno-unused-command-line-argument"
    },
    "isTrusted": true,
    "keep": true
  },
    {
    "name": "Visual Studio Community 2022 Preview - amd64",
    "visualStudio": "1dd4b87f",
    "visualStudioArchitecture": "x64",
    "isTrusted": true,
    "preferredGenerator": {
      "name": "Visual Studio 17 2022",
      "platform": "x64",
      "toolset": "host=x64"
    }
  }
]

```

具体如何使用可以参考CMakeTools的文档。

最后，CMake本身支持使用CMakePresets.json来快速设置编译器环境。

最简例子如下：

```json

{
    "version": 6,
    "cmakeMinimumRequired": {
        "major": 3,
        "minor": 25,
        "patch": 0
    },
    "configurePresets": [
        {
            "name": "default",
            "hidden": false,
            "generator": "Ninja",
            "binaryDir": "${sourceDir}/build/${presetName}",
            "cacheVariables": {
                "CMAKE_BUILD_TYPE": "Release",
                "CMAKE_C_COMPILER": "D:\\Projects\\clang\\llvm\\bin\\clang.exe",
                "CMAKE_CXX_COMPILER": "D:\\Projects\\clang\\llvm\\bin\\clang++.exe",
                "CMAKE_CXX_FLAGS": "--target=x86_64-windows-msvc --sysroot=D:\\Projects\\windows-msvc-sysroot -fuse-ld=lld -stdlib=libc++",
                "CMAKE_C_FLAGS": "--target=x86_64-windows-msvc --sysroot=D:\\Projects\\windows-msvc-sysroot -fuse-ld=lld"
    
            }
        }
    ]
}

```

使用 `cmake --preset default` 或者CMakeTools在VSCode状态栏提供的按钮就可以指定使用某个编译器配置和构建项目。
