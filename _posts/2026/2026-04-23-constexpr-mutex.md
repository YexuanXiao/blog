---
title: 如何实现一个constexpr构造的互斥锁
date: "2026-04-22 18:17:00"
tags: [C++,docs]
category: blog
---

C++11为语言和标准库带来了多线程支持，对于用户来说，一个非常重要的特性就是互斥锁。C++11对于 `std::mutex` 有一个非常微妙的要求（见[N2994](https://wg21.link/n2994)和[LWG828](https://cplusplus.github.io/LWG/issue828)）：它的构造函数需要是 `constexpr` 的。咋一看该要求在早期Windows上不能实现，因为[Critical Section](https://learn.microsoft.com/en-us/windows/win32/Sync/critical-section-objects)需要使用[InitializeCriticalSection](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-initializecriticalsection)初始化底层字节为非0的有意义值，其他内核对象（例如[Mutex](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-createmutexw)）也是如此。但实际上它是可以实现的，只是可能稍微增加一些锁冲突。

<!-- more -->

实现一个构造函数是 `constexpr` 的互斥锁的基本思路非常直白：提前准备。换句话说，在程序启动时，准备一定数量的非 `constexpr` 的互斥锁，让运行时创建的锁动态的选择这些预定义的锁。

由于要保证不同线程在对同一把锁上锁时选择唯一一个底层锁，因此，选择锁的方式为对自己的地址进行哈希。如果你花上一点时间，想到这点并不难。

以下所有代码都假设 `std::mutex` 是一个OS提供的初始化不能 `constexpr` 的锁。

此时我们得到了以下实现：

```cpp
class mutex
{
	static std::size_t get_count() noexcept
	{
		return std::size_t(1) << std::bit_width(std::bit_ceil((std::max)(2u, std::thread::hardware_concurrency())));
	}

	inline static std::vector<std::mutex> mutexes{ get_count() };

	std::mutex& get() noexcept
	{
		int exponent = std::countr_zero(mutexes.size());
		auto addr = static_cast<unsigned long long>(reinterpret_cast<std::uintptr_t>(this));
		auto golden = 0x9e3779b97f4a7c15ULL;
		auto hash = addr * golden;
		return mutexes[static_cast<std::size_t>(hash >> (int(sizeof(hash)) * 8 - exponent))];
	}

public:

	bool try_lock()
	{
        return get().try_lock();
	}

	void lock()
	{
		get().lock();
	}

	void unlock()
	{
		get().unlock();
	}
};
```

该实现非常神奇的不具有任何非静态数据成员，那么该实现正确吗？不，实际上是错的。如果你够聪明，也许可以马上发现该问题。不过我必须承认我不够聪明。

根本原因是，`std::mutex` 不是可重入锁。假设线程A创建了锁x和锁y，x和y恰好选中了同一个底层锁并上锁，那么对底层锁的重入就发生了。

因此，需要将底层锁从 `std::mutex` 更换为 `std::recursive_mutex`。

现在我们又制造了一个相反的问题：我们要实现的互斥锁是非重入锁，但我们将底层锁改为 `std::recursive_mutex` 后，我们实现的锁也变为可重入锁了。

将可重入锁改为不可重入锁的方式倒是非常简单：每次成功对底层锁上锁后都在记录以下线程id，如果成功后发现线程id已经记录并且和自己相同，那么说明发生了重入。

至此，我们终于得到了以下正确实现：

```cpp
class mutex
{
	static std::size_t get_count() noexcept
	{
		return std::size_t(1) << std::bit_width(std::bit_ceil((std::max)(2u, std::thread::hardware_concurrency())));
	}

	inline static std::vector<std::recursive_mutex> mutexes{ get_count() };

	std::recursive_mutex& get() noexcept
	{
		int exponent = std::countr_zero(mutexes.size());
		auto addr = static_cast<unsigned long long>(reinterpret_cast<std::uintptr_t>(this));
		auto golden = 0x9e3779b97f4a7c15ULL;
		auto hash = addr * golden;
		return mutexes[static_cast<std::size_t>(hash >> (int(sizeof(hash)) * 8 - exponent))];
	}

    // 注意此处需要使用OS的API以获得一个整数或者指针类型的id而不是std::thread::id，
	// 因为std::thread::id的构造函数不是constexpr的。
	thread_id_t owner{};

	void verify_and_set() noexcept
	{
		auto tid = get_thread_id();
		if (owner == tid)
		{
            // 发生重入
			std::abort();
		}
		owner = tid;
	}

	void reset() noexcept
	{
		owner = {};
	}

public:

	bool try_lock()
	{
		if (get().try_lock())
		{
			verify_and_set();
			return true;
		}
		else
		{
			return false;
		}
	}

	void lock()
	{
		get().lock();
		verify_and_set();
	}

	void unlock()
	{
		// 先reset再unlock
		reset();
		get().unlock();
	}
};
```

可能有一些人好奇 `std::recursive_mutex` 需要如何实现，这依赖于操作系统提供的条件变量的机制。

使用 `std::mutex` 和 `std::condition_variable` 可以实现 `std::recursive_mutex`：

```cpp
class recursive_mutex
{
    std::mutex mtx;
	std::condition_variable cv;
	thread_id_t owner{};
	unsigned int count{};

public:

	void lock()
	{
		auto tid = get_thread_id();
		std::unique_lock<std::mutex> lk(mtx);
		cv.wait(lk, [&] { return owner == thread_id_t{} || owner == tid; });
		owner = tid;
		++count;
	}

	bool try_lock()
	{
		auto tid = get_thread_id();
		std::unique_lock<std::mutex> lk(mtx, std::try_to_lock);
		if (!lk)
		    return false;
		if (owner != thread_id_t{} && owner != tid)
		    return false;
		owner = tid;
		++count;
		return true;
	}

	void unlock()
	{
		std::unique_lock<std::mutex> lk(mtx);
		if (--count == 0)
		{
			owner = {};
			lk.unlock();
			cv.notify_one();
		}
	}
};
```

相比于直接放弃让互斥锁的构造函数 `constexpr`，该互斥锁实现确实可以称得上低效，因为它增加了锁的冲突，以及条件变量的wait/notify机制比lock/unlock复杂的多，尤其对于一些低效条件变量更是如此。WindowsVista增加了一种新的互斥锁SRWLock，它在初始化时只需要初始化底层字节为0，可以直接用于实现 `constexpr` 构造的互斥锁。

C++标准并没有要求 `std::recursive_mutex` 的构造函数是 `constexpr` 的，就是考虑到条件变量的构造函数不能是 `constexpr` 的，正如 [pthread_cond_init](https://pubs.opengroup.org/onlinepubs/7908799/xsh/pthread_cond_init.html) 和 [InitializeConditionVariable](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-initializeconditionvariable)一样。

因此STL并没有在一开始就将 `std::mutex` 的构造函数实现为 constexpr，可能考虑到性能所以决定不遵从标准，直到[前几年](https://github.com/microsoft/STL/pull/3824)才修复。
