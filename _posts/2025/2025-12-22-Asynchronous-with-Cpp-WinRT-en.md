---
title: Asynchronous with C++/WinRT
date: "2025-12-21 11:21:00"
update: "2026-04-05 20:17"
tags: [C++, docs, Windows]
category: blog
---

This article serves as a supplement to Microsoft's C++/WinRT documentation. Microsoft's docs provide a solid overview of asynchronous concepts and usage; however, they are ambiguous on several key points.

Before diving into this article, you should first read [Concurrency and asynchronous operations with C++/WinRT](https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/concurrency) and [Advanced concurrency and asynchrony with C++/WinRT](https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/concurrency-2). It's also helpful to have gone through my C++ coroutines tutorial (Chinese).

<!-- more -->

### COM Initialization

COM threads are categorized as either STA or MTA. Each STA thread is associated with its own STA apartment, while all MTA threads share a single MTA apartment. If there are MTA threads in the current process, any thread not explicitly initialized is implicitly an MTA thread. If the real MTA thread that an implicit MTA thread depends on is unregistered, the implicit MTA thread's COM objects become invalid unless `CoIncrementMTAUsage` is called in advance.

C++/WinRT provides `winrt::init_apartment` and `winrt::uninit_apartment` for initializing and uninitializing COM. However, note that these are not wrapped as RAII-style classes, so ensure that when `winrt::uninit_apartment` is called, no COM objects remain unreleased.

A thread can be initialized multiple times with the same apartment type, and there must be a corresponding number of uninitializations. Re-initializing with a different apartment type is an error. After the last uninitialization is performed, COM returns to an uninitialized state. Generally, threads in the Win32 thread pool need to consistently use MTA.

Apart from the main thread in UWP, all threads are not initialized with COM, meaning there is no STA or MTA apartment available for use.

Generally, threads you manually create can be either STA or MTA, and the apartment for Win32 thread pools should be MTA.

### C++/WinRT Coroutines Are Eagerly Started

C++/WinRT coroutines are **eagerly started**. This means the coroutine begins execution as soon as it's called, even if you don't use the `co_await` operator to retrieve its result.

Throughout this article, "C++/WinRT coroutine" specifically refers to functions that return `IAsyncAction`, `IAsyncActionWithProgress`, `IAsyncOperation`, `IAsyncOperationWithProgress`, or `winrt::fire_and_forget`. In other contexts, "coroutine" refers to C++ coroutines in general.

If a C++/WinRT coroutine's body is synchronous (e.g., contains only a `co_return` statement with no other `co_await` statements), then calling it will not cause a thread switch.

```cpp
// Awaiting this coroutine with co_await will not switch threads.
IAsyncAction foo()
{
    co_return;
}
```

This eager-start design originates from WinRT itself. It allows an external caller to cancel an async task instead of waiting (synchronously) for it to finish.

```cpp
auto task = AsyncTask();
// ... other sync or async code ...
if (canceled) {
    task.Cancel();
} else {
    co_await task;
}
```

You can also store the `task` for later use.

### When a Thread Switch Can Occur

Any `co_await` expression has the *potential* to switch threads (this isn't unique to C++/WinRT coroutines; it's inherent to how `co_await` works). However, most WinRT functions marked as asynchronous won't actually cause a thread switch. One reason is they might be internally synchronous. Another is they can capture the caller's context and resume on it later—more details on this shortly.

In C++/WinRT, common scenarios that **do** cause a thread switch include:

1. Awaiting a duration, e.g., `co_await 1s`
2. Switching execution to a background thread, e.g., `co_await winrt::resume_background()`
3. Specifying a task queue (DispatcherQueue), e.g., `co_await wil::resume_foreground(DispatcherQueue())`
4. Specifying a apartment for execution, e.g., `co_await context` where `context` is a `winrt::apartment_context`
5. Awaiting a third-party awaiter
6. Awaiting the result of a child coroutine that contains any of the above calls. Note that third-party coroutine return types can cause an eager thread switch upon startup, even without such calls in the coroutine body

After executing any of the above expressions, the coroutine continues on a different thread.

In WinRT, classes that inherit from `DependencyObject` (such as `UIElement`) provide the ability to run tasks on a specific thread. Traditional WinRT (UWP) uses member function `Dispatcher` to obtain a Dispatcher object for scheduling. When using APIs from the Windows App SDK, you should use the member function `DispatcherQueue` to obtain it.

