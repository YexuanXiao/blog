---
title: C++可调用对象和std::invoke
date: "2021-09-25 00:29:00"
tags: [C++, docs]
category: blog
---
C++11添加了lambda的支持，这使得C++拥有了5种可调用对象：函数，函数指针，lambda，仿函数（Functor）和成员函数。这使在传递可调用对象时不得不对这5种方式进行兼容。C++17引入了std::invoke来统一这5种可调用对象，大大简化了代码。

<!-- more -->

std::invoke在GCC中的实现如下：

```cpp

template <typename _Functor, typename... _ArgTypes>
struct invoke_result
    : public __invoke_result<_Functor, _ArgTypes...>
{
};

template <typename _Fn, typename... _Args>
using invoke_result_t = typename invoke_result<_Fn, _Args...>::type;

template <typename _Callable, typename... _Args>
inline invoke_result_t<_Callable, _Args...>
invoke(_Callable &&__fn, _Args &&...__args) noexcept(is_nothrow_invocable_v<_Callable, _Args...>)
{
    return std::__invoke(std::forward<_Callable>(__fn),
                         std::forward<_Args>(__args)...);
}

```

其中invoke\_result其实是编译器的一个黑魔法，invoke\_result代表可调用对象的返回值，invoke\_result\_t是invoke\_result的类型，通过别名模板定义。

is\_nothrow\_invocable\_v用于检查调用是否合法。

std::\_\_invoke内部实际上是将参数传递给了std::\_\_invoke\_impl：

```cpp

template <typename _Callable, typename... _Args>
constexpr typename __invoke_result<_Callable, _Args...>::type
__invoke(_Callable &&__fn, _Args &&...__args) noexcept(__is_nothrow_invocable<_Callable, _Args...>::value)
{
    using __result = __invoke_result<_Callable, _Args...>;
    using __type = typename __result::type;
    using __tag = typename __result::__invoke_type;
    return std::__invoke_impl<__type>(__tag{}, std::forward<_Callable>(__fn),
                                      std::forward<_Args>(__args)...);
}

```

std::\_\_invoke\_impl分别实现了不同情况下的函数调用，有五种重载。

```cpp

//1
template <typename _Res, typename _Fn, typename... _Args>
constexpr _Res
__invoke_impl(__invoke_other, _Fn &&__f, _Args &&...__args)
{
    return std::forward<_Fn>(__f)(std::forward<_Args>(__args)...);
}
//2
template <typename _Res, typename _MemFun, typename _Tp, typename... _Args>
constexpr _Res
__invoke_impl(__invoke_memfun_ref, _MemFun &&__f, _Tp &&__t,
              _Args &&...__args)
{
    return (__invfwd<_Tp>(__t).*__f)(std::forward<_Args>(__args)...);
}
//3
template <typename _Res, typename _MemFun, typename _Tp, typename... _Args>
constexpr _Res
__invoke_impl(__invoke_memfun_deref, _MemFun &&__f, _Tp &&__t,
              _Args &&...__args)
{
    return ((*std::forward<_Tp>(__t)).*__f)(std::forward<_Args>(__args)...);
}
//4
template <typename _Res, typename _MemPtr, typename _Tp>
constexpr _Res
__invoke_impl(__invoke_memobj_ref, _MemPtr &&__f, _Tp &&__t)
{
    return __invfwd<_Tp>(__t).*__f;
}
//5
template <typename _Res, typename _MemPtr, typename _Tp>
constexpr _Res
__invoke_impl(__invoke_memobj_deref, _MemPtr &&__f, _Tp &&__t)
{
    return (*std::forward<_Tp>(__t)).*__f;
}


```

值得注意的是，std::\_\_invoke\_impl对成员函数进行了额外的处理：它会使用args的第一个参数作为类的this，args中剩余的参数被传递给Callable。

对于其他可调用对象，所有args被传递给Callable。

```cpp

#include <functional>
#include <iostream>
 
struct Foo {
    Foo(int num) : num_(num) {}
    void print_add(int i) const { std::cout << num_+i << '\n'; }
    int num_;
};
void print_num(int i) {
    std::cout << i << '\n';
}
struct Print {
    void operator()(int i) const
    {
        std::cout << i << '\n';
    }
};
int main() {
    auto *a = print_num;
    std::invoke(print_num, -9);
    std::invoke(a, -9);
    std::invoke([]() { print_num(42); });
    const Foo foo(314159);
    std::invoke(&Foo::print_add, foo, 1);
    std::cout << "num_: " << std::invoke(&Foo::num_, foo) << std::endl;
    std::invoke(Print(), 18);
}

```

通过std::invoke和 完美转发，能够轻松设计出接收任意可调用对象的函数。

<div class="ref-label">参考</div>
<div class="ref-list">
<a href="https://zh.cppreference.com/w/cpp/utility/functional/invoke">
std::invoke, std::invoke_r
</a>
<a href="https://zh.cppreference.com/w/cpp/named_req/Callable">
C++具名要求：可调用 (Callable)
</a>
</div>
