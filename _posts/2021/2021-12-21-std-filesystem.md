---
title: std::filesystem初探
date: "2021-12-21 13:45:00"
tags: [C++,STL]
category: blog
---
在C++17之前，C++的文件系统操作都是依靠吗一些第三方库包装Windows或者POSIX系统调用来实现的。C++14时期的Paper [N4100](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2014/n4100.pdf) 提出了文件系统标准库，C++17中std::filesystem正式纳入标准。

<!-- more -->

std::filesystem通过两个基础类实现需要的功能：

- std::filesystem::directory\_entry：提供对真实存在的目录的访问
- std::filesystem::path：提供对路径的操作

#### 硬链接

Linux和Windows都支持对文件的硬链接，并且仅允许在同分区内创建硬链接。

硬链接是指向文件数据节点的索引，需要系统提供的文件系统底层API才能判断同一个数据节点是否被索引多次。

在上层应用中，硬链接等同于普通文件。

#### 软链接

Linux和Windows都支持对目录的软链接，并且软链接可以跨分区。

同时，Linux还支持对文件的软链接。

经过我的测试，Windows上软链接同时被视为目录。

Linux上指向目录的软链接应当被视作目录，指向文件的软链接应当被视作文件。

可以通过如下代码进行测试：

```cpp

#include <filesystem>
#include <iostream>

namespace fs = std::filesystem;

void _Find_Files_r(const fs::path& p)
{
    for (const auto& entry : fs::directory_iterator(p))
    {
        auto filename = entry.path().string();
        if (entry.is_regular_file())
        {
            std::cout << "File:" << filename << std::endl;
        }
        if (entry.is_symlink())
        {
            std::cout << "Link:" << filename << std::endl;
        }
        if (entry.is_directory())
        {
            std::cout << "Folder:" << filename << std::endl;
            _Find_Files_r(entry);
        }
    }
}


inline void Find_Files_r(const fs::path& p)
{
    if (fs::exists(p) && fs::is_directory(p))
    {
        _Find_Files_r(p);
    }
    else {
        // other mysterious type
    }
}

int main()
{
    Find_Files_r(fs::current_path());
    std::cin.get();
}

```

注意，Windows平台上如果一个软链接指向了错误的地点（例如指向文件或者其他神奇的东西），则通过此path无法构造directory\_entry，会抛出filesystem\_error异常而当软链接指向的地点为空时不触发异常。

不安全：

```cpp

#include <filesystem>
#include <iostream>

namespace fs = std::filesystem;

void _Find_Files_r(const fs::path& p)
{
    for (const auto& entry : fs::directory_iterator(p))
    {
        auto filename = entry.path().string();
        if (entry.is_regular_file())
        {
            std::cout << "File:" << filename << std::endl;
        }
        if (entry.is_symlink())
        {
            std::cout << "Link:" << filename << std::endl;
        }
        if (entry.is_directory())
        {
            std::cout << "Folder:" << filename << std::endl;
            _Find_Files_r(entry);
        }
    }
}


inline void Find_Files_r(const fs::path& p)
{
    if (fs::exists(p) && fs::is_directory(p))
    {
        _Find_Files_r(p);
    }
    else {
        // other mysterious type
    }
}

int main()
{
    Find_Files_r(fs::current_path());
    std::cin.get();
}

```

安全：

```cpp

#include <filesystem>
#include <iostream>

namespace fs = std::filesystem;

void _Find_Files_r(const fs::path& p)
{
    auto begin = fs::begin(fs::directory_iterator(p));
    auto end = fs::end(fs::directory_iterator(p));
    while (begin != end)
    {
        try {
            auto entry = *begin;
            auto filename = entry.path().string();
            if (entry.is_regular_file())
            {
                std::cout << "File:" << filename << std::endl;
            }
            if (entry.is_symlink())
            {
                std::cout << "Link:" << filename << std::endl;
            }
            if (entry.is_directory())
            {
                std::cout << "Folder:" << filename << std::endl;
                _Find_Files_r(entry);
            }
            ++begin;
        }
        catch (fs::filesystem_error a) {
            std::cout << "Bad Link:" << a.path1() << std::endl;
            ++begin;
        }
    }
}


inline void Find_Files_r(const fs::path& p)
{
    if (fs::exists(p) && fs::is_directory(p))
    {
        _Find_Files_r(p);
    }
    else {
        // other mysterious type
    }
}

int main()
{
    Find_Files_r(fs::current_path());
    std::cin.get();
}

```

由于Windows平台上，字符都使用wchar\_t而不是char，这将导致std::filesystem::path内部也使用wchar\_t，不过还好标准库考虑到了这一点，不管是何种方式实现的path，都可以通过成员函数进行轻松的编码转换：

返回转换到字符串的原生路径名格式：

- string
- wstring
- u8string
- u16string
- u32string

返回转换到字符串的通用路径名格式：

- generic\_string
- generic\_wstring
- generic\_u8string
- generic\_u16string
- generic\_u32string

```cpp

#include <cstddef>
#include <filesystem>
#include <iomanip>
#include <iostream>
#include <span>
#include <string_view>

void print(std::string_view rem, auto const& str) {
    std::cout << rem << std::hex << std::uppercase << std::setfill('0');
    for (const auto b : std::as_bytes(std::span{ str })) {
        std::cout << std::setw(2) << std::to_integer<unsigned>(b) << ' ';
    }
    std::cout << std::endl;
}

int main()
{
    std::filesystem::path p{ "/家/屋" };
    std::cout << p << std::endl;

    print("string    : ", p.generic_string());
    print("u8string  : ", p.generic_u8string());
    print("u16string : ", p.generic_u16string());
    print("u32string : ", p.generic_u32string());
    print("wstring   : ", p.generic_wstring  ());
}

```
