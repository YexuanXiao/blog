---
title: constexpr，constinit和consteval
date: "2022-09-02 23:58:00"
tags: [C++]
category: blog
---
C++11中增加了关键词 `constexpr`，C++20中增加了关键词 `constinit` 和 `consteval`。其中 `constexpr` 用于声明常量表达式，`consteval` 确保常量求值，`constinit` 用于静态初始化。

<!-- more -->

#### `constexpr`

`constexpr` 用于声明常量表达式：一个函数或者一个变量如果是 `constexpr` 的，那么代表其可以用于常量求值语境（在编译期进行计算）。例如用于模板参数或者数组下标。

声明为 `constexpr` 的函数也可以非常量使用，`constexpr` 声明只代表其具有常量求值的可能性。

如果想真正做到常量求值，需要保证所有值都是经由常量表达式计算而来的。

C++ Reference上对函数何时能声明为 `constexpr` 有详细的描述：[constexpr](https://zh.cppreference.com/w/cpp/language/constexpr)。

#### `consteval`

由于 `constexpr` 函数可用于非常量使用，此时编译器可能会忽略 `constexpr` 修饰，产生一个运行期函数调用，而 `consteval` 修饰的函数则一定确保被常量使用，从而使得调用点一定获得一个常量，保证没有运行时函数调用。

#### `constinit`

`constinit` 说明符声明拥有静态或线程存储期的变量。若变量以 `constinit` 声明，则其初始化声明必须应用 `constinit` 。

实际上这就是强制一个静态储存期的变量必须被静态初始化，而不是在其他地方进行动态初始化，使得其在声明位置一定得到初始化。

`constexpr` 强制对象必须拥有静态初始化和常量析构，并使对象有 `const` 限定，然而 `constinit` 不强制常量析构和 `const` 限定。结果是拥有 `constexpr` 构造函数且无 `constexpr` 析构函数的类型（例如 `std::shared_ptr<T>` ）的对象可能可以用 `constinit` ，但不能用 `constexpr` 声明。

<div class="ref-label">参考</div>
<div class="ref-list">
<a href="https://zh.cppreference.com/w/cpp/language/constinit">
constinit
</a>
<a href="https://zh.cppreference.com/w/cpp/language/consteval">
consteval
</a>
</div>

<!--
静态生命周期的变量可以被常量初始化，也可以被动态初始化。一旦一个静态生命周期变量使用了动态初始化，那么就必须要注意这个初始化的时机。

一个错误的例子是用模板混合指针实现延迟初始化的单例：

```cpp

template<typename T>
class Singleton {
    static T* instance;
public:
    static Singleton* getInstace() {
        if (!instance) instance = new T{};
        return instance;
    };
};

template <typename T>
T* Singleton<T>::instance = 0; // #3

class Single1:public Singleton<Single1>{}; // #1

Singleton<Single1> *singleptr1 = Single1::getInstace(); // #2

int main()
{
    Singleton<Single1> *singleptr2 = Single1::getInstace(); // #4
    assert(singleptr2 == singleptr1); // false
}

```

编译器在编译上面一段代码的时候，首先遇到Singleton这个类模板，这时候由于Singleton是个待决类型（没有实例化），所以整个Singleton类内的东西都先不做任何处理。

由于相同的原因，#3位置也不做任何处理。

到了 #2位置，由于Singleton被Single1实例化，所以这个位置产生了 `Singleton<Single1>` 这个类型，但由于Single1是个空类，此时什么也不做。

由于 #2对Singleton进行了实例化，singleptr1是个指针，所以编译器直接生成了一个指针，这是编译器生成的第一个代码。

然后编译器会查找Singleton的定义，并且实例化 `Singleton<Single1>::getInstance`，由于其被使用了。

编译器实例化 `Singleton<Single1>::getInstance` 后，会生成调用代码，并把返回值传递给singleptr1，这是编译器第二次生成代码。

然后编译器会发现 #3，并对其进行实例化，获得 `Singleton<Single1>::instance` 并将其静态初始化为0，这是编译器第三次生成代码。

singleptr1使得getInstance被实例化的时候，会执行new操作写入instance，然后储存到singleptr1。然后执行instance的静态初始化，把instance写为0。进入main函数之后，再由于getInstance的第二次调用，instance被写入新值传给singleptr2。

造成的后果就是singleptr1和singleptr2的指向不一样。

-->
