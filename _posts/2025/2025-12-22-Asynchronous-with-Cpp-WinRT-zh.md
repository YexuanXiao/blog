---
title: C++/WinRT 中的异步
date: "2025-12-21 11:21:00"
tags: [C++, docs, Windows]
category: blog
---

该文章是对微软的 C++/WinRT 文档的补充，微软的文档比较全面的介绍了 C++/WinRT 中异步的基本概念和用法，但它在一些问题上仍然模糊不清。
在看这篇文章之前，应该先看 [Concurrency and asynchronous operations with C++/WinRT](https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/concurrency) 以及 [Advanced concurrency and asynchrony with C++/WinRT](https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/concurrency-2)，最好还可以看看我的 C++ 协程教程。

<!-- more -->

### 协程是积极启动的

C++/WinRT 协程是积极启动的协程，这代表只要协程被调用，即使不使用 `co_await` 运算符获得它的结果，它也已经开始执行了。

在整个文章中，“C++/WinRT 协程”指的都是返回 `IAsyncAction`，`IAsyncActionWithProgress`，`IAsyncOperation` 或者 `IAsyncOperationWithProgress` 的函数，其他时候“协程”泛指 C++ 协程。

如果一个 C++/WinRT 协程的协程体是同步的，例如只有 `co_return` 语句，而没有其他 `co_await` 语句，那么调用该协程前后不会改变线程。

```cpp

// 使用 co_await 等待该协程不会改变线程
IAsyncAction foo()
{
    co_return;
}

```

积极启动的设计来源于 WinRT 本身，使得外部调用者可以使用取消代替等待（同步）来结束一个异步任务。

```cpp

auto task = AsyncTask();
// other sync or async code
if (canceled) {
	task.Cancel();
} else {
	co_await task;
}

```

也可以把 `task` 存起来。

### 切换线程的几种情况

任何 `co_await` 都潜在切换线程（即使不是 C++/WinRT 协程），这是 `co_await` 的原理导致的，但 WinRT 大部分标记为异步的函数不会导致切换线程，一个原因是它们可能内部是同步的，第二个原因是它们可以保存调用时的上下文，并在随后恢复，稍后会介绍这部分的细节。

C++/WinRT 中会导致切换线程的情况包括：

1. 等待一段时间，例如 `co_await 1s;`
2. 将任务转移到背景线程执行，例如 `co_await winrt::resume_background();`
3. 指定任务队列执行，例如 `co_await wil::resume_foreground(DispatcherQueue());`
4. 指定上下文执行，例如 `co_await context;`，其中 `context` 是 `winrt::apartment_context`
5. C++/WinRT 协程返回（下文会详细解释）

等。

在执行以上语句后，该协程会切换到另一个线程上执行。

在 WinRT 中，继承 `DependencyObject`（例如 `UIElement`）的类提供了让任务在指定线程运行的能力。传统 WinRT（UWP）使用成员函数 `Dispatcher` 获得用于调度的 Dispatcher 对象，使用 WindowsAppSDK 的 API 时，应使用成员函数 `DispatcherQueue` 获得它。

注意，应该使用 `wil::resume_foreground` 而不是 `winrt::resume_foreground`，因为后者在失败时返回 `bool`，容易遗漏造成错误。

`winrt::apartment_context` 是 C++/WinRT 自己的功能，它在初始化时捕获当前 COM 的上下文。

### STA，MTA

COM 的线程分为 STA 和 MTA 两种，每个 STA 线程都关联到一个 STA 上下文，所有 MTA 线程共享一个 MTA 上下文。

在 WinRT 中，UI 线程和自己创建的线程是 STA 线程。UI 类以及其他 STA 类必须在创建它的线程中执行它的成员函数。MTA 类可以自由的在任何线程创建和执行，但必须手动确保没有竞争。

Dispatcher 代表关联到该 STA 线程的一个消息队列。

`co_await wil::resume_foreground(DispatcherQueue())` 的作用是把当前协程放进该单线程消息队列中执行，当 `co_await` 返回后，线程就是该消息队列使用的线程。

`winrt::apartment_context` 当 `co_await context;` 返回时，如果 `context` 是 STA 上下文，那么协程会回到该上下文执行。如果 `context` 是 MTA 上下文，那么协程可以在任意后台线程（Win32 线程池）中执行。

注意，`winrt::apartment_context` 存在一定局限：

| 调用者 | 目标 | 执行方式              |
|:------|:-----|:---------------------|
| MTA   | MTA  | 直接执行（共享上下文） |
| MTA   | STA  | 阻塞调用者执行        |
| STA0  | STA1 | 阻塞调用者执行        |
| STA0  | STA0 | 直接执行（相同上下文） |
| STA   | MTA  | 提交到线程池执行       |

需要同步到 UI 线程时，应该优先使用 Dispatcher，因为它不会阻塞调用者（对应情况 2 和情况 3）。

C++/WinRT 协程会在调用的时候捕获当前上下文，然后在返回时尝试恢复它。因此，在 UI 线程中等待一个 C++/WinRT 协程，可以保证返回时一定还在 UI 线程。

### 正确处理线程亲和性

C++/WinRT 异步编程中需要主要关心以下两点：调用会更改线程的代码后，修改/读取和其他线程共享的数据和在事件处理函数中确定当前线程和目标线程。

例如，每隔 1 秒更新一次 UI 中的计数，在 `co_await` 后必须将线程切换回 UI 线程后更新内容：

```cpp

auto&& canceled = co_await winrt::get_cancellation_token();
co_await wil::resume_foreground(text.DispatcherQueue());
for (unsigned x = 0u; !canceled(); ++x) {
	text.Text(to_hstring(x));
    using namespace std::literals;
	co_await 1s;
    // 切换回UI线程
	co_await wil::resume_foreground(text.DispatcherQueue());
}

```

当使用事件处理函数时，产生事件的线程即是事件处理函数被执行的线程。通常来说，应该确保所有事件都是由一个线程发出的。否则，请确保所有读取和修改操作都得到正确同步。

有些任务在自己的线程执行并且自发的产生事件，例如 `MediaPlayer` 和其关联的对象。通常来说，它们的成员函数是线程安全的，但它们产生的事件的回调可以在任何线程被执行，此时必须同步到 UI 线程或者指定线程来完成后续逻辑。

<div class="ref-label">参考：</div>
<div class="ref-list">
<a href="https://github.com/microsoft/cppwinrt">
C++/WinRT
</a>
<a href="https://devblogs.microsoft.com/oldnewthing/20230124-00/?p=107746">
Inside C++/WinRT: Apartment switching: The basic idea
</a>
<a href="https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/concurrency-2">
Advanced concurrency and asynchrony with C++/WinRT
</a>
</div>
