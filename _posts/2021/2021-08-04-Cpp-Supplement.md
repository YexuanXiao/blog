---
title: C++拾遗
date: "2021-08-04 18:10:00"
tags: [C++, docs]
category: blog
---
本文用来记载C++初学者可能会遗漏的一些细节方面的知识，技巧，以及C过渡到C++的一些不同，不定期更新。

<!-- more -->

1. C++**不允许\*\*\*\*void**类型的指针**直接传递**给另一个**非**void类型的指针，**必须显示转换**。对于不同类型的指针转换，必须允许隐式转换或者强制转换使类型严格匹配

   常见于C的malloc函数等。

2. C++11推荐使用static\_cast等运算符替换C风格的类型转换

3. 使用系统API时必须遵循其类型，否则极易出现跨平台兼容问题，例如系统API使用long则必须跟着使用long，系统API使用time\_t则必须使用time\_t

4. 内存对齐，使用trivial classes，必须要注意内存对齐问题：

   **成员变量并不一定依次紧密排列**，多数按照4byte对齐

   表现为：char + int占8byte，char + int + char占12byte，char + char + int占8byte

   实际上这是编译器为了提高数据读取效率做的优化，因为CPU读取数据是分成每4byte一个读取单元，如果不对齐会导致CPU使用慢的实现读取数据

   所以千万**不要随便的在程序之间传递trivial classes**，否则会因为内存对齐方式不一样导致读取错误

5. 匿名命名空间，**匿名空间会将其中的内容限制在当前文件**：

   C++**默认**文件中的全局变量，函数等等都是 **extern**的

   匿名命名空间并不是没有名字，而是由编译器指派生成一个唯一的名字，再用using指令释放

   由于全局using指令的作用域是当前文件，所以使用匿名命名空间，能防止污染其他文件

6. 匿名联合体，匿名联合体是虽然有联合体其名，但没有其实，行为上类似C语言的联合体：

   匿名联合体是在任意作用域下声明的无名联合体

   匿名联合体中的变量不能为static，但**变量会被释放到上级作用域**

   匿名联合体不能有包括构造函数在内的成员函数

   全局匿名联合体默认是static的，即仅在当前文件作用域下

7. 利用作用域运算符操作空名称选择全局变量

   例如使用全局的C函数open时应该添加全局限定，例如 `::open` 避免名字遮盖

8. 访问枚举元素可使用作用域运算强调，优先使用枚举类而不是枚举

9. 单引号可作为数字的分隔符，使其易于阅读

10. 整数和浮点数的提升和推断可能会有潜在的溢出和丢失精度问题

11. C++中const修饰的全局常量默认static，但是可以在其他文件中使用extern声明来共享这个常量

12. 当构造函数只有一个参数或者可以只传递一个参数时，编译期会自动将该参数实际的值转换为一个临时对象，这时候可以使用explicit关键词来避免生成临时对象（隐式转换）。

    部分参考：[Microsoft Docs](https://docs.microsoft.com/en-us/cpp/cpp/?view=msvc-160)

13. 取模运算按照 余数 = 被除数 - 商 × 除数计算

    ```cpp
    
    #include <iostream>
    
    int main() {
        using std::cout;
        using std::endl;
        cout << 7 / 4 << endl;       // 1
        cout << (-7) / 4 << endl;    // -1
        cout << 7 / (-4) << endl;    // -1
        cout << (-7) / (-4) << endl; // 1
        cout << 7 % 4 << endl;       // 3
        cout << (-7) % 4 << endl;    // -3
        cout << 7 % (-4) << endl;    // 3
        cout << (-7) % (-4) << endl; // -3
    }
    
    ```

14. 编写头文件时应该使用宏对头文件进行保护防止重复引入

    ```cpp
    
    #ifdef FILENAME_OR_OTHER_NAME
    #define FILENAME_OR_OTHER_NAME
    
    // 如果已经定义宏，则直接跳到endif
    // some code
    
    #endif
    
    // 或者
    #pragma once
    
    ```

15. const默认作用于其左边的东西，否则作用于其右边的东西，然后从左向右对声明进行解释。

    ```cpp
    
    const int*; // const只有右边有东西，所以const修饰int成为常量整型，然后*再作用于常量整型
    int const *; // const左边有东西，所以const作用于int，*再作用于int const所以这还是a pointer to a constant integer（同上）
    int* const; // 这个const的左边是*，所以const作用于指针，所以这是a constant pointer to an integer
    const int* const; // 这里有两个const。左边的const的左边没东西，右边有int那么此const修饰int。右边的const作用于*使得指针本身变成const，那么这个是a constant pointer to a constant integer
    int const * const; // 这里也出现了两个const，左边都有东西，那么左边的const作用于int，右边的const作用于*，于是这个还是是a constant     pointer to a constant integer
    // C++里const int* 与int const* 有什么区别？ - 王国潇的回答 - 知乎
    // https://www.zhihu.com/question/443195492/answer/1723886545
    
    ```