**Note:** Prefer `wil::resume_foreground` over `winrt::resume_foreground`. The latter returns a `bool` on failure, which is easy to overlook and can lead to errors.

`winrt::apartment_context` is a C++/WinRT-specific feature that captures the current COM apartment upon initialization.

### COM Apartment in C++/WinRT

In WinRT, UI threads and other threads initialized with STA are STA threads. UI classes and other STA classes must have their member functions executed on the thread that created them. MTA classes can be created and executed on any thread, but you must manually ensure there are no race conditions.

A Dispatcher represents a message queue associated with its STA thread.

`co_await wil::resume_foreground(DispatcherQueue())` schedules the current coroutine to run on that single-threaded message queue. After the `co_await` completes, execution continues on the thread used by that queue.

When `co_await context;` resumes, if `context` is an STA apartment, the coroutine resumes execution within that specific apartment. If `context` is an MTA apartment, the coroutine may resume on any background thread (from the Win32 thread pool).

**Important Limitation of `winrt::apartment_context`:**

| Caller | Target | Execution Behavior                           |
| :----- | :----- | :-------------------------------------------- |
| MTA    | MTA    | Direct execution (shared apartment)             |
| MTA    | STA    | **Blocks the caller**                         |
| STA0   | STA1   | **Blocks the caller**                         |
| STA0   | STA0   | Direct execution (same apartment)               |
| STA    | MTA    | Scheduled to thread pool                      |

When you need to synchronize back to the UI thread, **prioritize using the Dispatcher**, as it does **not** block the caller (addressing cases 2 and 3 in the table).

A C++/WinRT coroutine captures the current apartment when called and attempts to resume on it when returning. So, if you await a C++/WinRT coroutine from a UI thread, you are guaranteed to still be on the UI thread when it returns.

### Writing Asynchronous Delegates

For basic concepts about C++/WinRT delegates, refer to the C++/WinRT [documentation](https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/handle-events).

[Strong and weak references in C++/WinRT](https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/weak-references) explains how to write synchronous and asynchronous delegates, especially how to keep `this` valid. Before that, I need to re-emphasize that in C++/WinRT, `this` in the member functions you write points to the implementation class, not the projection class. Therefore, `this` points directly to the COM object, not to some kind of `com_ptr`.

When passing `winrt::auto_revoke`, the returned Revoker stores a weak reference, so storing the Revoker in `this` does not create a cycle.

There are many ways to create delegates in C++/WinRT. C++/WinRT allows lambdas, function pointers, and object pointers as delegates. When using an object pointer, you also need to pass an additional object. This pattern is classic, but when the delegate is a coroutine, there are additional issues to consider.

Since delegates typically don't return results through their return value (with very few exceptions) and delegates usually don't need to be exposed in IDL as public interfaces, asynchronous delegates can actually return `winrt::fire_and_forget` instead of `IAsyncAction`. However, note that `winrt::fire_and_forget` terminates the program if the coroutine body throws an exception. If you don't want this behavior, you can write your own:

```cpp
struct fire_and_forget {
    struct promise_type {
        fire_and_forget get_return_object() const noexcept { return {}; }
        std::suspend_never initial_suspend() const noexcept { return {}; }
        std::suspend_never final_suspend() const noexcept { return {}; }
        void return_void() const noexcept {}
        void unhandled_exception() const noexcept {}
    };
};
```

When writing coroutine delegates, if parameters need to be used after a thread switch, they should be passed by value rather than by reference. As explained in my coroutine tutorial, the coroutine state (the coroutine frame) includes the parameter list, so objects in the parameter list remain valid throughout the coroutine's lifetime. If a parameter is not used within the function body, it can be written as a reference.

```cpp
winrt::fire_and_forget foo(XXClass const&, XXEventArgs args) {
    co_await winrt::resume_background();
    (void)args.Index(); // Since a thread switch occurred on the previous line, args needs to be passed by value, not by reference.
}
```

If `args` is MTA, you also need to ensure member functions are called on the appropriate thread.

The following content considers cases where `this` in `obj.Event({this, Handler})` and `obj.Event([this] {})` points to `obj`. In these cases, since the delegate (callback function) is stored in `this`, the capture only needs to capture the `this` pointer, and the `{this, Member}` form also only requires `this` to pass the pointer.

