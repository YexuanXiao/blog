'use strict';
/* 2020-2025 YexuanXiao under the MIT License */
{
	const postText = document.body.querySelectorAll('.post-text')
	const postTextWidth = postText.offsetWidth
	const videoHeight = postTextWidth * 9 / 16
	if (visualViewport.width <= 768) {
		const elements = document.getElementsByClassName('bilivideo')
		Array.prototype.forEach.call(elements, function (element) {
			element.style.height = videoHeight + 'px'
			element.style.margin = '.5em 0 .5em 0'
		});
	};
}
