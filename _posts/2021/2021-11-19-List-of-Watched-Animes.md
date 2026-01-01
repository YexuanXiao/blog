---
title: 看过的动画列表
date: "2021-11-19 22:59:00"
permalink: /anime/
tags: [memories, anime, life]
category: by-talk
---
这是一个记录本人看过的动画的列表，列表顺序和观看顺序无关，添加顺序和观看顺序无关，列出项仅代表完整看过，比较不喜欢的不会列出，列出不代表推荐，系列作品会依据主要角色相关性进行切割，否则视为同一作品，仅考虑 2000 年之后的动画。

<!-- more -->

<script>
function countWords(text) {
  const cjkRegex = /[\u4e00-\u9fff]/g
  const cjkCount = (text.match(cjkRegex) || []).length
  const englishRegex = /[a-zA-Z]+/g
  const englishCount = (text.match(englishRegex) || []).length
  const numberRegex = /\d+/g
  const numberCount = (text.match(numberRegex) || []).length
  return cjkCount + englishCount + numberCount
}

(async () => {
    const container = document.body.querySelector('.post-text p').parentNode
    const words = container.querySelector(':scope>.is-justify-content-space-between').children[1]
    const getData = async () => {
        try {
            words.textContent = '字数统计：加载中...'
            const response = await fetch('https://static.nykz.org/animelist.txt.dyn')
            const text = await response.text()
            return text
        } catch (e) {
            const p = document.createElement('p')
            p.textContent = '获取数据失败，请检查网络连接。'
            container.appendChild(p)
            words.textContent = '字数统计：加载失败'
            throw e
        }
    }
    const text = await getData()
    const items = text.split('\n')
    if (items[items.length - 1] === '')
        items.pop()
    const ul = document.createElement('ul');
    for (const i of items) {
        const li = document.createElement('li')
        li.textContent = i
        ul.appendChild(li)
    }
    container.append(ul)
    const count = document.createElement('p')
    count.classList = 'right'
    count.textContent = `共计 ${items.length} 部动画。`
    container.appendChild(count)
    words.textContent = `字数统计：${countWords(text)}`
})()
document.currentScript.remove()
</script>
