---
title: C++/WinRT Plus：将C++标准模块引入Windows开发
date: "2026-02-24 00:00:00"
tags: [C++,docs,Windows]
category: blog
---
以下是我怎么实现的它。

<!-- more -->

## 实现概览

这周，我在自己的C++/WinRT分支（[C++/WinRT Plus](https://github.com/YexuanXiao/cppwinrtplus)）上实现了C++标准模块。我花了大约36-40小时的有效时间来实现它（包括这篇文章）。虽然我不敢说对模块的理解像亲手实现它的人那样深入，但我有足够的知识去理解编译器的报错。所以起初我将其视为一次挑战，不确定能否成功。结果证明效果相当不错。

在实现过程中，我借助AI帮助我理解C++/WinRT的工作原理。C++/WinRT的代码生成器比我预估的要简单，所以AI对它理解得不错。得益于C++/WinRT本身的高代码质量，即使在最困难的时刻，我也能取得持续进展。

当前的实现状态是所有头文件都可以构建为模块。我不确定是否遗漏了什么，但还没有看到什么坏消息。我在寻求更多对此项目感兴趣的人来帮助改进C++/WinRT Plus，减轻我的负担。我的分支保持了完全的兼容性和测试覆盖率，除了它不再支持C++17和C++/CX。我甚至在C++/WinRT的测试中发现了[一个bug](https://github.com/microsoft/cppwinrt/issues/1540)。

如果你也对C++模块/C++/WinRT感兴趣，或者你正在使用C++/WinRT，我希望你能尝试一下我的分支。如果你对它感到满意，请分享给更多人。

### MSVC编译器状态

MSVC团队在过去几年修复了大量bug，可以说模块现在已经具备了很高的可用性。目前还存在的一个bug是跨模块的using声明无法使用，需要用别名声明替代。实际上，除了这个我事先就知道的bug之外，我还没有遇到其他MSVC的bug。这个bug[几天前已经被标记为已修复](https://developercommunity.visualstudio.com/t/C-modules-compile-error-when-using-a-u/10981263#T-ND11047313)，会在下个版本中发布。

### C++/WinRT的特性

C++/WinRT是一个纯头文件库，这带来了很多便利。这意味着任何头文件都可以组合在一起而不产生冲突。更有价值的是，C++/WinRT没有使用内部链接，避免了各种潜在问题。

不过，要实现模块化，C++/WinRT仍然需要很大的改进。

- 首先，C++/WinRT并没有对C标准库中存在的东西严格使用`std::`限定，这意味着我必须手动修复所有缺失的前缀。
- 其次，C++/WinRT将一个声明错误地放在了本应只定义宏的文件中。我认为这是协作过程中的疏忽，因为C++/WinRT有意将宏分开存放（这也带来了很多便利），但却漏掉了这一个。我的解决方案是将该声明分离到单独的头文件中。

最后，C++/WinRT在尝试支持模块时选择了错误的路径，即让所有头文件共用一个模块，这会导致糟糕的结果。这将使BMI（或.ifc）文件的大小达到260MB——是STL的29MB的9倍。可想而知，采用这种设计，编译速度将会变慢。

## 解决方案

因此，我实现了一种更复杂的方法：

**头文件模式：**

```cpp
#pragma once
#ifndef WINRT_XXX_H
#define WINRT_XXX_H
#pragma push_macro("WINRT_EXPORT")
#undef WINRT_EXPORT
#if !defined(WINRT_MODULE) //传统的头文件路径
#define WINRT_EXPORT
#include <winrt/base.h>
#include <依赖的头文件>
#else
#define WINRT_EXPORT export
#endif
//声明/定义
#pragma pop_macro("WINRT_EXPORT")
#endif
```

**模块接口单元（.ixx）：**

```cpp
module;
#define WINRT_MODULE
#include <intrin.h>
#include <cstddef>
#include <version>
#ifdef _DEBUG
#include <crtdbg.h>
#endif
//这个文件只定义了宏，不包含任何声明
#include "winrt/module.h"
export module Windows.XX;
import 依赖项;

#include "实现文件"
```

由于全局模块片段中的宏对当前文件中后续的`#include`可见，在第二行定义`WINRT_MODULE`宏将会使后续的头文件转换为模块实现文件。

这种设计允许你精确地导入你想要的，而不是不必要的垃圾。这对于`Windows.UI.Xaml`命名空间来说尤为重要，它生成了超过90MB的BMI，占据了总量的三分之一。（我主张使用WinUI3。）

### 构建配置

**MSBuild的局限性：**

不幸的是，由于特殊原因（将来也不会改变），在使用MSBuild配合C++/WinRT Plus时，一旦添加了接口单元，它们就会被编译。因此，默认情况下，即使你不使用`Windows.UI.Xaml`，它仍然会消耗宝贵的时间。

**命名空间排除：**

因此，C++/WinRT Plus提供了通过配置文件禁用某些命名空间的功能。你可以在你的解决方案目录下创建一个`CppWinRT.config`文件，内容如下：

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
    <exclude>
        <prefix>Windows.UI.Xaml</prefix>
        <!--Windows.ApplicationModel.Store依赖于Windows.UI.Xaml-->
        <prefix>Windows.ApplicationModel.Store</prefix>
    </exclude>
</configuration>
```

这可以显著减少编译时间。需要注意的是，命名空间的排除发生在构建过程的非常早期阶段，因此需要执行一次干净构建才能生效。

如果你使用的是MSBuild，即使在C++20下，你仍然可以使用C++/WinRT模块。只需要在C++/WinRT选项中启用模块支持即可。

### CMake集成

从CMake 4.3（当前Visual Studio 2026 Insider中的CMake版本是4.2）开始，CMake支持编译标准库模块。因此，你只需要编写以下`CMakeLists.txt`即可同时使用`std`模块和C++/WinRT模块：

```cmake
cmake_minimum_required(VERSION 4.3)
project(winrt_module LANGUAGES CXX)

set(CMAKE_CXX_MODULE_STD 1)
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CPPWINRT_EXE "cppwinrt" CACHE FILEPATH "Path to cppwinrt executable")
set(CPPWINRT_OUT_DIR "${CMAKE_CURRENT_BINARY_DIR}/cppwinrt")

execute_process(
    COMMAND "${CPPWINRT_EXE}" -input local -output "${CPPWINRT_OUT_DIR}" -modules -verbose
    RESULT_VARIABLE CPPWINRT_RESULT
)
if(NOT CPPWINRT_RESULT EQUAL 0)
    message(FATAL_ERROR "cppwinrt failed with exit code ${CPPWINRT_RESULT}")
endif()

file(GLOB CPPWINRT_MODULES
    LIST_DIRECTORIES false
    CONFIGURE_DEPENDS
    "${CPPWINRT_OUT_DIR}/winrt/*.ixx"
)
list(SORT CPPWINRT_MODULES)

add_executable(main main.cpp)
target_sources(main
    PRIVATE
        FILE_SET cxx_modules TYPE CXX_MODULES BASE_DIRS "${CPPWINRT_OUT_DIR}/winrt" FILES ${CPPWINRT_MODULES}
)
target_include_directories(main PRIVATE "${CPPWINRT_OUT_DIR}")
target_link_libraries(main PRIVATE runtimeobject synchronization)
```

### XAML 支持

当前，模块的XAML的支持尚不清楚，我目前比较疲惫因此该问题需要过一段时间再考虑。好消息是WinUI3仓库拥有XAML编译器的源码，并且准备开始接受外部贡献，这意味着未来有可能使用模块编写WinUI3。

## C++模块的最佳实践

关于实现C++模块，我想告诉用户的是：

**使用标准库模块：**

如果你想使用模块，就应该使用`std`模块（或`std.compact`）。如果在全局模块片段中写`#include <标准头文件>`，那么标准库的所有声明将会同时存在于该模块和其他使用相同方法的模块中。这不仅会增加模块体积，还会极大地影响编译效率。

在编译模块时，C++编译器会合并来自全局模块片段的所有定义，这会非常耗时，因为它需要验证它们在结构上是相同的。这就是为什么它被称为全局模块片段。

三家标准库实际上都支持[在C++20模式编译标准库模块](https://github.com/microsoft/STL/issues/3945)，CMake将其限制为C++23不是很合理。

**避免使用无名称的模块：**

我不推荐使用`import <标准头文件>`，因为它不属于模块TS，实际上存在很多含糊不清的问题。另外，我也不推荐使用cl编译器选项`/translateIncludes`，因为我不认为它能把现有的头文件项目转换为模块，而且它肯定不是模块本身。

## 性能分析

我测试了使用预编译头（PCH）和模块之间的性能差异。测试方法是包含所有头文件和导入所有模块。

**构建时间和文件大小：**

- 构建PCH花费了1分40秒
- 构建模块花费了2分钟
- PCH文件大小：2.4GB
- 模块中间文件：480MB

这个结果并不意外，因为我为C++/WinRT实现的模块需要更复杂的预处理，并且还需要分析依赖关系。显然，这个测试对PCH有利。而且，由于PCH包含了所有的声明，可以预见随着源文件数量的增加，PCH的方式会越来越慢。当预编译完成模块后，使用它会超级快。

**内存使用情况：**

使用模块时，内存在几十MB到300MB之间波动，最后峰值达到1.1GB。使用PCH时，内存在前1分钟内逐渐增长到2.5GB，之后稳定在300MB。

### 结论

模块还解决了一个重要问题：它们不会导出任何宏，提供了一个干净的接口。因此，尽管在最愚蠢的测试中PCH比模块略快，但它在其他方面的劣势足以抵消其优势。
