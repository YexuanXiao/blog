---
    layout: null
---
/* 2020-2025 YexuanXiao under the MIT License */
import Pio from '//static.nykz.org/Single/Pio.js'
Pio.CreateContainerToBody({{ site.live2d.width }}, {{ site.live2d.height }})
window.Noire = new Pio({
	mode: 'fixed',
	content: {
		welcome: ['欢迎来到 {{ site.author.name | slugize }} 的网站', '我叫诺瓦露，是黑土边域（Lastation）的守护女神', '这些女孩子们的服装，大多都很可爱呢。可、可不是说我想穿哦，才没有那个意思呢', '	真是优哉游哉的回来了呢，今天也还有许多事情要做，紧张起来', '哼哼哼~ ♪哼~哼♪ ······喂，你从什么时侯开始在那里的啊······', '做好心理准备了吧？'],
		touch: ['呀······！你在摸哪里啊！', '你、这······，不注意点分寸我真的要生气了哦', '等下，现在不是吐槽的时候！！！'],
		custom: [
		{ selector: '#author', text: '想了解我的主人吗？哼哼，我的主人可是很厉害的！' },
		{ selector: '#musicbox', text: '想听音乐吗？' },
		{ selector: '#search-panel', text: '在这里可以搜索文章！' },
		{ selector: '#tagbox header', text: '想通过标签寻找文章吗？' },
		{ selector: '#friends', text: '想和我们成为朋友吗？只要乐于分享，来者不拒哦' },
		{ selector: 'div.giscus', text: '欢迎留言！每条留言我都会仔细阅读呢~' },
		{ selector: 'a[href="/about"]', text: '这是属于我们的故事！' },
		{ selector: '.card a:not(.tag)', type: 'link' },
		{ selector: '.pagination a', type: 'link' },
		{ selector: 'a.tag', transform: (elem) => { return `想查找所有有关 ${elem.textContent.trim()} 的文章吗？` } },
		{ selector: 'article.post-text span.copy-code', text: '点击可以复制代码！希望这段代码对你有帮助~' },
		{ selector: 'article.post-text pre.highlight', text: '这段代码对你有帮助吗？有任何意见都可以提出~' },
		{ selector: 'article.post-text sup.footnote-ref', transform: (elem) => { return `想阅读第 ${elem.textContent} 个脚注吗？` } },
		{ selector: 'article.post-text a:not(sup>a,.footnote-backref)', type: 'read' }
		]
	},
	button: {
		home: false,
		night:false
	},
	model: [
		{% if site.live2d.enable == true %}{% for module in site.live2d.modules %}{% if forloop.last == true %} '{{ module }}' {% else %} '{{ module }}', {% endif %}{% endfor %}{% endif %}
	],
	tips: true
});
loadStyles('//static.nykz.org/Single/Pio.css')
