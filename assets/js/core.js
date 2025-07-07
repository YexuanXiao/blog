---
    layout: null
---
'use strict';
/* 2020-2025 YexuanXiao under the MIT License */

// for the random quote in the title
(async () => {
	const response = await fetch('/assets/slogan.txt')
	const text = await response.text()
	const lines = text.split('\n')
	const randLine = lines[Math.floor((Math.random() * lines.length) + 1)]
	if (randLine) {
		document.getElementById('quote').textContent = randLine
		setTimeout(() => { render(randLine) }, 100000)
	}
})()

// function for control search manu and navbar menu display or not
// 0 for hide search-menu
// 1 for show search-menu
// 2 for close navbar-menu
function closeMenu(x) {
	const searchMenu = document.body.querySelector('#search-panel>div')
	const navbarBurger = document.body.querySelector('#navbar>div>.navbar-burger')
	const navbarToggle = document.body.querySelector('#navbar-menu')
	if (x === 0) {
		searchMenu.classList.add('is-hidden')
	} else if (x === 1) {
		searchMenu.classList.remove('is-hidden')
	} else {
		navbarBurger.classList.remove('is-active')
		navbarToggle.classList.remove('is-active')
	}
}

// add dynamic menu button on vertical device
{
	const burger = document.getElementById('search-panel').nextElementSibling
	const menu = document.getElementById('menu-toggle')
	burger.addEventListener('click', () => {
		menu.checked = !burger.classList.toggle('is-active')
		closeMenu(0)
	})
}

// footnote dynamic popup tooltips
for (const sup of document.querySelectorAll('sup.footnote-ref')) {
	const anchor = sup.firstElementChild;
	const id = anchor.innerText
	const message = document.createElement('div')
	message.className = 'message is-small'
	message.style.position = 'absolute'
	message.style.display = 'none'
	const messageBody = document.createElement('p')
	messageBody.className = 'message-body'
	const text = document.getElementById(`fn${id}`).innerText
	messageBody.innerText = text.slice(0, text.indexOf('↩')).trim()
	message.appendChild(messageBody)
	sup.parentNode.appendChild(message)
	const article = document.querySelector('.post-text')
	sup.addEventListener('mouseover', () => {
		message.style.display = ''
		message.style.marginTop= ''
		message.style.width = `${article.clientWidth}px`
		message.style.marginTop = `${-(message.offsetTop - sup.offsetTop  + message.clientHeight)}px`
	})
	sup.addEventListener('mouseout', () => {
		message.style.display = 'none'
	})
}

// check search bar value to display search-menu
function checkInput() {
	closeMenu(2)
	const inputValue = document.body.querySelector('#search-panel>input').value
	render(`{% if site.i18n.l2dmessage.search %}{{ site.i18n.l2dmessage.search }}{% else %}Searching{% endif %} ${inputValue} ...`)
	if (!inputValue)
		closeMenu(0)
	else
		closeMenu(1)
}

// tap blank area to close search menu and navbar
document.body.addEventListener('click', (event) => {
	const cDom = document.querySelector('#navbar')
	const tDom = event.target
	if (!(cDom === tDom || cDom.contains(tDom))) {
		closeMenu(0)
		closeMenu(2)
	}
})

// make navbar flow on the top and progress bar
{
	const navbar = document.body.querySelector('#navbar')
	const topProcess = document.createElement('div')
	const article = document.body.querySelector('article')
	const container = document.body.querySelector('.main-container')

	const topoffset = navbar.offsetHeight
	topProcess.id = 'progress'
	topProcess.style.top = `${topoffset - topProcess.clientHeight}px`
	document.body.appendChild(topProcess)

	const articleTop = article.offsetTop
	const scrollTopExp = container.offsetTop
	document.addEventListener('scroll', () => {
		closeMenu(2)

		const thirdWindow = visualViewport.height / 3
		const articleHeight = article.clientHeight
		const scrollTopReal = document.documentElement.scrollTop
		const processValue = ((scrollTopReal - articleTop + thirdWindow) / articleHeight) * 100

		if (scrollTopReal > scrollTopExp) {
			navbar.style.position = 'fixed'
			container.style.paddingTop = `${topoffset}px`
			topProcess.style.width = (processValue > 100) ? `${100}vw` : `${processValue}vw`
			topProcess.classList.remove('is-hidden')
		} else {
			navbar.style.position = 'relative'
			container.style.paddingTop = 'unset'
			topProcess.classList.add('is-hidden')
		}
	})
}