When using a member function coroutine as a delegate, you need to ensure the COM object pointed to by `this` remains alive during asynchronous execution. Whether `this` is STA or MTA, you need to manually ensure this, because once a coroutine is submitted to the thread pool, it's difficult to determine how late it will execute, and there's no synchronization mechanism to guarantee there are no executing asynchronous delegates when the object is destroyed. Generally, you can manually obtain a strong reference using the `get_strong` member function before the first thread switch within the coroutine body.

```cpp
winrt::fire_and_forget Class::Handler(auto sender, auto args) {
    auto strong = get_strong();
    co_await ...;
}
...
this->Event({this, &Class::Handler});
```

C++/WinRT also supports using lambdas as delegates, but this approach is somewhat dangerous.

A lambda is actually an object that is stored by the target object when the delegate is registered. When the target object is released, all delegates it stores are destroyed, and the objects captured by the lambda are also destroyed. Therefore, if it's a coroutine lambda, all captured objects also need to be copied into the function body to ensure that the coroutine can still access these objects after the delegate destruction. These copies must also occur before the first thread switch.

When capturing in a lambda, you cannot use `strong = get_strong()` to capture, as this would cause `this` to hold a strong reference to itself, leading to a memory leak. The solution to this problem is to capture `this` pointer by value and use `get_strong` within the function body to obtain its own strong reference.

```cpp
this->Event([this, var](auto sender, auto args) -> winrt::fire_and_forget {
    auto strong = this->get_strong();
    auto var_local = var;
    co_await ...;
});
```

C++23 introduced a new feature, deducing `this`, which can avoid the need to manually copy captured objects, but you still need to manually copy `this` to avoid circular references that cause memory leaks. Currently, C++/WinRT support for deducing `this` has issues and needs to wait for [my PR](https://github.com/microsoft/cppwinrt/pull/1553) to be merged.

```cpp
this->Event([this, var](auto this, auto sender, auto args) -> winrt::fire_and_forget {
    auto strong = this->get_strong();
    co_await ...;
});
```

If `this` does not point to `obj`, then it must be ensured that `this` outlives `obj`. C++/WinRT supports achieving this using forms like `{this->get_strong(), Member}` and `{this->get_weak(), Member}`, as well as capturing `this` by weak or strong reference in coroutine lambda captures, while also taking care to avoid creating cycles.

If `Event` is a static function, the general rules of asynchronous code apply — that is, all captures need to capture values rather than pointers (similar to using `std::thread`). Additionally, discarding the return value will cause the delegate to leak. In this case, the delegate must be unregistered manually or automatically using the Revoker returned by `winrt::auto_revoke`. Currently, C++/WinRT does not add the `[[nodiscard]]` attribute to such functions, and needs to wait for [my PR](https://github.com/microsoft/cppwinrt/pull/1559) to be merged.

### Handling Thread Affinity Correctly

After calling code that changes threads, you should modify/read data shared with other threads on the appropriate thread.

For example, to update a UI counter every second, you must switch back to the UI thread *after* the `co_await` before modifying the UI content:

```cpp
auto&& canceled = co_await winrt::get_cancellation_token();
co_await wil::resume_foreground(text.DispatcherQueue());
for (unsigned x = 0u; !canceled(); ++x) {
    text.Text(to_hstring(x));
    using namespace std::literals;
    co_await 1s;
    // switch back to UI thread
    co_await wil::resume_foreground(text.DispatcherQueue());
}
```

When working with event handlers, the thread that raises the event is the thread on which the handler executes. Generally, you should ensure all events are raised from a single thread. If not, you must guarantee all read and write operations are properly synchronized.

Some tasks run on their own threads and raise events spontaneously, such as `MediaPlayer` and its associated objects, or classes that monitor system status. Typically, their member functions are thread-safe, but the callbacks for events they raise can execute on any thread. In these cases, you must synchronize back to the UI thread or a specified thread to complete your logic.

<div class="ref-label">Acknowledgements</div>

Thanks to [GeeLaw](https://geelaw.blog/) for the detailed explanation on COM initialization, and to [Bluefire](https://github.com/cnbluefire) for sharing experience and tests, and to [HO-COOH](https://github.com/HO-COOH) for reminding me that delegate return values can use `winrt::fire_and_forget`.

<div class="ref-label">References</div>
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
<a href="https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/weak-references">
Strong and weak references in C++/WinRT
</a>
</div>