// conversion language's brachylogy to full name
function bra2Full(language) {
	language = language.toLowerCase()
	switch (language) {
		case 'asm':
			return 'Assembly'
		case 'cpp':
		case 'c++':
		case 'cxx':
			return 'C++'
		case 'cuda':
			return 'CUDA C++'
		case 'csharp':
		case 'cs':
			return 'C#'
		case 'fsharp':
			return 'F#'
		case 'javascript':
		case 'js':
			return 'JavaScript'
		case 'plaintext':
			return 'Text'
		case 'powershell':
			return 'PowerShell'
		case 'rs':
		case 'rust':
			return 'Rust'
		case 'ruby':
			return 'Ruby'
		case 'ts':
		case 'typescript':
			return 'TypeScript'
		case 'vb':
		case 'visualbasic':
			return 'VisualBasic'
		default:
			return language.toUpperCase()
	}
}

// add a button for <pre> to copy code to clipboard
for (let element of document.body.querySelectorAll('div.highlight')) {
	element = element.parentNode
	element.className = `${element.className} message is-primary`
	const header = document.createElement('div')
	header.className = 'message-header'
	const begin = element.className.indexOf('language') + 9
	const end = element.className.indexOf(' ', begin)
	const icon = document.createElement('span')
	icon.className = 'sw sw-code is-capitalized'
	icon.setAttribute('aria-hidden', 'true')
	icon.innerText = ` ${bra2Full(element.className.substring(begin, end))}`
	header.appendChild(icon)
	const code = element.querySelector('.highlight')
	const button = document.createElement('span')
	button.className = 'sw sw-document copy-code'
	header.appendChild(button)
	element.insertBefore(header, code)
	button.addEventListener('click', async () => {
		try {
			await navigator.clipboard.writeText(code.textContent.trim())
			render('{% if site.i18n.l2dmessage.copyok %}{{ site.i18n.l2dmessage.copyok }}{% else %}Copy completed!{% endif %}')
		} catch (err) {
			console.error('Failed to copy: ', err)
			render('{% if site.i18n.l2dmessage.copyfail %}{{ site.i18n.l2dmessage.copyfail }}{% else %}Failed to copy.{% endif %}')
		}
	})
}

// fix sina images
for (const element of document.body.querySelectorAll('.post-text img')) {
	const old = element.src
	if (old.includes('sinaimg')) {
		const url = new URL(old)
		url.protocol = 'http:'
		element.src = 'https://image.baidu.com/search/down?url=' + url.href
	}
}

// output logo to console
console.info('\n▄██╗   ███╗   ▄██████╗   ▄███████╗\n████╗ ████║   ██╔══██║   ██╔═══██║\n██╔████╔██║   ██████╔╝   ██║   ██║\n██║╚██╔╝██║   ██╔═══╝    ██║   ██║\n██║ ╚═╝ ██║██╗██║     ██╗███████╔╝██╗\n╚═╝     ╚═╝╚═╝╚═╝     ╚═╝ ╚═════╝ ╚═╝\n       © 2016 - 2025 M.P.O.')
console.info('%c M.P.O. %c https://mysteriouspreserve.com ', 'color: #fff; margin: 1em 0; padding: 5px 0; background: #3298dc;', 'margin: 1em 0; padding: 5px 0; background: #efefef;')
